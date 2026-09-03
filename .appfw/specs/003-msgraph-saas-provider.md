# Spec 003 — Microsoft Graph SaaS / External-API Provider

- **Depth:** Full spec (file 07 §7.2 — "SaaS/provider integration", auth/tenant/PHI/PII, ingress surface).
- **Owner:** Governance platform team. **Decides:** human architect + governance review.
- **Scaffold:** `C:\Users\ManojRajakumar\Governance-Restructure\governance-appfw\`
- **Branch:** `governance-restructure` (every push needs explicit human approval).
- **Supersedes (as governed pattern):** the legacy direct-HTTP `graph_client.rs` approach in `Project-Governance/backend/src/services/`.
- **Related:** spec 004 (VTT/OpenAI pipeline + S3-vs-SharePoint document storage). File 09 release gates out of scope now. MCP + Kafka disabled.

---

## Business value

The governance workflow depends on Microsoft Teams meeting transcripts: a meeting's summary, decisions, and action items feed gate-review decisions (spec 004 owns the extraction). Today that access is **ungoverned** — `graph_client.rs` exposes a generic `get(path)` / `post_json(path,…)` / `patch_json` / `delete` against `https://graph.microsoft.com/v1.0` with an app-only client-credentials token, called straight from services, called straight from handlers. Callers choose any endpoint and any fields; there is no named-operation allow-list, no per-operation sensitivity classification, no honest capability tier, no write-safety gate, and the two webhooks (`graph-notifications`, `graph-lifecycle`) are unauthenticated at the transport level and bypass the policy/tenant/audit layer entirely.

This spec replaces that with a framework-conformant **SaaS/external-API provider** (file 04): a named-operation registry + env-var auth contract + write-gating layer between `backend/src/services` and the raw Graph HTTP calls. The deliverable is **honest capability tiers** (nothing claims to be certified that has not been), a **hard default-deny gate on every Graph write**, and a governed, auditable read path for transcripts and directory data. The conformant initial build deliberately does **less** than the legacy app (see Non-goals and Open decisions) — that reduction is an accepted, temporary trade-off, flagged here rather than hidden.

---

## Scope

### A new provider crate, structurally mirroring `appfw_provider_salesforce`

`appfw_provider_salesforce` is a non-executable "Wave 1, network-free" skeleton — it has never made a live network call and has never shipped (file 04 §4.4; file 11 items 12–13). It is a **structural template only**, not proof the pattern works. The MS Graph provider mirrors its module shape:

| Module | Responsibility for MS Graph |
|---|---|
| `identity` | Provider descriptor / key (`GraphProviderDescriptor`), mirrors `SalesforceProviderDescriptor`. |
| `auth` | Env-var auth contract with redaction constants: `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_DEFAULT_ORGANIZER_ID`, `GRAPH_NOTIFICATION_CLIENT_STATE`. App-only client-credentials, `.default` scope. Secret + `client_state` values are redaction constants — never logged, never returned in payloads. Credential *delivery* is a platform precondition, not framework-generated (ADR 0018). |
| `metadata` | Graph API version pin (`v1.0`) + a captured endpoint snapshot for the registered operations only. |
| `operation` | Request-plan construction — **no execution** in the plan-construction layer. Each named operation produces a fixed request plan (method, path template, query params, headers). |
| `request` (Graph-equivalent of Salesforce `soql`) | A **safe request builder**: path, query shape, `$select`/`$filter`/`$search` field lists are **fixed per named operation**. Callers pass only bound value parameters (organizer id, meeting id, search term, time window). Callers **cannot** choose endpoints or fields. Filter/search values are parameter-escaped, not string-concatenated (closes the legacy `$filter=JoinWebUrl eq '…'` and `$search` string-interpolation in `resolve_online_meeting_id` / `search_directory_users`). Fail-closed pagination: continuation-token / `@odata.nextLink` validation rejects anything not issued by a prior response for the same operation. |
| `response` | Rate-limit / error classification (`429`, `Retry-After`, `5xx`, Graph `error.code` / `innerError.code`), redacted record payloads, result-size and timeout caps. |
| `watermark` | Incremental-sync watermark fields for delta reads (directory `/delta`, transcript enumeration) — registered, not exercised initially. |
| `registry` | Allow-listed named operations only. No caller-constructed operations. |

The provider is a **backend provider crate + human-owned `backend/src/services` orchestration** (file 01 §1.4). It is **not** registered as a `.appfw/model` data source (see Options considered (c) and Open decisions D3).

### Initial named READ operations to register

Derived from the actual legacy handlers/services (`teams_poc.rs`, `graph_meeting_service.rs`, `graph_subscription_service.rs`). Nothing is invented.

| Operation name | Graph resource (fixed per operation) | Kind | Sensitivity | Proposed status tier |
|---|---|---|---|---|
| `get_online_meeting_by_join_url` | `GET /users/{organizer}/onlineMeetings?$filter=JoinWebUrl eq {joinUrl}` | read | PII (organizer), meeting metadata | `compiler_contracted` |
| `get_online_meeting` | `GET /users/{organizer}/onlineMeetings/{onlineMeetingId}` | read | PII; **PHI-possible** (meeting `subject` may carry clinical-project detail) | `compiler_contracted` |
| `get_online_meeting_transcript` | `GET /users/{organizer}/onlineMeetings/{onlineMeetingId}/transcripts/{transcriptId}/content` (`$format=text/vtt`, fallback `application/vnd.microsoft.graph.transcript+text`) | read | **PHI-possible** (clinical-project meeting transcripts), PII | `compiler_contracted` |
| `search_directory_users` | `GET /users?$search=…&$select=id,displayName,mail,userPrincipalName&$top=10` (`ConsistencyLevel: eventual`) | read | PII (org directory) | `compiler_contracted` |
| `check_organizer_availability` | `POST /users/{organizer}/calendar/getSchedule` | **read** (kind follows vendor-side effect, not HTTP verb — `getSchedule` mutates nothing) | PII (organizer calendar free/busy) | `compiler_contracted` |

`compiler_contracted` here means **no retained live contract run exists** (ADR 0002 `CompilerContracted` — "has not executed a live pass"), *not* that there is no execution path. Reads must be executable or transcript continuity collapses; the missing thing is retained live evidence, not the code path. A reviewer who reads file 04's "not live-callable" gloss more strictly should treat the fix as a **relabel** (e.g. to `planned_gated` with an execution waiver), not a redesign.

**Status tier honesty:** nothing is `live_certified`. The framework has never shipped a live SaaS provider and no SaaS provider anywhere has reached `live_certified` (file 04 §4.4; file 11 items 12–13). A vendor-contract status doc (`docs/vendor-contract.md` in the crate) records each operation's tier with values **transcribed from crate constants**, gated by `scripts/appfw framework docs-check --json` — no hand-invented values.

**Certification split (ADR 0018):** connection-level auth (token acquisition, `.default` scope handshake, reconnect/lifecycle) is proven by **dedicated hermetic connection/auth tests**, recorded as a distinct fact from semantic query-parity certification (ADR 0002 tiers). A passing auth test never implies semantic parity. Auth-mode graduations stay Change Class D (human approval + independent review).

### Webhook ingress (`graph-notifications`, `graph-lifecycle`)

Must route through the framework runtime operation dispatcher (`appfw_runtime::operation::RuntimeOperationDispatcher`), not a parallel transport-local auth/tenant/audit path (file 01 §1.3). Precise split:

- **HTTP ingress owns (transport work):** route mounting, request limits, response headers, and the Graph subscription **`validationToken` echo handshake** — the `?validationToken=` value is url-decoded and echoed verbatim as `text/plain` within ~10s. This is a transport concern (file 01: "HTTP/GraphQL owns … response headers"); it carries no data access and must not block on policy.
- **Dispatcher owns (everything else):** `clientState` verification against the redacted auth constant, actor + single-tenant context derivation, policy-aware dispatch into a registered ingest operation, QueryIR budgets on any resulting read, and audit. The notification body is untrusted input; parsing and any follow-on transcript read are dispatched operations, not ad-hoc service calls.

### `.appfw/model` boundary

Graph-backed data (meetings, transcripts, directory users) is **not** modeled as `.appfw/model` CRUD entities (locked decision; file 04 §4.4 point 7). It is reached only through the named-operation registry, invoked from human-owned `backend/src/services`. The **local persistence tables** are mirrored as `.appfw/model` entities in the `governance` schema (data source `pg_primary`) because they are local state, not Graph resources:
- legacy table `poc_meetings` → entity **`Meeting`** (deliberate rename — the legacy table is a standalone PoC table; the table→entity map is not 1:1). Its `.rego` is item 13 in spec 001's checklist (`poc_meeting.rego` there — rename to `meeting.rego` to match the entity).
- legacy table `graph_subscriptions` → entity **`GraphSubscription`** (standalone, tenant-scoped, no FK).

`GraphSubscription.client_state` carries `meta.audit.redact: true` (file 02 §1; ADR 0004 redaction-before-diff) so the shared secret is redacted before any before/after diff and never persisted in cleartext audit.

### Custom method owned by this spec: `Meeting.process_transcript`

`Meeting.process_transcript` (Mutation; `meeting_id: String`, `payload: serde_json::Value` — the raw VTT or a fetch instruction; returns `serde_json::Value`) is declared on the `Meeting` entity and **owned by this spec** (spec 002 explicitly defers it here; the inventory's `custom_methods` list cross-references spec 003). Its `_impl` orchestrates three sub-steps across spec boundaries:
1. **Fetch the transcript** — via this spec's named read operation `get_online_meeting_transcript` (a governed Graph read), *or* accept a manually-pasted/uploaded VTT (no Graph call — the `POST /teams-poc/meetings/:id/ingest-transcript` continuity path in D2).
2. **Extract** — VTT parse + summary/decisions/action-items + optional BPMN, through **spec 004's** single AI-egress boundary module (spec 004 owns the egress contract and the pre-egress PHI classification gate; this spec owns the orchestration and the idempotent claim/reaper for crash recovery).
3. **Persist** — write the `MeetingAiResult` shape onto the `Meeting` row via `DataAccess` (generated `Update`, honoring the `concurrency` facet's stale-version check).

---

## Non-goals

1. **Every Graph write operation in the initial build.** All of the following are `write_gated`, default-deny, non-executable, pending the full 8-item **G1 governed-write evidence stack** — `GovernedWriteEnforcement`, `DelegatedActorContext`, `TokenStoreIsolation`, `NamedMutationRegistry`, `MutationRequestBinding`, `IdempotencyAndReplayProtection`, `WritePolicyAndScopeEnforcement`, `WriteAuditAndEvidence`:

   | Legacy behavior | Graph write | Status |
   |---|---|---|
   | Schedule a Teams meeting from the portal | `POST /users/{organizer}/events` (`isOnlineMeeting: true`) | `write_gated` |
   | Cancel a portal-scheduled meeting | `DELETE /users/{organizer}/events/{eventId}` | `write_gated` |
   | Create the tenant-wide transcript subscription | `POST /subscriptions` | `write_gated` |
   | Renew the subscription | `PATCH /subscriptions/{id}` | `write_gated` |
   | Delete / replace a stale subscription | `DELETE /subscriptions/{id}` | `write_gated` |
   | (future) Upload a document to SharePoint | `PUT /sites/{id}/drives/{id}/root:/…:/content` | `write_gated` (spec 004 owns the choice) |

2. **Caller-chosen Graph endpoints or fields.** No generic `get(path)` / `post_json(path)` survives.
3. **Treating "the Graph call works in a dev test" as certification.** A green dev call is not a retained live contract run (ADR 0002; file 04 §4.4 point 3).
4. **The OpenAI / VTT extraction pipeline** (summary, decisions, action items, agenda, BPMN) — spec 004.
5. **SharePoint document storage** as a shipped capability — spec 004 owns the S3-vs-SharePoint decision; if chosen it is a named mutation behind the full G1 stack, not initial scope.
6. **Multi-user / delegated (OBO) auth, per-user private action items, custom user skills, delivery channels** — out of scope (`TEAMS_GRAPH_MULTI_USER_FEASIBILITY.md` is discussion notes, not a build plan).

---

## Contracts touched

- **File 04 — SaaS/external-API provider standards (governing file):**
  - §4.4 checklist items 1–7: provider identity + redacted env-var auth contract; **named operations only**, fail-closed pagination; honest read/write + PII/PHI + tier classification; vendor-contract doc gated by `framework docs-check --json` with values transcribed from crate constants; connection-level auth proven by hermetic tests separate from semantic parity; governed writes require the full 8-item G1 stack before any mutation candidate is registered; a Graph-backed `.appfw/model` data source (if ever added) must use a SaaS `data_source_type` and must not host generated CRUD.
  - The **12 read areas**: `ConnectionAuth`, `NamedOperationRegistry`, `RequestBinding`, `PaginationCursoring`, `RateLimitBackoff`, `IncrementalWatermark`, `FieldRedaction`, `TenantScoping`, `SchemaVersionPinning`, `ResultAndTimeoutCaps`, `QueryMetricsAndAudit`, `FreshnessReporting`.
  - The **8 write areas**: `GovernedWriteEnforcement`, `DelegatedActorContext`, `TokenStoreIsolation`, `NamedMutationRegistry`, `MutationRequestBinding`, `IdempotencyAndReplayProtection`, `WritePolicyAndScopeEnforcement`, `WriteAuditAndEvidence` — all `Unsupported` initially.
  - The **4-status vendor-contract vocab**: `live_certified` / `compiler_contracted` / `planned_gated` / `write_gated`.
  - The **write default-deny rule**: SaaS mutations unsupported by default until named-mutation safety, idempotency, audit, and live write evidence exist.
  - The **"practical implication for this project"** paragraph: the conformant rebuild may legitimately do less than the current app until the G1 evidence exists — flag the trade-off, do not silently under-scope.
- **File 03 — ADR 0002:** granular `ProviderContractArea` + `CapabilityStatus` tiers; `LiveCertified` is true only after a live contract executed and reported `passed`; `CompilerContracted` = compiled/type-checked contract, no live pass; area-driven JSON so a release gate fails one overclaim, not a whole provider.
- **File 03 — ADR 0018:** permanent co-equal auth-mode plurality; **connection-level certification is separate from semantic query-parity certification** and does not add `ProviderContractArea` values or provider identities; evidence matrix records "auth-proven vs. semantically live-certified" as two distinct facts; capability-graduating auth modes stay **Change Class D** (human approval + independent review).
- **File 01 §1.3 — ingress guardrail:** "A trusted ingress only admits a request or message into the runtime. It does not grant data access. Policy, tenant isolation, QueryIR budgets, provider contracts, and audit still apply." No parallel transport-local auth/tenant/audit path.
- **File 02 §7:** SaaS `data_source_type` values (`ServiceNow, Workday, Icims, Salesforce, Anaplan, OracleFinancials`) "must not host generated CRUD schemas." **There is no Microsoft Graph value in the enum** (see Open decisions D3).
- **File 03 — ADR 0004:** append-only audit; redaction-before-diff; per-property opt-in via `meta.audit.redact: true`.
- **File 09 §9.1 step 2:** MCP off in release posture (MCP disabled here anyway).
- **File 08 §8.6:** anything touching auth / the MS Graph provider requires **comprehensive** (not focused) PR review and an explicit human decision before merge — "human path".

---

## Options considered

| # | Option | Verdict | Rationale |
|---|---|---|---|
| a | **Named-operation SaaS provider mirroring `appfw_provider_salesforce`** (registry + auth contract + write-gating between services and Graph HTTP) | **RECOMMENDED / mandatory** | The shape file 04 §4.4 requires. Only option that gives honest tiers, a write default-deny gate, and per-operation sensitivity classification. |
| b | Keep the generic `graph_client.rs` behind a thin service wrapper | **Rejected** | This is the exact anti-pattern file 04 §4.4 replaces — caller-chosen endpoints/fields, no registry, no gate. File 12 §4 makes an ungated write path or free-form query the highest-priority review blocker. |
| c | Model Graph data as an `external_read_only` `.appfw/model` schema | **Rejected** | SaaS `data_source_type`s must not host generated CRUD (file 02 §7). Also moot: no Microsoft Graph `data_source_type` exists in the enum. |

### D1 — SharePoint document storage (cross-reference spec 004)

Moving document storage from S3 to SharePoint routes every upload through Graph, making each upload a Graph **write** → therefore `write_gated` / G1-gated. **This spec's position:** if SharePoint is chosen, it is a named mutation behind the full 8-item G1 stack, not shipped initially. `docs/SHAREPOINT_DOCUMENT_STORAGE_RESEARCH.md` D1–D7 remain spec 004's to resolve; the read-side `/drives`+`/sites` GETs could later be added to this provider's registry as named reads, but no work is in this spec's scope.

### D2 — Transcript ingestion continuity

Transcript **ingestion** (reading a transcript for a meeting someone else created) is a READ and stays in the conformant build. Portal-**created** meetings, portal cancels, and portal-created subscriptions are WRITES and cannot. The resulting initial-scope reduction, stated explicitly (file 04 requires the trade-off be flagged, not silently under-scoped):

- **Dropped initially:** schedule meeting from portal; cancel/delete-with-cancel from portal; auto-create + auto-renew of the tenant-wide `communications/onlineMeetings/getAllTranscripts` subscription; the lifecycle-triggered re-subscribe.
- **Structural consequence — the correlation key.** Legacy `ingest_from_notification` finds the local row by `poc_meetings.graph_online_meeting_id`, which is populated **only** by portal scheduling (`schedule_meeting_via_graph` → `resolve_online_meeting_id`); `backfill_by_join_url` likewise depends on a portal-created `join_url`. With scheduling gone there is no row to attach a transcript to. The initial build therefore needs a **local-only "register an externally-created meeting"** path — a `governance`-schema table write (not a Graph write) where a user supplies the Teams join URL or online-meeting id — so an incoming transcript can still be correlated. This is ordinary `.appfw/model` CRUD, no G1 implication.
- **Two supported continuity paths only:**
  1. **Manual paste / upload** (`POST /teams-poc/meetings/:id/ingest-transcript` by row id) — makes **no Graph call at all**; survives unchanged.
  2. **Admin-provisioned subscription** created out-of-band per `TEAMS_GRAPH_ADMIN_RUNBOOK.md`; the portal only **reads** transcript content via `get_online_meeting_transcript`. The portal never creates or renews the subscription.
  - No polling path is proposed: `communications/onlineMeetings/getAllTranscripts` is the *subscription resource* in the current code, not a verified list endpoint — proposing a poll against it would be invention.

---

## Risks and controls

| Risk | Control |
|---|---|
| This is **genuinely new engineering**, not adaptation — `appfw_provider_salesforce` has never made a live network call, never shipped, and no SaaS provider has ever reached `live_certified` (file 04; file 11 items 12–13). | Honest `compiler_contracted` / `planned_gated` / `write_gated` tiers only; retained evidence gates; zero inflated claims; comprehensive human-path PR review (file 08 §8.6). |
| The conformant build does **less** than the current app (no portal scheduling / cancel / auto-subscription) until G1. | Flag explicitly to stakeholders as an accepted, temporary reduction (this spec, D2); the G1 build is its own milestone with its own spec. |
| Unauthenticated webhooks bypassing policy / tenant / audit (legacy). | Route through `RuntimeOperationDispatcher`; only the `validationToken` echo stays transport-local; `clientState` check + actor/tenant derivation + policy + audit are dispatcher-side. |
| `graph_subscriptions.client_state` is a shared secret persisted raw by legacy code (`Set(cfg.graph_notification_client_state.clone())`). | `meta.audit.redact: true` on the property (ADR 0004); redaction constant in `auth`; never logged, never in payloads. Do not persist raw where avoidable. |
| Legacy `graph_lifecycle` logs up to 500 chars of every raw webhook body at `info` (`teams_poc.rs` ~line 499); `graph_notifications` logs 400. | `FieldRedaction` read area: bodies are redacted before logging; classified honestly (not `LiveCertified`). |
| Legacy filter/search values are string-interpolated (`$filter=JoinWebUrl eq '…'` with a hand-rolled `''` escape; `$search` after stripping `"`/`\`). | `RequestBinding` read area: fixed field lists per operation, parameter-escaped value binding, callers cannot inject query text. |
| Legacy `graph_error` marks `429` retryable but **nothing honors `Retry-After`** — only `fetch_transcript_vtt` backs off. | `RateLimitBackoff` graded honestly as `Partial` until a shared backoff honoring `Retry-After` exists across all operations. |
| Single-tenant assumption could be silently violated by a future multi-tenant Graph app registration. | `TenantScoping` read area asserts single-tenant; Rego policies never call `tenant_filter` (locked decision); ADR 0018 auth-mode change is Change Class D. |

---

## Acceptance evidence

The framework CLI cannot run now (docs-only golden path). These are the commands that **will** prove the change when the golden path is live (file 07 §7.4):

- **Hermetic connection/auth tests pass** — token acquisition, `.default` scope handshake, reconnect/lifecycle — recorded as auth-proven, distinct from semantic parity (ADR 0018).
- `scripts/appfw product validate --json` — model + config valid; `poc_meetings` / `graph_subscriptions` entities present; no Graph-backed CRUD schema; `client_state` carries `meta.audit.redact: true`.
- `scripts/appfw framework docs-check --json` — vendor-contract doc status values match crate constants exactly (no hand-invented tiers).
- `scripts/appfw product test` — provider unit contracts (request-plan construction, pagination fail-closed, redaction, error classification) pass.
- **Provider-test area report** shows every registered read area at an **honest non-live tier** (`CompilerContracted` / `Partial` / `Unsupported`), and:
  - **ZERO capabilities marked `live_certified`.**
  - **ZERO write operations registered as callable** — all 8 write areas `Unsupported`; all Graph mutations `write_gated`.
- **Comprehensive (not focused) PR review** with an explicit human decision before merge (file 08 §8.6).

---

## Open decisions

| ID | Decision | Recommendation | Who decides |
|---|---|---|---|
| D1 | SharePoint vs S3 for document storage | Defer to **spec 004**. Note the consequence: SharePoint makes every upload a Graph write → G1-gated; not shipped initially even if chosen. | Human architect + governance review |
| D2 | Transcript-ingestion continuity without portal scheduling | Ship the two read-only paths (manual paste; admin-provisioned subscription) + a **local-only "register external meeting"** CRUD path for correlation. Accept the reduction as temporary. | Human architect + governance review |
| D3 | `.appfw/model` data-source registration for Graph | **Do not register a Graph `.appfw/model` data source.** The `data_source_type` enum (file 02 §7) has **no Microsoft Graph identity**; adding one is a framework-source change, out of scope for a downstream rebuild. The locked decision's antecedent ("*if* a Graph-backed data source is added") is made false. Provider lives as a backend crate + human-owned services. Flag as a framework gap, not a violation. | Human architect + framework owners |
| D4 | The eventual G1 governed-write build (portal scheduling, cancels, portal-managed subscriptions, SharePoint uploads) | Its **own milestone / own full spec**, gated on all 8 G1 evidence items. Not started here. | Human architect + governance review |
| D5 | `compiler_contracted` reading (tier denotes absence of retained live run, not absence of execution path) | Adopt the ADR 0002-anchored reading. If review rejects it, relabel registered reads to `planned_gated` with an execution waiver — a relabel, not a redesign. | Human architect + governance review |

---

## Status

`draft`
