# 6. The workflow / gate engine

> ℹ️ **History (2026-09-09):** these custom methods — `eligibleGates`,
> `workspace`, `pendingApprovals`, `submitDecision` — were broken against the
> re-adopted framework (the services passed a stale array `sort` shape and an
> over-limit page size). **Fixed in the service layer and re-verified live**;
> details in [chapter 13](13-verification-log.md).

This is the custom heart of the application — the part that is **not** generated.
It lives in [`backend/src/services/`](../../backend/src/services/) and is owned by
feature spec 002. Read the file header of
[`services/mod.rs`](../../backend/src/services/mod.rs) for the one-line index; this
chapter expands it.

---

## 6.1 The domain in plain words

A **project** is proposed. Before it can proceed it must pass through a series of
**gates** — reviews by committees (BTA, EPMO, EAC, PIC, TRC, Security, CAB, …),
some in sequence, some in parallel. Each gate has:

- a **stage definition** (the template: its code, its position, what must be done
  before it),
- a **stage** or **submission** (the live instance for one project),
- a **review / approval** (the decision a committee records).

The engine answers three questions:

1. **Which gates can this project work on right now?** → `gate_eligibility.rs`
2. **Move this gate through its lifecycle** (start → submit → decide/skip) →
   `transition.rs`, `gate_review.rs`, `approval_state_machine.rs`
3. **What happened, and who needs to know?** → `audit.rs`, `notification.rs`

---

## 6.2 The pieces (files under `services/`)

| File | Role | Key public functions |
|------|------|----------------------|
| `support.rs` | shared helpers used by every other service | `require_user`, `has_role` / `has_any_role`, `primary_role`, `entity` (look up an `EntityType`), `field` / `selection` (build a GraphQL selection-set as JSON), `resolve_user_id` (map the JWT username → `users.id`) |
| `gate_eligibility.rs` | evaluate the seeded DAG | `compute(project_id)` → per-stage `SATISFIED` / `ELIGIBLE` / `LOCKED` |
| `transition.rs` | lifecycle of a `WorkflowStage` + gate-form upsert | `start`, `submit`, `skip`, `save_stage` |
| `gate_review.rs` | record a committee's decision on a `GateReview` | `decide(gate_id, payload)` |
| `approval_state_machine.rs` | the sequential `ProjectApproval` chain | `submit_decision`, `pending_approvals`, `fast_track_complete`, `cancel` |
| `workspace.rs` | assemble one screen payload | `assemble(project_id)` |
| `audit.rs` | append a semantic `AuditEvent` | `record(...)` + the event-name constants |
| `notification.rs` | fan out `Notification` rows | `notify_user`, `notify_role` |
| `directory.rs` | live MS Graph org-directory search (attendee picker) | `search_directory(query)` |
| `meeting_scheduling.rs` | governed Graph writes for a `Meeting` | `schedule_via_graph`, `cancel_via_graph` |
| `meeting_transcript.rs` | `Meeting.process_transcript` orchestration | `process_transcript(meeting_id, payload)` |
| `graph/**` | the MS Graph client + G1 governed-write stack | `GraphClient::read`, `writes::execute` |
| `ai_extraction/**` | the OpenAI egress boundary + PHI gate | `extract_intake`, `extract_team_fields`, `extract_meeting_insights` |

Every one of these is called from a thin `_impl` function in
`backend/src/handlers/governance/<entity>.rs`, which is itself called by the
generated GraphQL handler. The chain is always:

```
GraphQL mutation  →  handlers/governance/mod.rs (generated)
                  →  handlers/governance/<entity>.rs  <name>_impl  (hand-written, ~1 line)
                  →  services/<something>.rs  (hand-written, the real logic)
                  →  DataAccess  (framework; runs Rego + tenant filter, then SQL)
```

---

## 6.3 How a service talks to the database

Services never write SQL. They call `DataAccess` methods with:

- an **`EntityType`** — `support::entity(data_access, "GateReview")?`
- a **selection set** as JSON — `selection("gate_review", &[field("id"), field("status"), …])`
  (the same shape the framework builds from a GraphQL query)
- a **filter** as JSON — `json!({ "project_id": { "_eq": project_id } })`
- the **user** — passed straight through so `DataAccess` can run the Rego policy

Typed results come back as `<Entity>Projection` (read shape). To write, the
service builds an `Input<Entity>` (copying every field, including `version` for
optimistic locking) and calls `create_item` / `update_item`.

Example (`gate_review::decide`, abridged):

```rust
let review_type = entity(data_access, "GateReview")?;                 // metadata
let review = data_access.find_item::<GateReviewProjection>(           // read
    review_type.clone(), review_selection(), gate_id.clone(), user.clone()
).await?.ok_or_else(|| anyhow!("gate review `{gate_id}` was not found"))?;

// service-layer ownership check (see 6.6)
let owns = has_role(&actor, "admin")
    || review.assigned_role.map(|r| role_str(r) == primary_role(&actor)).unwrap_or(false);
if !owns { return Err(anyhow!("only the assigned reviewer role or an admin may decide this gate")); }

let mut input = input_from(&review)?;                                 // read shape → write shape
input.status = Some(status_str.into());
input.decision = Some(decision);
input.decision_by_id = resolve_user_id(data_access, user).await?;
input.decision_at = Some(Utc::now());
let updated = data_access.update_item::<InputGateReview, GateReviewProjection>(…).await?;  // write

audit::record(data_access, user, review.project_id, "GateReview", &gate_id,
              audit::GATE_APPROVED, Some(json!({...}))).await?;         // semantic audit event
```

---

## 6.4 The eligibility engine (`gate_eligibility.rs`)

`compute(project_id)`:

1. Load **all** `WorkflowStageDefinition` rows (the 19 seeded stages), ordered by
   `sequence_order`.
2. Load the project's `GateSubmission` rows.
3. A submission is **satisfied** if its `decision` is `approved` **or** its
   `status` is `submitted`/`approved` (`is_satisfied`).
4. Build the set of satisfied stage codes.
5. For each stage definition:
   - read its prerequisite gate codes from `prerequisites.gates` (JSON),
   - `SATISFIED` if the stage itself is in the satisfied set,
   - else `ELIGIBLE` if **every** prerequisite is satisfied,
   - else `LOCKED`.
6. Return `{ project_id, provisional: true, eligible_count, gates: [ … ] }`.

**`provisional: true` is not a bug** — it's the honest marker that the DAG is the
legacy placeholder set, not the authoritative Excel gate matrix (open decision
**P5**). `conditions` (field-driven skip/applicability) are **not** evaluated
yet, also because of P5. Do not treat the stage codes as business-final.

---

## 6.5 The two state machines

### (a) `WorkflowStage` lifecycle — `transition.rs`

Status enum: `WorkflowStageStatus` = `LOCKED → ELIGIBLE → IN_PROGRESS →
PENDING_APPROVAL → APPROVED | CHANGES_REQUESTED | REJECTED | SKIPPED`.

| Function | Allowed from | Moves to | Side effects |
|----------|--------------|----------|--------------|
| `start(stage_id)` | `ELIGIBLE` or `CHANGES_REQUESTED` | `IN_PROGRESS` | sets `started_at`; audit `GATE_STARTED` |
| `submit(stage_id, payload)` | `IN_PROGRESS` | `PENDING_APPROVAL` | optional `notes`; audit `GATE_SUBMITTED` |
| `skip(stage_id, reason)` | anything except `APPROVED`/`SKIPPED` | `SKIPPED` | `reason` is **required**; `completed_at` set; audit `GATE_SKIPPED` |

Illegal transitions are rejected with a clear error (`"cannot start a stage in
status {cur:?} (must be ELIGIBLE or CHANGES_REQUESTED)"`).

`save_stage(project_id, stage, payload)` is separate: it **upserts** a
`GateSubmission` row for `(project_id, stage)` — creates it if missing, updates
otherwise — storing the form `data` JSON and `status`/`decision`. Audit
`GATE_SUBMITTED`.

### (b) `ProjectApproval` chain — `approval_state_machine.rs`

A project has an ordered list of `ProjectApproval` rows (`sequence_order`), each
addressed to a role. `submit_decision(project_id, payload)`:

1. `payload.decision` ∈ `approve` / `reject` / `needs_info` → target status
   `Approved` / `Rejected` / `Returned`.
2. Load all approvals for the project, ordered by `sequence_order`.
3. Find the **first `Pending`** approval that is either addressed to the actor's
   role, or the actor is **privileged** (`admin` or `epmo`).
4. If none → `"no pending approval addressed to your role for this project"`.
5. Update that row: `status`, `decision`, `comments`, `approved_by`,
   `approved_at`. Audit `GATE_APPROVED` / `GATE_REJECTED` / `GATE_RETURNED`.
6. **On approve**, find the next `Pending` approval by `sequence_order`; if one
   exists, `notification::notify_role(...)` its assigned role
   (`APPROVAL_REQUIRED`). If none exists, audit `WORKFLOW_ADVANCED` with
   `"all approvals complete"`.
7. Return `{ decision, status, next_stage, workflow_complete }`.

`pending_approvals(project_id)` — list the `Pending` approvals visible to the
actor (role-matched, or all if privileged).

`fast_track_complete(project_id)` — **admin only**. Auto-approves every pending
approval, sets `Project.status = COMPLETED`, audit `WORKFLOW_ADVANCED`
(`fast_track: true`).

`cancel(project_id, reason)` — **admin or epmo**. Sets `Project.status =
CANCELLED` + `workflow_status = "Cancelled"`, audit `PROJECT_CANCELLED`. This is
what "delete a project" means in this system (reconciled point 3 in
`000-INDEX.md`) — never a row delete, because that would cascade-destroy the
audit trail.

---

## 6.6 The authorization split (why some checks are in Rust)

Spec 001 owns the **Rego** layer. Spec 002's **service layer** enforces only what
Rego structurally *cannot* express as a single-row predicate.

| Kind of check | Where | Example |
|---------------|-------|---------|
| Role gate ("epmo can update any project") | **Rego** (`rbac/*.rego`) | `project.rego`: `input.action in ["update","delete"]; has_role(input.user,"epmo")` |
| Single-row owner filter ("a PM sees only their projects") | **Rego** filter | `project.rego`: `filter: {"manager_id": {"_eq": input.user.id}}` |
| Cross-row / parent-row ownership ("only the reviewer role assigned to *this gate's stage* may decide it") | **Rust service layer** | `gate_review::decide` compares `review.assigned_role` (which lives on the gate row) to the actor's `primary_role` |
| Sequential-chain routing ("only the *next pending* approval in the chain, addressed to your role") | **Rust service layer** | `approval_state_machine::submit_decision`'s `find(...)` on `sequence_order` + `status == Pending` + role match |
| Privileged override (`admin`, `epmo`) | **Rust service layer**, on top of the Rego pass | `has_any_role(&actor, &["admin","epmo"])` |

Both paths still go through `DataAccess`, so **every service write also runs the
entity's Rego policy** — there is no "service bypass." The Rego `create` rules
for `notification` and `audit_event` are written to allow any authenticated actor
precisely because the service (not the caller) chooses the row's owner (see the
comments in `notification.rego`).

This split depends on open decision **A**: does the runtime carry an actor *id*
(not just role)? If not, the Rego single-row filters degrade to role-only and
more scoping falls to the service layer.

---

## 6.7 Audit and notifications

### `audit.rs` — semantic events

`audit::record(data_access, user, project_id, entity_type, entity_id, action,
new_values)` inserts one append-only `AuditEvent` row. The `action` is one of the
named constants:

```
GATE_APPROVED  GATE_REJECTED  GATE_CHANGES_REQUESTED  GATE_STARTED
GATE_SKIPPED   GATE_SUBMITTED  WORKFLOW_ADVANCED       PROJECT_CANCELLED
```

plus the AI-extraction events (`AI_EXTRACTION_SUCCEEDED` / `_BLOCKED_PHI` /
`_FAILED`) and `TRANSCRIPT_CAPTURED`. `AuditEvent`'s `standard_methods` exclude
Update and Delete, so these rows can never be changed or removed through the API.

This is **distinct from** the `audited` facet (chapter 5.5), which records
row-level CRUD diffs via a DB trigger into `<entity>_audit` tables with a
tamper-evident hash chain. Both run.

### `notification.rs` — in-app fan-out

- `notify_user(recipient_id, …)` — one row.
- `notify_role(role, …)` — query every **active** user with that role, insert one
  `Notification` per user. `role` is the SCREAMING_SNAKE enum value (`"EPMO"`).

The SPA's `NotificationsScreen` reads them; `Notification.rego` lets a recipient
read/mark-read only their own (`recipient_id == input.user.id`).

---

## 6.8 The Microsoft Graph integration (spec 003)

Optional — active only when `GRAPH_*` env vars are set.

### Reads — `graph/` client

`graph/mod.rs` header: *"There is no generic `get(path)` / `post_json(path)`
surface: every call goes through an allow-listed named operation."*

- `graph/identity.rs` — the pinned Graph base URL.
- `graph/auth.rs` — env-var auth contract, token acquisition, redaction
  constants.
- `graph/registry.rs` — `ReadOperation` enum: the allow-listed reads
  (`SearchDirectoryUsers`, `GetOnlineMeetingByJoinUrl`,
  `GetOnlineMeetingTranscript`, `CheckOrganizerAvailability`, …).
- `graph/request.rs` — builds a safe request plan (fixed path + escaped
  segments, never string concatenation).
- `graph/response.rs` — rate-limit / error classification, redacted payloads.
- `graph/client.rs` — the executor. `GraphClient::read(op)` is the **sole**
  outbound GET path.
- `graph/vendor_contract.rs` — honest per-operation status tiers. **Nothing is
  `live_certified`.**

### Writes — the "G1" governed-write stack (`graph/writes.rs`)

`writes::execute(data_access, ctx, op, resource_id, idempotency_key)` is the
**only** function that can issue a non-GET request to `graph.microsoft.com`. It
runs eight components in order before touching the network:

| # | Component | What it does here |
|---|-----------|-------------------|
| G1.1 | GovernedWriteEnforcement | this module is the only mutation path |
| G1.2 | DelegatedActorContext | `WriteContext::from_user` carries the acting human (Graph itself only sees the app credential) |
| G1.3 | TokenStoreIsolation | writes use a **distinct** app registration from reads |
| G1.4 | NamedMutationRegistry | `WriteOperation` enum — allow-listed, no caller-chosen endpoint |
| G1.5 | MutationRequestBinding | typed `plan()` (method + escaped path) and `body()` (typed JSON, never a caller merge) |
| G1.6 | IdempotencyAndReplayProtection | `sha256(operation ‖ sorted bound params)` → checked against the `graph_write_attempts` ledger **first**; a double-clicked "Schedule" collapses to one meeting |
| G1.7 | WritePolicyAndScopeEnforcement | `policy_check` — role + tenant gate, per `policy_action()` |
| G1.8 | WriteAuditAndEvidence | an `AuditEvent` **and** a ledger row for every outcome |

`WriteOperation` variants: `ScheduleCalendarEvent` (the wired path — a calendar
event that also emails invites), `ScheduleTeamsMeeting` (a bare join link, no
calendar — registered but not wired), `CancelOnlineMeeting` / `CancelCalendarEvent`,
and `CreateSubscription` / `RenewSubscription` / `DeleteSubscription` /
`SharePointUpload` (registered, no handler entry point — the subscription ones
need a public HTTPS callback this environment lacks; SharePoint is undecided).

### Meeting orchestration

- `meeting_scheduling::schedule_via_graph` — resolve organizer/subject/times/
  attendees from the `Meeting` row + payload, call `writes::execute` with
  `ScheduleCalendarEvent`, then persist `graph_event_id`, `graph_online_meeting_id`
  (resolved from the join URL), `join_url`, `attendees`, `status = graph_scheduled`.
- `meeting_scheduling::cancel_via_graph` — organizer + resource id come from the
  `Meeting` row **only**, never the caller. Prefers `CancelCalendarEvent`
  (`graph_event_id`) else `CancelOnlineMeeting`.
- `meeting_transcript::process_transcript` — (1) obtain the VTT: a pasted `vtt`
  in the payload **or** a governed Graph read (`GetOnlineMeetingTranscript`);
  (2) `vtt_to_text` strips WEBVTT headers/timings/NOTE blocks; (3) hand to
  `ai_extraction::extract_meeting_insights` (PHI gate → OpenAI); (4) persist
  `summary`/`decisions`/`action_items`/`agenda_items`/`bpmn_status` +
  `status = transcript_captured`. A PHI-blocked or failed extraction still keeps
  the transcript — only the AI step is skipped, recorded in `bpmn_status`
  (`ai_blocked_phi` / `ai_failed`).

**Known gap** ([`docs/architecture/meeting-graph-gaps.md`](../architecture/meeting-graph-gaps.md)):
there is no trigger that auto-processes a transcript when a meeting ends. It only
runs via the manual `processTranscript` mutation. The tenant-wide Graph
subscription + webhook + renewer that would automate it are **not built**;
`graph_subscriptions` is empty and there is no `tokio::spawn` anywhere.

---

## 6.9 The AI extraction boundary (spec 004)

`services/ai_extraction/` — the **only** place in the codebase that calls OpenAI.

Pipeline for all three entry points:

```
text  ─►  phi_gate::scan(text)  ──finds anything──►  REFUSE (audit AI_EXTRACTION_BLOCKED_PHI)
              │ clean
              ▼
       OpenAiConfig::from_env()  ──unset──►  fail (audit AI_EXTRACTION_FAILED, reason "not_configured")
              │ configured
              ▼
       openai_client::extract_structured(cfg, text, field_descriptions)
              │
              ▼
       audit AI_EXTRACTION_SUCCEEDED  ─►  return the structured JSON
```

- `phi_gate.rs` — `scan(text)` looks for SSN-, MRN-, DOB-, patient-name-shaped
  values and contact details. **If it finds anything, nothing is sent.** This is
  a pre-egress gate: the protection is "don't transmit", not "redact".
- `text_extract.rs` — decodes an uploaded/pasted document to plain text. `.txt`
  is decoded directly; PDF via the pure-Rust `pdf-extract` crate; `.docx` is
  **not supported yet** (documented limitation).
- `openai_client.rs` — the single HTTP call. Model from `OPENAI_MODEL` (`.env`
  has `gpt-4o`).
- `mod.rs` — the three entry points:
  - `extract_intake(payload)` — pre-fill the intake form. No project id (no
    project exists yet). Field list in the `INTAKE_FIELDS` constant, which must
    stay in sync with `frontend/.../intake/IntakeScreen.tsx`'s `Draft` interface.
  - `extract_team_fields(project_id, team, payload)` — pre-fill one of the
    bespoke gate-review forms (`epmo`, `bta`, `eac`, `finance`, `pic`). Field
    lists per team in `team_fields(...)`, matching each
    `frontend/.../workspace/forms/*ReviewForm.tsx`.
  - `extract_meeting_insights(...)` — called by `meeting_transcript`; summarises
    a transcript. Returns the raw `Result` (not the `outcome_json` wrapper) so
    the caller can record different `bpmn_status` values.

Every outcome — success, PHI block, failure — is written to `AuditEvent` as
retained evidence.

---

Next: [`07-request-flows.md`](07-request-flows.md) traces these paths end to end.
