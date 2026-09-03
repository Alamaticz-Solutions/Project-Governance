# 004 — AI, Storage, and Other Non-Primitive Integrations

Lightweight spec (file 07 §7.2). Sibling specs referenced but not assumed to exist/be accepted:
`002-*` (workflow engine + notifications call site), `003-msgraph-saas-provider.md` (MS Graph SaaS provider).

## Business value

The legacy Governance app carries seven integrations that are **not** App Framework primitives:
OpenAI (document + form extraction, meeting transcript pipeline), AWS S3 (document storage), SMTP
(email), pgvector (RAG knowledge base), `bpmn-js` (diagram rendering), Firebase (frontend SDK), and
in-app notifications. Rulebook file 01 §1.4 puts external integrations and durable domain logic in
`backend/src/services` (human-owned, preserved across regeneration); file 07 §7.3 names "governed
AI/tool egress" as an explicit spec trigger. This spec records each one as a deliberate decision plus
its conformance gap so none of them re-enter the rebuild ad hoc, and so the AI-egress and secret-
hygiene findings against the current repo are visible to the M3 architecture checkpoint.

## Scope

### OpenAI extraction
Human-owned service in `backend/src/services`. Current app calls `POST https://api.openai.com/v1/chat/completions`
with model `gpt-4o-mini` (config key `OPENAI_MODEL`, `response_format: json_object`) from
`ai_extraction_service.rs` (`extract_intake_fields`, `extract_team_fields`) and `meeting_agent_service.rs`
(`extract_meeting_notes` + `generate_bpmn`). Rebuild consolidates **all** model calls behind a
single internal boundary module (one egress point, no caller-chosen endpoints/prompts) and treats the
egress as governed per file 07 §7.3. `ai_extraction_service` truncates input (`.take(5000)` /
`.take(8000)`); `meeting_agent_service` sends the transcript **untruncated**, making it the wider
egress surface — the boundary module must impose a uniform size/content cap.

**Ownership split with spec 003:** the meeting-transcript pipeline is invoked by `Meeting.process_transcript`,
a custom method **owned by spec 003** (orchestration + idempotent claim/reaper). **This spec (004) owns**
the AI-egress boundary module it calls: the single egress point, the uniform cap, and the pre-egress PHI
classification gate below. Spec 003 does not re-implement any OpenAI call; it calls this boundary.

**PHI decision gate.** Governance projects can involve clinical / HIPAA data. Rule: no project
document, intake text, or meeting transcript may reach OpenAI without an explicit human/policy
classification decision made **before** egress. The legacy `has_phi_data` / `hasPhiData` field cannot
serve as that guard — `extract_team_fields` asks OpenAI itself to populate `hasPhiData` /
`isHipaaApplicable` from the raw document text, so the flag is an AI-derived output produced *by* the
egress call, not an input to it. The gate must be an intake-time classification step (default-deny for
unclassified documents), owned by a human decision, not a reused post-hoc field.

### Document storage — net-new (`s3_service.rs` is dead code)
**Correction to the "keep S3" framing:** per `.appfw/legacy-modernization.yaml`, `s3_service.rs` is
constructed into `AppState` but has **zero call sites** (grep-confirmed). Real attachment storage today
is the **local filesystem `static/uploads/`** (written by `projects::extract_team_fields`; `s3_key` =
a local filename, `s3_url` = a relative download path) — ephemeral on Render, so existing bytes are
already unreliable. Document storage is therefore **net-new**, not "keep what works".

Rebuild: a human-owned `document_storage` service (an abstraction, not `s3_service.rs` carried over)
with a **config-driven backing store** — S3 as the default for shared/hosted use, a local-filesystem
option for dev. Both the bucket/container name **and** credential resolution come from config/secrets
(file 10: never hard-code — the current `governance-attachments` literal and the reliance on
`aws_config::load_defaults` ambient credentials are findings against the current repo). `config.rs`
and `.env.example` have no S3/AWS keys today; the rebuild adds them and fails closed if unset.

SharePoint (see `docs/SHAREPOINT_DOCUMENT_STORAGE_RESEARCH.md`) is a Microsoft Graph **write** and is
therefore G1-gated per file 04 §4.4 — cross-ref `003-msgraph-saas-provider.md` (D1); defer. Decision
for the human architect: S3-backed `document_storage` now vs SharePoint later.

### pgvector knowledge base
`m20260101_000001_init_schema.rs` creates `CREATE EXTENSION vector;` and `knowledge_chunks.embedding
vector(1536)`. File 02's `data_type` enum is closed and validated — no vector type, no escape hatch
inside `.appfw/model`. **Recommendation: option (a) — model `KnowledgeDocument` / `KnowledgeChunk` as
normal `.appfw/model` entities, drop the `embedding` column, defer RAG entirely.** This is a
zero-cost alignment, not a regression: `knowledge_chunks.rs` already omits `embedding` ("SeaORM does
not natively support pgvector"), and `entities/mod.rs` states these tables "aren't wired into any
service yet". Options (b) and (c) are carried in Open decisions.

### Email / SMTP
Human-owned service (`email_service.rs`). Synchronous `lettre` STARTTLS send; blank `SMTP_USER` =>
mock-send log. **No queue** — the Celery/Redis queue was dropped (`backend/README.md`: "fully unused
scaffolding … grep found zero call sites"). The `email_queue` table is mirrored in `.appfw/model` for
schema fidelity but has **no writer**, matching current behavior.

### BPMN rendering
`bpmn-js` (frontend `package.json`) renders AI-produced BPMN XML in the browser. No backend contract,
low risk. Per ADR 0007 it must live under `src/features/**` (human-owned). Placement gap: current
usage also sits in `src/shared/components/MeetingDetail.tsx` and `src/lib/teamsPocApi.ts` —
`src/lib/**` is framework scaffold ("avoid product-specific edits"), `src/shared/` is not in the
ownership manifest at all. Rebuild confines BPMN to `src/features/**`.

### Firebase
Grep of the whole `frontend/src` for `firebase`, `initializeApp`, `getAuth`, `lib/firebase`,
`./firebase`: the **only** match is `frontend/src/lib/firebase.ts` itself — nothing imports it.
`firebase` appears elsewhere only as a `package.json` / `package-lock.json` dependency. It is dead
code. **Decision: drop the `firebase` dependency and delete `frontend/src/lib/firebase.ts`.** It
contradicts the framework's Okta/JWT identity model (file 05 §5.7), and the committed
`apiKey: "AIzaSy…"` literal is a secret-hygiene finding against the current repo (file 10).

### Notifications
Human-owned service backed by an in-app `notifications` table via generated CRUD. Current
`notification_service.rs` has only `list_for_user` and `mark_all_read` — **no create/write path**. The
writer that the workflow engine calls is net-new, not preserved; cross-ref `002-*` as the owner of
that call site.

## Non-goals

- Building a real RAG / embedding pipeline now.
- Migrating documents to SharePoint now.
- The analytics / reporting screen (see Open decisions).
- A background job queue (email or otherwise).
- Changing the OpenAI vendor or model.

## Contracts touched

- **File 01 §1.4** — `backend/src/services` is where external integrations and durable domain logic
  live; created once, preserved across regeneration.
- **File 02 §7** — `data_source_type` enum has no vector / graph-embedding option.
- **File 02 `data_type` enum** — closed and validated; no `Vector` type, no escape hatch.
- **File 05 §5.7** — Okta/JWT identity (not Firebase); synthetic data only, no PII/PHI/financial
  values in the repo — relevant to KB content, fixtures, and AI egress.
- **File 05 §5.2** — Chart.js is the charting library, if analytics is ever built.
- **File 07 §7.3** — governed AI/tool egress is an explicit spec trigger.
- **File 10** — never commit secrets; no hard-coded bucket names.

## Risks and controls

| Risk | Control |
|---|---|
| PHI / HIPAA data reaching OpenAI | Explicit pre-egress classification gate (human/policy decision), default-deny for unclassified documents. `has_phi_data` is AI-derived output, not a usable guard — do not reuse it circularly. Single boundary module with uniform size/content cap (closes the untruncated-transcript path in `meeting_agent_service`). |
| Hard-coded S3 bucket + no S3 config surface + ambient AWS credentials | Add config/secrets keys for bucket *and* credential resolution; fail closed if unset. Finding logged against current repo. |
| Committed Firebase API-key literal | Drop `firebase` dep, delete `lib/firebase.ts`. Secret-hygiene finding against current repo. |
| pgvector column inexpressible in `.appfw/model` | Q3 option (a): drop `embedding`, defer RAG. Matches current runtime (column already unused and unwired). |
| Frontend PHI/PII CI lint promised by the framework ADR but never built (file 05 §5.7, file 11 #2) | For a compliance tool this matters. Note that this check likely has to be built here rather than inherited; owner = human architect. |
| BPMN / product code outside the human-owned frontend surface | Confine `bpmn-js` usage to `src/features/**`; no product edits in `src/lib/**` or `src/shared/`. |

## Acceptance evidence

- `scripts/appfw product validate --json` — passes with `KnowledgeDocument` / `KnowledgeChunk`
  validating under the chosen Q3 option (embedding-less under option (a)).
- Grep of product source: no raw hex / CSS colour literals outside `tokens.dtcg.json`; no hard-coded
  secrets or bucket names.
- `frontend/package.json` no longer lists `firebase`; `frontend/src/lib/firebase.ts` is gone.
- `scripts/appfw product boundary-check --json` for the services `[unverified against rulebook
  command surface — file 00 ground rules 3 & 5; confirm the exact command name before relying on it]`.
- Config surface exists for OpenAI (already present), S3 bucket + credentials (net-new), SMTP
  (present); none carry literal secret values.

## Open decisions

| # | Decision | Recommendation | Who decides |
|---|---|---|---|
| Q3 | pgvector KB: (a) drop `embedding`, model as normal entities, defer RAG; (b) `code_only` schema outside generated CRUD, hand-written vector migrations/queries; (c) generated table minus `embedding`, reach the vector column only via a vetted `provider_routine`. | (a) — zero-cost, matches current unwired runtime behavior. | Human architect, M3 checkpoint |
| — | Document storage backing store (it is net-new — `s3_service.rs` is dead, real storage is ephemeral local disk). Options: config-driven `document_storage` service with an S3 default + filesystem-for-dev, vs SharePoint (Graph write, G1-gated, cross-ref spec 003 D1). | Build the `document_storage` abstraction with S3 as the default backing store and a proper config/secrets surface now; defer SharePoint. | Human architect, M3 checkpoint |
| — | Analytics / reporting screen timing. Backend aggregation already exists (`dashboard_service.rs` computes status/priority/risk breakdowns in Rust); only the *screen* is a placeholder route, and the "analytical report" frontend archetype has no real example anywhere (file 05 §5.6, file 11 #5). | Keep deferred until the document/workflow archetype (workspace / gate-review UI) is proven. This is a frontend-archetype decision, not a missing-backend one. | Human architect, M3 checkpoint |

## Status

`draft`
