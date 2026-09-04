# Spec 002 — Gate / Workflow Engine

> **Status (M12): `accepted-pending-decisions`.** Implemented as the M8 engine in `backend/src/services/` (`approval_state_machine`, `gate_eligibility`, `gate_review`, `transition`, `workspace`, `audit`). Open decisions P5 (gate matrix), Q7, A, B(Q5) block full fidelity — see `000-INDEX.md` and `../../HANDOFF.md` §8.

- Spec type: **Full** (file 07 §7.2 — product workflow, business rules, generated boundary, audit).
- Schema: `governance` (product) on data source `pg_primary`. Framework schema `system`. Single-tenant.
- Depends on: Spec 001 (model + scaffold baseline). Blocks: Spec 003 (Teams meetings), Spec 004 (AI autofill).
- Related legacy source (READ-ONLY reference, not code to port): `Project-Governance/backend/src/services/{project_service.rs, workflow_engine.rs, gate_review_service.rs, workspace_service.rs, dashboard_service.rs}`, `backend/src/domain/workflow_conditions.rs`, `backend/src/graphql/{query.rs, mutation.rs, workflow_types.rs}`, `backend/src/routes.rs`, `governance_workflow_design.md`, `skill.md`.

---

## Business value

PDS Health runs every capital/technology project through a five-phase governance lifecycle (Intake → Review → Design → Operations → Stakeholders). Today that lifecycle is expressed three incompatible ways in the legacy code (see Risks) and is effectively a hard-coded linear approval chain (`project_service::submit_decision`: EPMO → BTA → Finance → EAC → PIC → TRC). The design intent (`governance_workflow_design.md` §1, §3, §22, §26) is explicitly the opposite: **a configurable gate-eligibility engine, not a hard-coded 19-step wizard.** Gates carry prerequisites, conditions, optional parallelism, and skip-with-reason; humans make every governance decision; AI only assists; and every meaningful transition is written to immutable audit history.

This spec defines that engine as **net-new product code** on the framework's generic extension points (entity `custom_methods` + `backend/src/services`, wired through the mandatory `generated route → generated handler → human-owned `_impl` → service → DataAccess` pattern — file 03 "Enterprise Extension Pattern"). There is no workflow/case-engine primitive in the framework (file 00 ground rule 5; file 01 §1.4 note) — we are not adopting one, we are building one.

Outcome the spec improves the decision on: whether the rebuild keeps config-as-data (workflow/gate definitions as `.appfw/model` rows driving a runtime engine) or re-hard-codes the chain in Rust. Recommendation: config-as-data (Options A).

---

## Scope

### In scope

**1. The gate state machine.** Adopt the `governance_workflow_design.md` §7 model as the gate/stage status vocabulary:

```
LOCKED ──prereqs+conditions met──▶ ELIGIBLE ──user starts──▶ IN_PROGRESS ──submit──▶ PENDING_APPROVAL
   │                                                              ▲                        │
   │ conditional gate, condition false                            │ CHANGES_REQUESTED      ├─▶ APPROVED ─▶ (recompute eligibility)
   └───────────────────────▶ SKIPPED (recorded reason)            └────────────────────────┤
                                                                                          └─▶ REJECTED
```

Enum `WorkflowStageStatus` values: `LOCKED, ELIGIBLE, IN_PROGRESS, PENDING_APPROVAL, APPROVED, CHANGES_REQUESTED, REJECTED, SKIPPED`. This is **the original migration-0001 DDL vocabulary** (`locked, eligible, in_progress, pending_approval, completed, skipped, rejected, changes_requested`) with `completed` renamed `APPROVED` — not a novel enum. See Open decisions Q7. Landing place: `.appfw/model/schemas/governance/gql_enum_types/*.yaml` (file 02 §4).

Behavioral rules the engine must enforce (from `skill.md` §14–15, `governance_workflow_design.md` §7):
- A gate cannot enter `PENDING_APPROVAL` while any prerequisite gate is not `APPROVED`/`SKIPPED` or any condition is unmet.
- `CHANGES_REQUESTED` returns the gate to `IN_PROGRESS`, preserves the prior submitted payload as a revision, and does **not** unlock the next gate. Only `APPROVED` unlocks / recomputes downstream eligibility.
- `LOCKED → SKIPPED` requires a recorded reason and is only legal for a gate whose applicability condition evaluated false.
- On `APPROVED`: record approval, write audit event, notify owner, recompute eligible gates, create the next gate's required task(s), trigger stage AI preparation (Spec 004 owns the mechanics).

**2. The five phases and their gate composition** (from `governance_workflow_design.md` §5, marked *pending P5* wherever field-exact). Phases are containers; gates within a phase are **not** assumed serial beyond configured prerequisites (`governance_workflow_design.md` §5.1, §8, §22):

| Phase | Gate composition (design-doc level; exact list + inter-gate deps pending P5) |
|---|---|
| Intake | Intake Submission, PPMO/EPMO Review, BTA Review, DTL Review |
| Review | Security Review Decision, Contracting Review Decision, Required-Document Determination |
| Design | Ownership & Leads, Tiering, Architecture/EAC, CoE, BCM, DR, Service Transition planning (each "where applicable") |
| Operations | Business Case, Vendor Risk Assessment (VRA), Vendor Contract Request (VCR), Service Transition, Operational Readiness, CAB preparation |
| Stakeholders | PPMO/DTL/BTA, BAA/NDA, PIC Executive Decision, EAC/TRC Approval, CoE Approval, UAT Sign-off, Service Transition, Training Plan, Deployment Plan, CAB / final operational decision |

Skip / conditional applicability (e.g. "no vendor → skip VRA/VCR"; "security not required → skip SRA") is **design-intent, not in current code** — propose for the engine. Parallel gates within a phase are **design-intent, not in current code** — propose for the engine. Legacy `EligibilityEngine` (`workflow_engine.rs`) already evaluates AND/OR condition trees against a `{fields, gates, phases}` context but is **not wired to any route** — reuse its `workflow_conditions.rs` grammar.

**3. `custom_methods` to declare.** Derived from the operations that actually exist in legacy code (REST routes in `routes.rs`, GraphQL in `mutation.rs`/`query.rs`). All `mcp_enabled: false` (MCP disabled this project). None carry a `provider_routine`, so the generator emits a one-time `<name>_impl` stub in `backend/src/handlers/governance/<entity>.rs` per entity, which we then hand-write (file 02 §2 "stub-vs-no-stub").

| Entity | Method | kind | args (`{name, arg_type}`) | return_type | Replaces (legacy) |
|---|---|---|---|---|---|
| `Project` | `submit_decision` | Mutation | `project_id: String`, `payload: serde_json::Value` | `serde_json::Value` | `POST /projects/:id/submit-decision` → `project_service::submit_decision` (the EPMO→…→TRC state machine) |
| `Project` | `pending_approvals` | Query | `—` (actor-scoped) | `serde_json::Value` | `GET /projects/approvals/pending` → `project_service::get_pending_approvals`; also feeds `dashboard_service` |
| `Project` | `fast_track_complete` | Mutation | `project_id: String` | `serde_json::Value` | `POST /projects/:id/fast-track-complete` → `project_service::fast_track_complete` (admin-only) |
| `Project` | `workspace` | Query | `project_id: String` | `serde_json::Value` | `GET /projects/:id/workspace` → `workspace_service::get_workspace` |
| `Project` | `eligible_gates` | Query | `project_id: String` | `serde_json::Value` | **new** — recompute + return eligibility (design §22; no current endpoint, `EligibilityEngine` exists unwired) |
| `GateSubmission` | `save_stage` | Mutation | `project_id: String`, `stage: String`, `payload: serde_json::Value` | `serde_json::Value` | `POST /projects/:id/workspace/:stage` → `workspace_service::save_stage` |
| `GateReview` | `decide` | Mutation | `gate_id: String`, `payload: serde_json::Value` | `serde_json::Value` | `POST /gate-reviews/:id/decision` → `gate_review_service::submit_gate_decision` |
| `WorkflowStage` | `start` | Mutation | `stage_id: String` | `serde_json::Value` | GraphQL `startGate` → `TransitionService::start_gate` |
| `WorkflowStage` | `submit` | Mutation | `stage_id: String`, `payload: serde_json::Value` | `serde_json::Value` | GraphQL (no resolver, `submit_gate` exists) → `TransitionService::submit_gate` |
| `WorkflowStage` | `skip` | Mutation | `stage_id: String`, `reason: String` | `serde_json::Value` | GraphQL `skipGate` → `TransitionService::skip_gate` (this **is** design §7 `LOCKED→SKIPPED with reason` — in code, not design-intent) |

`arg_type` values are held to the shapes the rulebook demonstrates (file 02 §2 examples): ids as `String`, payloads/return as `serde_json::Value`. No `Uuid` arg types.

Standard-operation overrides (mark `appfw: override-standard` in the handler impl — file 01 §1.4):
- `Project` "delete" — legacy `delete_project` performs a **status transition** (`status = CANCELLED`, one of the `project_status` enum values), **not** a soft-delete flag. So this is *not* the `soft-deleted` facet (which injects a separate `is_deleted: Boolean`). Model it as either (a) omit `Delete` from `Project.standard_methods` and expose a `Project.cancel` custom method (Mutation, `project_id: String`, `reason: String`), restricted to `{admin, epmo}` — **recommended**; or (b) an `override-standard` `Delete` impl that does the status transition. Reconcile with spec 001 (its `Project` row treats delete as "soft cancel, model as a custom method or restricted update"). The `soft-deleted` facet + its §10 `[ASSUMPTION]` only apply if a *true* soft-delete is later wanted for some other entity.

**4. `backend/src/services` module layout** (product-owned, file 01 §1.4). Modules under `backend/src/services/` (design-doc §19 nests these under `services/governance/`; flatten or nest per Spec 001's convention):

| Module | Owns |
|---|---|
| `gate_eligibility` | Recompute a project's gate set: evaluate prerequisites (`required_gates`) + condition trees (`workflow_conditions.rs` grammar) against the `{fields, gates, phases}` context; produce `LOCKED / ELIGIBLE / SKIPPED(reason)`. Port of `EligibilityEngine`, wired. |
| `approval_state_machine` | The decision transitions: which role owns the current gate, `approve / reject / needs-info / changes-requested`, advancement, revision/version creation on `CHANGES_REQUESTED`, `fast_track_complete`. Re-expression of `submit_decision` + `gate_review_service` against DataAccess. |
| `transition` | Per-gate lifecycle writes (`start / submit / skip / approve`) on `WorkflowStage`; guards illegal transitions. Re-expression of `TransitionService`. |
| `field_rules` | Per-gate required/conditional/validation/label resolution from the field dictionary; "which fields are editable at this gate". **Skeleton only — pending P5.** |
| `notification` | Fan-out on the events in `governance_workflow_design.md` §21 (task assigned, gate eligible, pending approval, changes requested, approved/rejected, overdue, …). Re-expression of `services/support::notify_*`. |
| `audit` | Emit semantic governance events (`GATE_APPROVED`, `GATE_SKIPPED`, `WORKFLOW_ADVANCED`, … — design §18) to a product-owned `AuditEvent` entity. Distinct from the framework `audited` facet (record-level CRUD diffs). Re-expression of `services/support::record_audit`. |

**5. Endpoints / GraphQL operations replaced.** All of legacy `graphql/query.rs` + `graphql/mutation.rs` (hand-written `QueryRoot`/`MutationRoot`) are replaced by generated CRUD + the `custom_methods` above. The REST routes in `routes.rs` for projects/workspace/gate-reviews/dashboard/notifications/audit become generated routes + custom-method routes. `process_transcript` (GraphQL) moves to Spec 003.

### Boundary of this spec
`.appfw/model` mirrors the FULL current data model (~24 tables incl. unwired — scope ceiling per shared decisions). This spec only defines **human-owned services for the wired workflow/gate subset**. Entity/property/relationship YAML authoring is Spec 001's surface; this spec states which entities carry which `custom_methods` and `.rego`, not their full column lists.

---

## Non-goals

- **Hand-writing GraphQL resolvers.** Legacy `graphql/query.rs` + `mutation.rs` are deleted, not ported. CRUD is generated; bespoke behavior is `custom_methods`.
- **A BPMN / flow-engine dependency.** No external workflow engine (file 00 — none exists in the framework). The legacy `generate_bpmn` path is not carried forward here.
- **Hard-coding inter-gate dependencies** the business has not confirmed (`governance_workflow_design.md` §22: not "PIC before TRC", not "every project needs VRA/CAB", not "deployment is a gate"). Dependencies live in workflow config, added once P5 confirms them.
- **The risk engine internals** (`governance_workflow_design.md` §12) — continuous risk gets its own spec/section. This spec only notes that risk flags feed gate conditions.
- **Teams meeting integration** (Spec 003) — though the workflow attaches meetings to gates and a gate decision may wait on a meeting outcome.
- **AI autofill mechanics** (Spec 004) — though `APPROVED` triggers stage AI preparation and `field_rules` supplies the target field set.
- **Frontend** — workspace/dashboard/review screens are a frontend spec.

---

## Contracts touched

- **File 01 §1.4** — custom-method `_impl` stubs are **create-once, human-owned, preserved forever**. One `<entity>.rs` file per entity under `backend/src/handlers/governance/`. Intentional standard-operation overrides (`Project.Delete`) marked `appfw: override-standard`.
- **File 01 Edit Surface Matrix** — rows used: "Add or change an entity, property, enum, seed, test, or relationship" → `.appfw/model`; "Implement app-specific custom behavior" → `backend/src/handlers/<schema>/<entity>.rs` + `backend/src/services`; "Change access-control behavior" → Rego + `rego_test`.
- **File 02 §2** — `custom_methods` grammar: `name`, `kind` ∈ `Query|Mutation|Command`, `args` `{name, arg_type}`, `return_type`, `mcp_enabled` (all `false`), optional `provider_routine` (**none used**). File 02 §2 "stub-vs-no-stub": no `provider_routine` ⇒ generator emits `<name>_impl` stub returning `"not implemented yet"` on first `generate`; our hand-edit of that stub is permanent.
- **File 02 §4** — `WorkflowStageStatus` authored as a `gql_enum_types` file.
- **File 02 §5** — every table entity needs its own hand-written `.rego` (`access := res if {...}` bodies only). New workflow entities each need one: `WorkflowStage`, `GateSubmission`, `GateReview`, `AuditEvent` (+ `AuditEvent` audit sub-entity if `audited`). Single-tenant: policies never call `tenant_filter`; roles read from the one-element `roles: []` array projected at the auth boundary.
- **File 03 ADR 0001 (Query IR)** — all filter/sort/mutation/aggregation in the services goes through the typed plans (`FilterAst`, `QueryPlan`, `MutationPlan`, …) via `DataAccess`. **No ad-hoc SQL.** The legacy sea-orm `find().filter(...)` calls are re-expressed, not copied. Query cost budgets apply once at the shared boundary.
- **File 03 ADR 0004 (Audit)** — append-only; the product `AuditEvent` entity's `standard_methods` must **exclude `Update` and `Delete`**. The `audited` facet (record-level) is a separate mechanism; use both.
- **File 03 Enterprise Extension Pattern** — `generated route → generated handler → human-owned impl → service → DataAccess`. Engine logic lives in `services`, never in `handlers/<schema>/generated.rs`, never in a route.
- **File 07** — this is a Full spec; handoff names its path + status.

Authorization split (state explicitly so a file-12 reviewer does not assume Rego covers it). **Spec 001 owns the Rego layer; this spec owns only what Rego cannot express:**
- **Rego (spec 001)** = role/action access per entity **plus every single-row-column row filter** — `projects.manager_id == actor`, `project_approvals.assigned_role == actor role`, `gate_reviews.assigned_role == actor role`, `notifications.user_id == actor`. These are Hasura filters at the Query IR boundary (file 03 ADR 0001) and apply to every data path. `.rego` role string literals follow spec 001's **lowercase** convention (see spec 001 §"Interim role-string casing convention").
- **Service layer (this spec)** = only ownership Rego *structurally cannot* express as a single-row predicate: `project.current_owner_role == actor role` when the row being accessed is a *child* (a `GateSubmission` / `WorkflowStage` whose owning role lives on the parent `Project`), current-gate routing, and admin override on those. Enforced in `approval_state_machine` / `transition` / `GateReview.decide` impls.
- Both layers depend on **spec 001 Open decision A** (actor identity in `input.user`): if no actor id is exposed, spec 001's single-row filters degrade to role-only and more record scoping falls to this service layer — noted, not silently absorbed.

---

## Options considered

**Workflow configuration model**

- **(A) `.appfw/model` entities driving a runtime engine in services — RECOMMENDED.** `WorkflowDefinition` / `WorkflowStageDefinition` (with `phase_name`, `prerequisites`, `conditions`, `parallel_execution`, `auto_advance`, `sla_days`, `checklist_template` — all already columns in the legacy entity) are config-as-data rows; `WorkflowInstance` / `WorkflowStage` are the per-project run; the engine (`gate_eligibility` + `transition` + `approval_state_machine`) is human-owned service code reading that config through DataAccess. Keeps config-as-data (file 01 §1.1), engine readable/testable/regeneration-safe. Matches `governance_workflow_design.md` §22–§26.
- **(B) Hard-coded phase/gate constants in Rust.** Rejected — `governance_workflow_design.md` §26 ("configurable engine, not a hard-coded 19-step wizard"); this is what the legacy `STAGE_ORDER` array and `submit_decision` match ladder already do and what the rebuild exists to remove.
- **(C) External workflow engine.** Rejected — none exists in the framework (file 00 ground rule 5); adding one is out of scope and contradicts the extension model.

**`project_number` generation** (framework `computed:` enum `Concatenate|Format|Word|Inflection|DateTimeNow|None` has no sequence option; the `project_number_seq` DB sequence exists but is unused — legacy `generate_project_number` counts rows app-side):

- **(a) A vetted `provider_routine` of `kind: Function`, `returns: One`** returning the next `GOV-<year>-<nnnnn>` value. DB-portable, keeps generation out of app code — but adds a routine to author, vet, and certify (`StoredRoutineInvocation` contract area).
- **(b) Generate in the human-owned `Project` Create `_impl` — RECOMMENDED for now.** Simplest; one `custom_methods`/override already in human-owned territory; uses the existing `project_number_seq`. Revisit if multi-provider portability becomes a requirement.

---

## Risks and controls

| Risk | Control |
|---|---|
| **P5 absent — three incompatible gate vocabularies in-repo, no authority to choose.** `project_service` uses EPMO/BTA/Finance/EAC/PIC/TRC; `workspace_service::STAGE_ORDER` uses `sra_dfd/vcr_vra/eac/trc/cab/st_runbook/pic`; `skill.md` lists Excel gate columns VCR/VRA/EAC/PIC/Intake-TRC/TRC/Intake-SRA/SRA/CAB-CT/CAB-ER. The authoritative Excel field/gate matrix (`governance_workflow_design.md` §9/§22: "do not invent or rename business fields") is not in the repo, so per-field `field_code/gate/type/required/conditional/options/validation/ai_fillable/source` and the exact gate list + dependencies cannot be finalized. | Scope field-rules and gate-config portions as **"pending P5"**. Build first: the engine skeleton (state machine, eligibility evaluation, transition guards, audit, notifications) + a **generic** workflow config seeded from one of the three vocabularies as a placeholder, clearly marked provisional. `field_rules` ships as a skeleton. No business field names are invented. |
| `project_service.rs` is ~980 lines of business rules — **reference, not code to port.** Copying it re-imports ad-hoc sea-orm queries, the camelCase↔snake_case remap hacks, the enum-cast workarounds, and the hard-coded ladder. | Re-express as services against DataAccess / Query IR (ADR 0001). Each transition rule becomes a documented unit; the hard-coded stage ladder becomes config lookups. |
| **Circular FK** `workflow_instances.current_stage_id ↔ workflow_stages.id` (migration 0001 adds the FK after both tables exist). | Model `workflow_instances → workflow_stages` as a single `OneToMany` relationship (the real containment). Keep `current_stage_id` as a **plain scalar `Uuid` with no `foreign_key` block** — do not author a second relationship for it. (`OneToOne` also has no worked example in the framework — file 02 §3 `[TBD]` — a second reason to avoid it.) Flag for the relationship-authoring milestone in Spec 001. |
| Engine logic landing in the wrong layer (route or `generated.rs`). | Mandatory `route → handler → _impl → service → DataAccess`; verified by `scripts/appfw product boundary-check --json`. |
| Audit gap: the `audited` facet gives record-level before/after diffs, but design §18 wants **semantic** events (18 named types). | Use both (this is plan Q5 / spec 001 Open decision B — identical position): (1) `audited` facet on the regulated mutated entities `Project`, `GateReview`, `ProjectApproval`, `Attachment`, `User`, `GateSubmission` for record-level diffs + hash chain; each gets a read-only `<entity>_audit.rego` in spec 001's checklist. (2) The legacy `audit_history` table → entity **`AuditEvent`** (append-only; `standard_methods` exclude `Update`/`Delete` per ADR 0004), written **only** by the `audit` service for the ~18 named governance events + login/non-entity events. |
| "Stale version fails" is free only for **generated** `Update` (the `concurrency` facet's `"invalid key or version"`). `submit_decision` / `save_stage` / `decide` are custom mutations and get nothing for free. | Custom mutations that write an entity carrying the `concurrency` facet must read-check-write `version` inside the service and return the same conflict error. State this in each `_impl`. |
| Comprehensive review required (file 08 §8.6 — workflow engine core rules are "human path"). | Do not default to focused review; run `/product-pr-review --comprehensive` before any push. |

---

## Acceptance evidence

Docs-only golden path; the framework CLI cannot run now. These are the commands that **will** prove the change when the CLI is available (file 07 §7.4):

- `scripts/appfw product validate --json` — clean; no `custom_method` / enum / relationship / rego lints (file 02 §9).
- `scripts/appfw product generate` then `git diff` — each `_impl` stub appears **once**, in `backend/src/handlers/governance/<entity>.rs` (one file per entity, not per method).
- `scripts/appfw product generate --check --json` — clean (a second `generate` yields no diff; no drift).
- `scripts/appfw product boundary-check --json` — engine code is in `services` / human-owned handler impls only; nothing in `generated.rs` or routes.
- `scripts/appfw product test` — unit coverage for `gate_eligibility` (prereq + condition-tree evaluation), `transition` (illegal-transition guards), `approval_state_machine`.
- `scripts/appfw product api-test` — chained scenarios (file 02 §6 grammar): `create Project → submit_decision(approve) → pending_approvals reflects next stage → decide → eligible_gates recomputed`; plus a negative chain: `submit_decision` on a gate with an unmet prerequisite → error.
- `scripts/appfw product policy-test` — `.rego` for each new workflow entity resolves to `{allow, filter}`; no redefinition of `has_role`/`has_any_role`/`tenant_filter`.

Behavioral checklist (must all hold):
1. A gate cannot enter `PENDING_APPROVAL` while any prerequisite gate is not `APPROVED`/`SKIPPED` or any condition is unmet.
2. `CHANGES_REQUESTED` returns the gate to `IN_PROGRESS`, preserves the prior submitted payload as a revision, and does not unlock the next gate.
3. `LOCKED → SKIPPED` is rejected without a recorded reason and only legal when the applicability condition is false.
4. Only the assigned owner role (or admin) can decide a gate; a wrong-role decision is `Forbidden`.
5. A stale `version` on any entity update — generated `Update` **and** the custom workflow mutations — fails with `"invalid key or version"`.
6. Every meaningful transition (`GATE_STARTED`, `GATE_SUBMITTED`, `GATE_APPROVED`, `GATE_REJECTED`, `GATE_SKIPPED`, `WORKFLOW_ADVANCED`) writes an append-only `AuditEvent`.

---

## Open decisions

| # | Decision | Recommendation | Who decides |
|---|---|---|---|
| **P5** | The authoritative Excel gate/field matrix is not in the repo. Exact gate list, inter-gate dependencies, and per-field `field_code/gate/type/required/conditional/options/validation/ai_fillable/source` cannot be finalized. Three conflicting in-repo vocabularies (see Risks). | HARD prerequisite for completing `field_rules` and gate-config. Build the engine skeleton + a generic, explicitly-provisional workflow config now; scope field-exact work as "pending P5". Do not invent or rename business fields. | Human architect + business (IT Governance workbook owner), M3 checkpoint |
| **Q7** | `WorkflowStageStatus` values. Migration 0001 DDL = 8 lowercase (`locked…changes_requested`); entity layer later = 5 (`PENDING/ACTIVE/COMPLETED/SKIPPED/BLOCKED`); migration 0902 dropped the DB type and its own comment says a fresh build "must (re)create the enums with the new labels + a value mapping". | Adopt `LOCKED, ELIGIBLE, IN_PROGRESS, PENDING_APPROVAL, APPROVED, CHANGES_REQUESTED, REJECTED, SKIPPED` — the original 0001 vocabulary with `completed → APPROVED`. Neither later variant expresses the full gate state machine (`governance_workflow_design.md` §7); the engine is being rebuilt, so no migration cost. Author as a `gql_enum_types` file. | Human architect, M3 checkpoint |
| **project_number** | Framework `computed:` has no sequence option; `project_number_seq` exists but is unused. | (b) generate in the human-owned `Project` Create `_impl` using `project_number_seq` — simplest, already human-owned. (a) a vetted `provider_routine` Function is the portable alternative if multi-provider portability is later required. | Human architect, M3 checkpoint |

---

## Status

`draft`
