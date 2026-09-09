# 7. Request flows (end to end)

Concrete journeys through the code. Each one names the files in order. Line
references are approximate — code moves.

> ℹ️ Verified end to end on 2026-09-09. Flows 7.6 (`submitDecision`) / 7.7
> (`workspace`) / `eligibleGates` / `pendingApprovals` hit a query-IR contract
> drift that is **fixed in our service layer**. Flow 7.3 (`createProject` with an
> omitted nullable `jsonb`) hits a **PDS framework bug** (send `{}` for the
> field; the SPA already does). See [chapter 13](13-verification-log.md) and
> [`framework-issues-for-pds.md`](../architecture/framework-issues-for-pds.md).

Shorthand used throughout:

- **generated GraphQL handler** = `backend/src/handlers/governance/mod.rs` (the
  `GovernanceQuery` / `GovernanceMutation` objects, `from_context(...)`)
- **DataAccess** = `backend/src/data/data_access.rs` + `read_orchestration.rs` /
  `mutation_orchestration.rs`
- **the policy step** = `backend/src/config/app_config.rs::evaluate_user_access`
  → `regorus` engine for `data.governance.<entity>.access` → then
  `platform/tenant_isolation.rs::apply`

---

## 7.0 Server startup

`cargo run -p backend` →

1. **`backend/src/main.rs::main`** — builds a Tokio multi-thread runtime *by
   hand* with a **128 MiB worker stack** (`worker_stack_bytes()`), not
   `#[tokio::main]`. Reason in the doc comment: the read path recurses deeply
   enough (read-orchestration → projection resolvers → filter-IR → regorus eval)
   to overflow Tokio's default 2 MiB stack.
2. **`run()`** — `dotenv().ok()` loads `backend/.env`; `init_tracing()`;
   `SecurityConfig::from_env()` then `validate_runtime_safety()` — **exits(1)**
   on an unsafe combination (e.g. prod flags in local).
3. `RuntimeMode::from_env()` → `RuntimeHostPlan`. Rejects multiple worker modules
   or unsupported worker modules (this product has none).
4. `AppConfig::init().await` (**`backend/src/config/app_config.rs`**):
   - `config::loader::read_config()` reads `backend/config/generated/`:
     `data_sources.yaml`, and per Postgres-schema `schema.yaml` +
     `entity_types.yaml` + every `*.rego`.
   - `loader::add_secrets` resolves DB credentials via
     `platform/secrets.rs::EnvSecretProvider` (env vars) and pins the **one
     active environment** (`ENV_NAME`, here `local`).
   - each `.rego` file is compiled into a `regorus::Engine` and stored by key
     `governance.<entity>`.
   - result: an `AppConfig` holding `sources`, `schemas`, `types`
     (entity metadata by `schema.PascalName`), `access` (policy engines).
5. `RuntimeAuthState::from_env()` — Okta / local-test-auth config
   (`APP_ENABLE_LOCAL_TEST_AUTH=true` here). Logs `"Okta configuration loaded"`.
6. **`routes::get_routes(...)`** (`backend/src/routes/mod.rs`, generated):
   - `create_data_access_for_schema(app_config, "governance", metrics)` →
     `create_database_client` → the provider registry
     (`FrameworkProvider::Postgres` → `PostgresClient::init`, which opens the
     `deadpool-postgres` pool) → `DataAccess::init`.
   - `info::nest_routes` → `/health/*`, `/metrics` (readiness gets a live
     provider probe).
   - `governance::get_routes` (`routes/governance.rs`, generated) — builds two
     `async_graphql::Schema`s (one live with depth/complexity caps, one
     introspection-only) over `GovernanceQuery` / `GovernanceMutation`, injects
     `DataAccess` as schema data, mounts at `/governance`.
   - `admin_ui::get_routes` → `/admin/*`.
   - if `product_ui_enabled`, `product_ui_routes_if_present(...)` serves
     `backend/product_dist/` at `/`.
   - `assemble_runtime_router_for_mode(...)` adds CORS + metrics + security
     layers.
7. `RuntimeHttpServerConfig::from_env()` → `appfw_runtime::serve_http_router` —
   binds `127.0.0.1:8080`. Ready.

**Timing:** ~1–3 s after the binary exists. Most of it is opening the DB pool and
compiling the ~44 Rego files.

---

## 7.1 A user logs in (local dev)

1. Browser loads the SPA (`frontend/src/main.tsx` → `AppProviders` →
   `BrowserRouter` → `AppRoot`). `App.tsx` route table: everything except
   `/sign-in` is wrapped in `<RequireAuth><AppShell/></RequireAuth>`.
2. `RequireAuth` (`frontend/src/app/RequireAuth.tsx`) checks
   `authContext` — no token → redirect to `/sign-in`.
3. **Local path:** the user opens the "local session" dialog in `AppShell.tsx`.
   They either leave it blank (→ backend treats a missing/blank auth header, with
   `ENV_NAME=local`, as a `local-dev` **admin**) or paste an
   `appfw-local:user=<name>;tenant=<id>;roles=<r1,r2>` string. `authContext.ts`
   stores whatever was entered and decodes it into claims used only to *pre-gate*
   buttons in the UI (fail-closed). The backend re-checks everything.
4. Every subsequent API call goes through
   `frontend/src/lib/appfwClient.ts::createAppfwClient`. Its `headers(...)`
   attaches `Authorization: Bearer <token>` (if any), `x-tenant-id`, a generated
   `x-request-id` + matching `x-correlation-id`, and `x-timezone`.
5. On the backend, `appfw_runtime::RuntimeJwtExtractor::new` (`auth.rs`) resolves
   the `UserAuth`: with `ENV_NAME=local`, an empty token → `local_admin_user`; an
   `appfw-local:` token → parsed into `{tenant, user, roles, scopes}`; anything
   else → falls through to Okta JWT verification. In managed environments only
   the Okta path runs. `product_api.rs`'s `user_from_context` pulls the resolved
   `UserAuth` off the GraphQL context.

There is **no `/login` mutation** in this app — auth is entirely
token-in-header (or the local no-token admin shortcut). The seeded users +
Argon2 hashes exist for a future real login path; the `Login` DTOs in
`schemas/common.rs` are unused placeholders.

---

## 7.2 Read: the project list (`getProjects` / `queryProjects`)

Frontend: `ProjectListScreen.tsx` → `useAsync((client) => client.queryList(projectEntity, {...}))`.

1. `appfwClient.queryList` builds a GraphQL query for the generated
   `queryProjects` connection field with a selection set derived from the
   **generated UI contract** (`frontend/src/generated/appfw-ui-contract.ts` —
   `entity.scaffold.list.fields`), passing `filter` / `sort` / `skip` / `limit` /
   `after` as `JSON` variables.
2. `POST /governance` → `appfw_runtime` GraphQL layer → depth/complexity check →
   `GovernanceQuery::query_projects` in `handlers/governance/mod.rs` (generated).
3. `from_context(ctx, "governance", "Project")` → `HandlerContext` carrying
   `(user, data_access, entity_type, selections)`.
4. `project::query_impl(...)` — for `Project` this is
   `pub use super::generated::project::*` (no custom override for standard CRUD),
   so it's `generated::project::query_impl` → `DataAccess::query_items`.
5. **`DataAccess`** (`read_orchestration.rs`):
   - `app_config.evaluate_user_access(Project, Read, user)` → runs
     `data.governance.project.access` in `regorus` with
     `input = { schema_name, entity_type, action: "read", user }`.
     For an `admin`: `{allow: true, filter: {}}`. For a plain PM:
     `{allow: true, filter: {"manager_id": {"_eq": "<user id>"}}}`.
   - `tenant_isolation::apply` — `Project` has no `tenant_id` column, so no-op.
   - the policy `filter` is merged (`_and`) with the caller's `filter`.
   - builds a query plan (`query_ir.rs`), validates it
     (`query_ir_validation.rs`), estimates cost, then
     `PostgresClient` (via `data/clients/postgres/`) turns it into
     `SELECT ... FROM governance.projects WHERE ... LIMIT ... ` + a `COUNT`,
     runs it on a pooled connection.
6. Rows come back as `ProjectProjection` structs, wrapped in a
   `ProjectQueryResult` with pagination metadata (`page_count`, `next_cursor`,
   …), serialised to JSON, returned.

**Key takeaway:** the row filter is applied in SQL, derived from Rego, and the
handler could not skip it if it tried — `query_items` always calls
`evaluate_user_access` first.

---

## 7.3 Write: create a project from Intake

Frontend: `IntakeScreen.tsx` collects the `Draft` fields → `client.saveRecord(projectEntity, 'create', input)`.

1. `appfwClient.saveRecord` → `mutation createProject($input: InputProject!) { createProject(input: $input) { ...selection } }`.
2. `GovernanceMutation::create_project` (generated) → `project::create_impl` →
   (no custom override) `generated::project::create_impl` →
   `DataAccess::create_item`.
3. **`DataAccess`** (`mutation_orchestration.rs`):
   - `evaluate_user_access(Project, Create, user)` — `project.rego` allows any
     authenticated user to `create`.
   - **validation** (`data/rules/`, `query_ir_validation.rs`) — required fields,
     enum membership, string max lengths (from the fragments), FK existence for
     `manager_id`.
   - `project_number` — **today it comes from the frontend.** `IntakeScreen.tsx`
     calls `newProjectNumber()` client-side and sends it in the create payload
     (it's a required, editable form field). `backend/src/handlers/governance/project.rs`
     has **no** `create_impl` override, and the `projects.project_number` column
     is a plain `varchar` with no default. The model comment's intended design —
     generate it server-side in the Create `_impl` from a `project_number_seq`
     sequence — was **not** implemented (open decision "project_number"). So a
     `createProject` call that omits `project_number` fails validation.
   - `INSERT INTO governance.projects (...) VALUES (...) RETURNING ...`.
   - because `Project` has the **`audited`** facet, a DB trigger writes a
     `projects_audit` row with `action = 'INSERT'`, `before_json = null`,
     `after_json = <the row>`, `event_hash` chained to the previous audit row.
   - because `Project` has the **`concurrency`** facet, the new row's `version`
     is `0`.
4. The `ProjectProjection` of the new row is returned; the SPA navigates to it.

No `AuditEvent` (semantic) row is written for a plain create — those are only for
the named workflow events. The `projects_audit` (facet) row *is* written.

---

## 7.4 AI pre-fill of the intake form (`extractIntake`)

Frontend: `AIPopulationDropzone.tsx` (in `IntakeScreen`) — user drops a PDF/text
file → `client.invoke('extractIntake', { payload: { fileName, mimeType, contentBase64 } })`.

1. `GovernanceMutation::extract_intake` (generated) →
   `project::extract_intake_impl` (**hand-written**, one line) →
   `services::ai_extraction::extract_intake(data_access, &user, payload)`.
2. `require_user(user)?`.
3. `run_extraction` → `text_extract::extract_text(payload)` — decode the
   document. `.txt` direct; PDF via `pdf-extract`; `.docx` → error (not
   supported).
4. `run_extraction_on_text`:
   - **`phi_gate::scan(text)`** — regex/shape scan for SSN, MRN, DOB, patient
     names, contact details. **Any finding → refuse.** Writes an `AuditEvent`
     `AI_EXTRACTION_BLOCKED_PHI` (via `services::audit::record`, which itself
     goes through `DataAccess::create_item` → `audit_event.rego` allows the
     create). Returns `ExtractionError::PhiBlocked`.
   - clean → `OpenAiConfig::from_env()`. Unset → `AI_EXTRACTION_FAILED`
     (`not_configured`).
   - configured → `openai_client::extract_structured(cfg, http, text,
     INTAKE_FIELDS)` — one HTTPS call to OpenAI with the field descriptions.
   - success → `AI_EXTRACTION_SUCCEEDED` audit row + the structured JSON.
5. `outcome_json(...)` wraps it: `{ success, blocked, data | reason }`. The SPA
   pre-fills the form fields it recognises; the user reviews and submits (7.3).

**No project exists yet**, so this custom method takes no `project_id` — the only
one on `Project` that doesn't.

---

## 7.5 Save a gate-review form, then decide it

### Save (`saveStage`)

Frontend: one of `frontend/src/features/workspace/forms/*ReviewForm.tsx` inside
`GateWizard.tsx` → `client.invoke('saveStage', { projectId, stage, payload })`.

1. `GateSubmission::save_stage` custom method → `save_stage_impl` (hand-written) →
   `services::transition::save_stage`.
2. Query `GateSubmission` for `(project_id, stage)`. Found → build an
   `InputGateSubmission` from it (carry `version`); not found → new input
   (`version: None`).
3. `data_access.create_item` or `update_item` accordingly — each runs
   `gate_submission.rego`, validation, and (facet) the `gate_submissions_audit`
   trigger.
4. `audit::record(... GATE_SUBMITTED ...)` — semantic `AuditEvent`.
5. Return `{ submission_id, created, status, version }`.

### AI pre-fill of the review form (`extractTeamFields`)

Same as 7.4 but `extract_team_fields_impl` → `ai_extraction::extract_team_fields(
project_id, team, payload)`. `team_fields(team)` picks the field list for
`epmo`/`bta`/`eac`/`finance`/`pic`; unknown team → `{success:false}` without
calling OpenAI. Audit rows carry the `project_id`.

### Decide (`decide` on `GateReview`)

Frontend: reviewer clicks Approve/Reject/Needs-info →
`client.invoke('decide', { gateId, payload: { decision, notes } })`.

1. `GateReview::decide` → `decide_impl` (hand-written) →
   `services::gate_review::decide`.
2. `require_user`. Map `decision` string → `(ApprovalDecision, status_str,
   audit_event)`.
3. Load the `GateReview` (`find_item` → `gate_review.rego`).
4. **Service-layer ownership check** (not expressible in Rego): `has_role(actor,
   "admin")` OR `review.assigned_role` (lowercased) `== primary_role(actor)`.
   Fail → `"only the assigned reviewer role or an admin may decide this gate"`.
5. Build `InputGateReview`, set `status`, `decision`, `decision_by_id`
   (`resolve_user_id` maps the JWT username → `users.id`), `decision_at`,
   `decision_notes`. `update_item` (→ `gate_review.rego` + audit trigger).
6. `audit::record(... GATE_APPROVED | GATE_REJECTED | GATE_RETURNED ...)`.
7. Return `{ gate_id, project_id, decision, version }`.

---

## 7.6 Advance the sequential approval chain (`submitDecision`)

Frontend: `TeamInboxScreen.tsx` / `ProjectWorkspaceScreen.tsx` →
`client.invoke('submitDecision', { projectId, payload: { decision, comments } })`.

1. `Project::submit_decision` → `submit_decision_impl` (hand-written) →
   `services::approval_state_machine::submit_decision`.
2. `require_user`. Map `decision` → `(new_status, audit_event)`:
   `approve`→`Approved`/`GATE_APPROVED`, `reject`→`Rejected`/`GATE_REJECTED`,
   `needs_info`→`Returned`/`GATE_RETURNED`.
3. Load all `ProjectApproval` rows for the project, ordered by `sequence_order`.
4. Find the first `Pending` one that is addressed to the actor's role, or where
   the actor is `admin`/`epmo` (privileged). None → error.
5. `update_item` on that approval (`project_approval.rego` + audit trigger).
6. `audit::record(...)`.
7. **On approve**: find the next `Pending` approval by `sequence_order`.
   - exists → `notification::notify_role(next.assigned_role,
     NotificationType::APPROVAL_REQUIRED, ...)` — one `Notification` row per
     active user with that role (`notification.rego` allows create for any
     authenticated actor; the *service* chose the recipients).
   - none → `audit::record(... WORKFLOW_ADVANCED, "all approvals complete" ...)`.
8. Return `{ decision, status, next_stage, workflow_complete }`.

`fast_track_complete` (admin) auto-approves the whole chain and sets
`Project.status = COMPLETED`. `cancel` (admin/epmo) sets `CANCELLED`.

---

## 7.7 Open the project workspace (`workspace`)

Frontend: `ProjectWorkspaceScreen.tsx` → `client.invoke('workspace', { projectId }, 'query')`
(note: `kind: 'query'` — `workspace` is `kind: Query` in the model).

1. `Project::workspace` → `workspace_impl` (hand-written) →
   `services::workspace::assemble`.
2. Five reads, each through `DataAccess` (each runs its own Rego policy):
   - `Project` by id
   - `GateSubmission` rows for the project (ordered by `stage`)
   - `ProjectApproval` rows (ordered by `sequence_order`)
   - the last 25 `AuditEvent` rows for the project (ordered by `performed_at` desc)
   - `gate_eligibility::compute(project_id)` — the DAG evaluation from 6.4
3. Assemble one JSON payload `{ project, gate_submissions, approvals,
   recent_audit, eligibility }`. One round trip for the whole screen.

---

## 7.8 Schedule a Teams meeting (`scheduleViaGraph`) — the G1 path

Only works if `GRAPH_*` env vars are set.

Frontend: `MeetingCenterScreen.tsx` → create a `Meeting` row (generated
`createMeeting`), then `client.invoke('scheduleViaGraph', { meetingId, payload })`
where payload has `start_time`, `end_time`, `attendees[]`, optional `subject` /
`organizer` / `idempotency_key`.

1. `Meeting::schedule_via_graph` → `schedule_via_graph_impl` (hand-written) →
   `services::meeting_scheduling::schedule_via_graph`.
2. `require_user`. Load the `Meeting` row.
3. `resolve_organizer` — payload `organizer` → `meeting.graph_organizer_user_id`
   → `meeting.organizer_email` → `GRAPH_DEFAULT_ORGANIZER_ID`. Error if none.
4. Resolve `subject` / `start_iso` / `end_iso` / `attendees` from payload or row.
5. `WriteContext::from_user(actor)` — the acting human (G1.2).
6. `writes::execute(data_access, &ctx, WriteOperation::ScheduleCalendarEvent
   { organizer, subject, start_iso, end_iso, attendees }, Some(meeting_id),
   idempotency_key)`:
   - **G1.6** — compute `sha256(operation ‖ sorted bound params)`; look it up in
     `graph_write_attempts`. Prior success with the same key → return the
     recorded outcome, `idempotent_replay: true`, **no network call**.
   - **G1.7** — `policy_check` for action `schedule_teams_meeting` (role +
     tenant). Denied → `WriteError::PolicyDenied`.
   - **G1.4/G1.5** — `op.plan()` → `POST /users/{organizer}/events`;
     `op.body()` → the typed `{ subject, start:{dateTime,timeZone:"UTC"}, end,
     attendees:[{emailAddress,type:"required"}], isOnlineMeeting:true,
     onlineMeetingProvider:"teamsForBusiness" }`.
   - **G1.3** — acquires a token from the **write** app registration.
   - the single `POST` to `graph.microsoft.com`.
   - **G1.8** — write an `AuditEvent` and a `graph_write_attempts` row for the
     outcome (success or failure), with redacted payloads.
7. Back in `schedule_via_graph`: pull `onlineMeeting.joinUrl` and `id`
   (calendar event id) from the redacted response. `resolve_online_meeting_id`
   does a best-effort governed **read** (`GetOnlineMeetingByJoinUrl`) to get the
   `graph_online_meeting_id` (needed later for the transcript).
8. `update_item` on the `Meeting`: `graph_event_id`, `graph_online_meeting_id`,
   `graph_organizer_user_id`, `join_url`, `attendees`, `status =
   graph_scheduled`, `start_time` / `end_time`.
9. Return `{ operation, graph_event_id, join_url, status, version,
   idempotent_replay }`.

`cancel_via_graph` mirrors this with `CancelCalendarEvent` / `CancelOnlineMeeting`
— and the organizer + resource id come from the `Meeting` row **only**, never the
caller.

---

## 7.9 Process a meeting transcript (`processTranscript`)

Frontend: `MeetingDetailScreen.tsx` — paste a VTT or (if Graph is wired and the
ids are set) trigger a fetch → `client.invoke('processTranscript', { meetingId, payload })`.

1. `Meeting::process_transcript` → `process_transcript_impl` (hand-written) →
   `services::meeting_transcript::process_transcript`.
2. `require_user`. Load the `Meeting` row.
3. **Obtain the VTT**: `payload.vtt` present → use it verbatim (`"manual_paste"`).
   Else → require `graph_online_meeting_id` + `graph_transcript_id`, build a
   `GraphClient`, `client.read(ReadOperation::GetOnlineMeetingTranscript { ... })`
   (`"graph_read"`).
4. `vtt_to_text(vtt)` — strip `WEBVTT`, `hh:mm:ss --> hh:mm:ss` timing lines, cue
   numbers, and `NOTE` / `STYLE` blocks; join the spoken lines.
5. `ai_extraction::extract_meeting_insights(data_access, user, meeting_id, text)`
   — PHI gate → OpenAI (`MEETING_INSIGHT_FIELDS`). Returns the raw `Result`.
6. Map the result to `(bpmn_status, summary, decisions, action_items,
   agenda_items, contains_process_flow, process_name, ai_error)`:
   - `Ok` → `bpmn_status = "ai_complete"`, fields populated.
   - `Err(PhiBlocked)` → `bpmn_status = "ai_blocked_phi"`, an explanatory
     `error_message`, **transcript still kept**.
   - `Err(other)` → `bpmn_status = "ai_failed"`, `error_message = e`.
7. `update_item` on the `Meeting`: `transcript_vtt`, `transcript_text`,
   `status = transcript_captured`, plus the AI fields / `bpmn_status`.
8. `audit::record(... "TRANSCRIPT_CAPTURED" ...)`.
9. Return `{ transcript_source, transcript_chars, bpmn_status, status, version }`.

There is **no automatic trigger** for this on meeting end — see the gap note in
6.8.

---

## 7.10 The audit trail screen

Frontend: `AuditScreen.tsx` → `client.queryList(auditEventEntity, { sort: [{ field:'performed_at', direction:'desc' }] })`.

1. `queryAuditEvents` (generated) → `DataAccess::query_items` →
   `audit_event.rego` — read allowed for `admin` / `epmo`, everyone else denied
   or filtered.
2. Returns the append-only `AuditEvent` rows (the semantic events from every
   `audit::record` call across the workflow engine). `AuditEvent` has no
   Update/Delete standard methods, so this is a true history.

For the row-level, hash-chained `<entity>_audit` trail (the facet), the framework
**admin UI** at `/admin` has an "audit timeline for this record" view
(`backend/src/admin_ui.rs::load_audit_timeline` → `DataAccess::query_audit_events`).

---

Next: the file-by-file reference chapters, starting with
[`08-backend-files.md`](08-backend-files.md).
