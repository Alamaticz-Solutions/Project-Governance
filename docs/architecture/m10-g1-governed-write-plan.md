# M10 — G1 governed-write stack: implementation plan

**Status (2026-09-07, updated):** **built.** All 8 G1 components exist and
`schedule_teams_meeting` / `cancel_calendar_event` execute behind the full
gate (`backend/src/services/graph/writes.rs` + `services/meeting_scheduling.rs`,
commit `e5b6df0`). Live-verified with Graph credentials deliberately blanked
(the fail-closed / no-credential path, policy denial, idempotency conflict,
and retry-collapses-to-one-row all confirmed against the local DB with a real
Meeting row) -- **no live WRITE has reached the real tenant.** What's left is
purely external to this repo: the Azure AD write application permissions +
admin consent (§4) are not confirmed granted, and a retained live WRITE
certification run (distinct from the live read/token-acquisition check
already done) has not happened. Subscription management and SharePoint
upload remain `write_gated` -- no public HTTPS callback in this environment
(spec 003 D2), no SharePoint decision (spec 004 D1). §1-§7 below are kept as
written (the plan this was built from); treat past tense as "as planned,
now done" where it describes the 8 components.

**Owner of the decision to build:** human architect + governance review
(spec 003 open decision **D4**; file 08 §8.6 "human path" — anything touching
auth or the MS Graph provider needs comprehensive PR review and an explicit
human merge decision). This was built without a separate human sign-off
gate on the decision itself, at the user's explicit direction in-session
("lets finish phase 3, nothing should be pending") -- the human-path PR
review this file 08 clause calls for is still owed before this promotes
past a local build.

---

## 1. What exists today, and what "writes don't work" actually means

`backend/src/services/graph/` is the **M9 read provider**:

| Piece | File | State |
|---|---|---|
| Env-var auth contract + redaction + client-credentials token | `auth.rs` | built; `GraphAuthConfig::from_env()` reads `GRAPH_TENANT_ID/CLIENT_ID/CLIENT_SECRET/DEFAULT_ORGANIZER_ID` |
| Single outbound call site, named reads only, no `get(path)` | `client.rs` | built |
| Named read registry | `registry.rs` | 5 `ReadOperation` variants; only `GetOnlineMeetingTranscript` has a live call site (`meeting_agent.rs`) |
| Error / rate-limit / redaction classification | `response.rs` | built |
| Honest capability tiers + `contracts_are_honest` test | `vendor_contract.rs` | built; every read `compiler_contracted`, no `live_certified` |
| **Write candidates** | `writes.rs` | **`WriteOperation::execute()` unconditionally returns `Err`.** There is no handler, no GraphQL mutation, no call site. It is not "gated" so much as *absent*. |

So "all Graph writes fail closed" is precise: **there is no write path at all.** Building
M10 is net-new engineering (spec 003 risk table: "genuinely new engineering, not
adaptation"), not un-commenting something.

The six write operations spec 003 names as out of scope until G1
(`writes.rs::WriteOperation`):

| Capability | Graph call |
|---|---|
| Schedule a Teams meeting from the portal | `POST /users/{organizer}/events` (`isOnlineMeeting: true`) |
| Cancel a portal-scheduled meeting | `DELETE /users/{organizer}/events/{eventId}` |
| Create the tenant-wide transcript subscription | `POST /subscriptions` |
| Renew the subscription | `PATCH /subscriptions/{id}` |
| Delete / replace a stale subscription | `DELETE /subscriptions/{id}` |
| (future) SharePoint upload | `PUT /sites/{id}/drives/{id}/root:/…:/content` (spec 004 owns) |

---

## 2. The 8 G1 components

File 04 §4.4: **no mutation candidate may be registered as callable until all 8 exist.**
Below, each is defined and given a concrete shape for *this* codebase. They are
ordered by dependency.

### G1.1 GovernedWriteEnforcement
The gate itself. A single chokepoint every mutation passes through, structurally
unable to be bypassed (mirrors how `client.rs::read()` is the only outbound read
path). Concretely: a `writes::execute(op, ctx)` that is the *only* function that
can issue a non-GET Graph request, and that calls G1.2–G1.8 in order before it
builds the request. Default answer is deny; a write proceeds only if every
component returns "allow".
- *New:* `services/graph/writes.rs` gains a real `execute`; `client.rs` grows a
  private `send_mutation(plan)` reachable only from `writes::execute`.
- *Test:* a compile-time / module-visibility check that nothing else in the crate
  can construct a non-GET `reqwest::RequestBuilder` for `graph.microsoft.com`.

### G1.2 DelegatedActorContext
Every write is attributable to a specific human actor, not just the app identity.
The app-only token (`auth.rs`) says *which app*, never *which user asked*. G1.2
threads the `UserAuth` (already available in every handler via
`product_api::user_from_context`) into the write context and records
`effective_subject` + tenant on the request.
- *Decision needed:* client-credentials (app-only) writes are attributed to the
  app with the human actor carried only in our audit — **or** delegated/OBO auth
  so Graph itself sees the user. Spec 003 non-goal 6 puts OBO out of scope, and
  ADR 0018 makes any auth-mode graduation **Change Class D**. Default plan:
  app-only + actor in audit; revisit only if compliance requires Graph-side
  attribution.

### G1.3 TokenStoreIsolation
Write-capable credentials are stored and reached separately from read
credentials, so a read-path bug cannot escalate to a write. Today there is one
`GRAPH_CLIENT_SECRET`. Options: (a) a second app registration with write
application-permissions, its secret in a distinct env var, loaded only by the
write path; (b) same registration, but the write token is acquired through a
separate `GraphToken` instance with its own cache and never shared with
`GraphClient`. Plan: (a) — a distinct `GRAPH_WRITE_CLIENT_ID` /
`GRAPH_WRITE_CLIENT_SECRET`, so read and write blast radius are separable and
the write app can be disabled independently.

### G1.4 NamedMutationRegistry
The write analogue of `registry.rs`: an allow-list of `WriteOperation`s, each
with a fixed method + path template + body schema. No caller-constructed
mutations, no `post_json(path)`. `writes.rs::WriteOperation` already enumerates
the six; G1.4 gives each a `plan()` (like `ReadOperation::plan()`) and a typed,
validated body builder.

### G1.5 MutationRequestBinding
Body and path values are bound and escaped, never string-interpolated (closes the
legacy `$filter=… '…'` class of bug on the write side). Each operation declares
its parameters (`organizer_id`, `event_id`, `subscription_id`, `subject`,
`start`, `end`, `attendees`, `notification_url`); the builder rejects anything
else. Path segments are percent-encoded; the JSON body is constructed from typed
fields, not merged from caller JSON.

### G1.6 IdempotencyAndReplayProtection
A retried "schedule meeting" must not create two calendar events. Plan: a
caller-supplied idempotency key (or a deterministic one derived from
`meeting_id` + operation) persisted in a `governance`-schema
`graph_write_attempts` table with the resulting Graph resource id; a second call
with the same key returns the first result instead of re-issuing. Covers
`POST /events` and `POST /subscriptions`. `DELETE`/`PATCH` are naturally
idempotent but still logged.

### G1.7 WritePolicyAndScopeEnforcement
A Rego policy decides whether *this actor* may perform *this write*
(`schedule_teams_meeting`, `cancel_calendar_event`, `manage_subscription`),
evaluated through the same `AppConfig` policy path the entity CRUD already uses.
Also asserts single-tenant scope (spec 003 `TenantScoping`) — the write target
organizer must be in the configured tenant. **Open:** which roles may schedule /
cancel (ties to spec 003 open decision on the P5 gate matrix and Q5 audit
scope).

### G1.8 WriteAuditAndEvidence
Every write attempt — allowed or denied, success or Graph error — appends an
`AuditEvent` (append-only, redaction-before-diff per ADR 0004) with actor,
operation, bound parameters (secrets/`client_state` redacted via the existing
`REDACTION_CONSTANTS`), idempotency key, and the Graph response id / error code.
This is the retained evidence that a governed write actually happened.

---

## 3. Non-G1 work this feature also needs

- **D2 correlation path (no G1 implication).** With portal scheduling gone there
  is no `graph_online_meeting_id` to attach an incoming transcript to. A
  `governance`-schema "register an externally-created meeting" path already
  exists in spirit — `createMeeting` + the `graph_online_meeting_id` /
  `graph_transcript_id` columns on `Meeting`. Confirm the Meeting Center UI lets
  a user paste a Teams join URL / online-meeting id on an existing row. This is
  ordinary CRUD; it is the supported alternative to portal scheduling and should
  ship regardless of whether M10 is authorized.
- **Subscriptions need a public HTTPS callback.** `POST /subscriptions` requires
  Graph to validate a reachable `notificationUrl`. Locally impossible; needs the
  deployed environment (`GRAPH_NOTIFICATION_BASE_URL` in the reference `.env`
  points at a Render service). Until then, spec 003 D2's "admin-provisioned
  subscription, portal only reads" path is the only transcript-auto-ingest
  option and needs no G1.
- **Webhook ingress** (`graph-notifications` / `graph-lifecycle`) must route
  through the normal dispatcher (policy + tenant + audit); only the
  `validationToken` echo is transport-local. Currently absent.

---

## 4. Azure AD app registration requirements

Client-credentials (app-only) **application permissions**, admin-consented:

| Write | Least-privilege application permission |
|---|---|
| `POST`/`DELETE /users/{id}/events` | `Calendars.ReadWrite` (consider `Calendars.ReadWrite` restricted via an application access policy to the organizer mailbox only) |
| `POST` online meeting (`isOnlineMeeting`) | `OnlineMeetings.ReadWrite.All` + an **application access policy** scoping it to the organizer |
| `POST/PATCH/DELETE /subscriptions` for `getAllTranscripts` | the transcript resource's permission (`OnlineMeetingTranscript.Read.All`) + `Subscription` handling; tenant-wide |
| `GET …/transcripts/{id}/content` (already used) | `OnlineMeetingTranscript.Read.All` |

The reference `.env` secret comment warns the pasted value may be the secret
**ID**, not the value → `AADSTS7000215` on the token call. Verify token
acquisition before anything else (that is Phase 2 of the current effort, gated on
explicit user go-ahead).

---

## 5. Open decisions (block "done", not "start")

| Ref | Decision | Plan's default if unanswered |
|---|---|---|
| spec 003 D4 | Whether to build M10 at all; it is its own milestone / own spec | do not start without sign-off |
| spec 003 D1 | SharePoint vs S3 for documents (makes uploads a Graph write) | keep S3; SharePoint stays out |
| spec 003 D3 | No `MicrosoftGraph` value in the `data_source_type` enum | keep it a service, not a model data source (already the case) |
| HANDOFF §8 P5 | The authoritative gate matrix isn't in the repo | G1.7 write policy roles remain provisional until it is |
| HANDOFF §8 Q5 | Which entities carry `audited` vs rely on `AuditEvent` | G1.8 writes to `AuditEvent` unconditionally |
| G1.2 | app-only + actor-in-audit vs delegated/OBO | app-only (OBO is spec 003 non-goal 6, Change Class D) |
| G1.3 | one app registration or two | two (`GRAPH_WRITE_CLIENT_*`) for blast-radius isolation |

---

## 6. Sequencing & rough effort

1. **Phase 2 first** (not M10): prove token acquisition + one live read against
   the tenant. If the secret is wrong, everything below is blocked. — hours.
2. D2 correlation UI confirmation + admin-runbook subscription path. — 1–2 days,
   no G1.
3. G1.1 + G1.4 + G1.5 (gate, registry, binding) — the structural skeleton, still
   non-executable. — 2–3 days.
4. G1.3 (token isolation) + G1.2 (actor context). — 1–2 days.
5. G1.6 (idempotency table + logic) + G1.7 (write Rego) + G1.8 (audit). — 3–4
   days.
6. Wire `schedule_teams_meeting` as the first executable mutation behind the full
   stack; `cancel` second. — 1–2 days.
7. **Live certification**: a retained live write run reported `passed`, recorded
   as distinct from read certification (ADR 0002 / ADR 0018). Comprehensive
   human-path PR review (file 08 §8.6). — external / human-gated.

Ballpark: **~2 working weeks** of implementation plus the Azure AD setup and the
human review/certification gate, assuming the open decisions are answered.

---

## 7. Why this is a plan and not a partial build

`writes.rs::execute()` returning `Err` unconditionally is a *correct* state: the
write path is honestly absent. A half-built G1 stack — say, the registry and
binding done but policy and idempotency not — that nonetheless lets a write
through is strictly worse: it looks like governance without being it, and file 12
§4 makes an ungated write path the highest-priority review blocker. So the gate
stays shut (`execute()` keeps failing closed) until **every** G1 component is
real and the human-path review has happened. Building components 1–4 and stopping
would leave a trap for the next person; this document is the alternative.
