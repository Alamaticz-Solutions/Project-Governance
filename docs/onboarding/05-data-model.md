# 5. The data model

Everything the app stores and most of what it enforces starts as YAML under
[`.appfw/model/`](../../.appfw/model/). This chapter explains that folder and how
a change to it reaches the running database and API.

---

## 5.1 The shape of `.appfw/`

```
.appfw/
├── manifest.yaml            topology: data sources, Postgres schemas, ingress, UI packaging
├── appfw.lock*              (*at repo root, not here) framework provenance — chapter 3
├── model/
│   ├── _fragments/          reusable property templates ("a required string", "an enum", ...)
│   ├── _facets/             reusable entity-level behaviours ("audited", "has a version column", ...)
│   ├── _specs/CONFIG_CONTRACT.md   the config contract doc
│   ├── data_sources/_res.yaml      resolved data-source config
│   └── schemas/
│       ├── governance/      ← THE PRODUCT MODEL
│       │   ├── entity_types/        24 entities, one YAML each (+ _res.yaml = merged view)
│       │   ├── gql_enum_types/      9 enums, one YAML each (+ _res.yaml)
│       │   ├── relationships/       01-identity-project, 02-workflow, 03-supporting (+ _res)
│       │   ├── rbac/                one <entity>.rego per table + <entity>_audit.rego per audited entity
│       │   ├── seeds/               01_users, 02_workflow_definitions, 03_workflow_stage_definitions
│       │   └── tests/               model-level test fixtures (projects.yaml, users.yaml)
│       └── system/          the framework's own metadata model (you rarely touch this)
├── specs/                   the four feature specs + 000-INDEX reconciliation
├── target/appfw/*.json      generator diagnostics (outputs — chapter 3.6)
├── model-proposal.yaml, poc-intake.yaml, legacy-*.yaml, agent-profile.yaml   modernization inputs
```

Files named `_res.yaml` are **resolved / merged** views produced by the tooling —
read them to see the whole picture, but edit the individual files.

---

## 5.2 The 24 governance entities

Every entity is one file in `entity_types/`. Each maps to a Postgres table in the
`governance` schema. The legacy modernization split them into three sets and three
"wired" tiers (how much live behaviour the rebuild actually implements for them).

| Entity | Table | Set | Wired? | What it is |
|--------|-------|-----|--------|------------|
| **Project** | `projects` | A | **Fully** | The central record: a proposed piece of work. Carries intake fields, budget, flags (`has_phi_data`, `is_clinical`), and denormalised workflow state (`current_stage`, `workflow_status`). Custom methods: `submit_decision`, `pending_approvals`, `fast_track_complete`, `workspace`, `eligible_gates`, `cancel`, `extract_intake`, `extract_team_fields`. |
| **User** | `users` | A | **Fully** | A person with a `role` (`UserRole` enum) and an Argon2 password hash. |
| **ProjectField** | `project_fields` | A | Partial | Per-team custom field values on a project (key/value + who updated it). |
| **ProjectStakeholder** | `project_stakeholders` | A | Partial | A user attached to a project with a stakeholder role + `added_at` (first-class entity, not a junction, because it carries payload). |
| **GateReview** | `gate_reviews` | B | **Fully** | One committee's review of one gate: `assigned_role`, `status`, `decision` (`ApprovalDecision`), `decision_notes`, `checklist_items`. Custom method: `decide`. |
| **GateSubmission** | `gate_submissions` | B | **Fully** | The saved form data for a project at a given stage (`stage`, `status`, `decision`, `data` JSON). Custom method: `save_stage`. |
| **ProjectApproval** | `project_approvals` | B | **Fully** | One step in a project's sequential approval chain: `approval_stage`, `assigned_role`, `sequence_order`, `status`, `decision`. Driven by `approval_state_machine.rs`. |
| **WorkflowDefinition** | `workflow_definitions` | B | Seeded only | The named process ("Standard Project Lifecycle v2"). Seeded every boot; read by the eligibility engine. |
| **WorkflowStageDefinition** | `workflow_stage_definitions` | B | Seeded + read | One stage in a definition: `stage_code`, `sequence_order`, `phase_name`, `prerequisites` (JSON `{gates:[...]}`), `conditions`, `sla_days`. The eligibility DAG. |
| **WorkflowInstance** | `workflow_instances` | B | Schema only | A project's run of a definition. Modelled for fidelity; nothing creates rows today. |
| **WorkflowStage** | `workflow_stages` | B | GraphQL only | A live stage on an instance: `status` (`WorkflowStageStatus`), timestamps, `notes`. Driven by `transition.rs` (`start` / `submit` / `skip`). No REST row-creation path. |
| **WorkflowTask** | `workflow_tasks` | B | Schema only | A task under a stage. Fidelity only. |
| **TaskAssignment** | `task_assignments` | B | Schema only | A task assigned to a user. Fidelity only. |
| **ChecklistItem** | `checklist_items` | B | Schema only | A checklist row under a task. Fidelity only. |
| **AuditEvent** | `audit_history` → renamed | C | **Fully** | Append-only semantic governance events (`GATE_APPROVED`, `WORKFLOW_ADVANCED`, ...). `standard_methods` exclude Update/Delete. Written only by `services/audit.rs`. |
| **Notification** | `notifications` | C | **Fully** | In-app notification (`recipient_id`, `notification_type`, `title`, `message`, `is_read`). Written by `services/notification.rs`; read/mark-read by the SPA. |
| **Comment** | `comments` | C | Partial | A threaded comment on a project / task / gate review (self-referential `parent_id`). |
| **Attachment** | `attachments` | C | Partial | An uploaded file's metadata (`s3_key`, `upload_status`, `ai_extracted`). Real blob storage is deferred (spec 004). |
| **RiskItem** | `risk_items` | C | Partial | A risk logged against a project (`owner_id`, severity fields). |
| **Meeting** | `poc_meetings` → renamed | C | **Fully** | A Teams meeting: `organizer_email`, `graph_event_id`, `graph_online_meeting_id`, `join_url`, `transcript_vtt`, `summary`, `decisions`, `action_items`, `bpmn_*`. Custom methods: `schedule_via_graph`, `cancel_via_graph`, `process_transcript`. |
| **GraphSubscription** | `graph_subscriptions` | C | Stub | One row tracking a Microsoft Graph change-notification subscription. The auto-renewer/webhook that would use it is **not built** (see [`docs/architecture/meeting-graph-gaps.md`](../architecture/meeting-graph-gaps.md)). |
| **GraphWriteAttempt** | — (net new) | — | **Fully** | The idempotency + replay-protection + write-audit ledger for the governed Microsoft Graph write stack ("G1"). Every Graph write records an attempt row. |
| **KnowledgeDocument** | `knowledge_documents` | C | Schema only | A document for the (deferred) RAG knowledge base. `embedding` column intentionally dropped (open decision Q3). |
| **KnowledgeChunk** | `knowledge_chunks` | C | Schema only | A chunk of a knowledge document. Fidelity only. |
| **EmailQueueItem** | `email_queue` → renamed | C | Schema only | An outbound email row. No sender wired. |

Plus, **generated automatically**, an `<Entity>Audit` companion table for each of
the six entities that carry the `audited` facet (see 5.5): `ProjectAudit`,
`UserAudit`, `GateReviewAudit`, `GateSubmissionAudit`, `ProjectApprovalAudit`,
`AttachmentAudit`, and a few others the model marks audited
(`project_field_audit`, `project_stakeholder_audit`, `comment_audit`,
`risk_item_audit`, `meeting_audit`, plus every workflow entity's `_audit` — the
`rbac/` folder shows the full set: 21 `*_audit.rego` files).

### Reading an entity YAML

Using [`project.yaml`](../../.appfw/model/schemas/governance/entity_types/project.yaml):

```yaml
- id: 3f9a7b10-...            # a stable UUID for this entity (never changes)
  name: Project
  is_table: true
  facets: [audited, concurrency]   # behaviours mixed in — see 5.5
  indexes: [project_number, manager_id, status, created_at]
  execution:
    prepared_statements: true
  custom_methods:              # non-CRUD operations — generator emits _impl stubs
    - name: submit_decision
      kind: Mutation
      args: [{name: project_id, arg_type: String}, {name: payload, arg_type: serde_json::Value}]
      return_type: serde_json::Value
  props:
    - name: id
      fragment: property-primary-key-uuid       # pulls in a whole property definition
    - name: business_unit
      fragment: property-string-required
    - name: manager_id
      data_type: Uuid
      is_required: true
      foreign_key: { type_name: User }          # storage FK column → users.id
    - name: priority
      fragment: property-enum-required
      enum_type_name: ProjectPriority
      default_value: MEDIUM
```

`NavToOne`/`NavToMany` fields (`manager`, `stakeholders`, `approvals`, ...) are
**not** written here — they are *projected* onto the entity by the generator from
the relationship files (5.4).

---

## 5.3 The enums (`gql_enum_types/`)

Nine enums. All use **SCREAMING_SNAKE** values (that's the authoritative casing —
open decision Q7). Rego role *string literals* are lowercase; the enum wire
values are upper. This mismatch is deliberate and is why service code does
`format!("{role:?}").to_ascii_lowercase()` in a few places.

| Enum | Values |
|------|--------|
| `ApprovalDecision` | `APPROVED`, `REJECTED`, `NEEDS_INFO`, `DEFERRED` |
| `GateCode` | `A`–`S` plus `CAB` (20 legacy values; largely unused by the provisional engine) |
| `NotificationType` | `PROJECT_CREATED`, `TASK_ASSIGNED`, `TASK_COMPLETED`, `APPROVAL_REQUIRED`, `APPROVED`, `REJECTED`, `OVERDUE`, `STAGE_ADVANCED`, `COMMENT_ADDED` |
| `ProjectPriority` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| `ProjectRisk` | `VERY_HIGH`, `HIGH`, `MEDIUM`, `LOW` |
| `ProjectStatus` | `DRAFT`, `ACTIVE`, `ON_HOLD`, `IN_DELIVERY`, `COMPLETED`, `CANCELLED`, `ARCHIVED` |
| `TaskStatus` | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `OVERDUE`, `CANCELLED` |
| `UserRole` | `ADMIN`, `PROJECT_MANAGER`, `BTA`, `EPMO`, `FINANCE`, `VENDOR_SCREENING`, `ANALYSIS_TEAM`, `EAC`, `CAB`, `SECURITY`, `TAF`, `TRC`, `PIC`, `VIEWER` |
| `WorkflowStageStatus` | `LOCKED`, `ELIGIBLE`, `IN_PROGRESS`, `PENDING_APPROVAL`, `APPROVED`, `CHANGES_REQUESTED`, `REJECTED`, `SKIPPED` |

The generator turns each into a Rust enum in `backend/src/schemas/governance.rs`
(with `#[allow(non_camel_case_types)]` set at the crate level because the members
are SCREAMING_SNAKE), a GraphQL enum type, and a Postgres enum type.

**Three casings, know which is which** (verified live, [13.5](13-verification-log.md#135-refinement-graphql-enum-casing-is-pascalcase-in-both-directions)):
the model + Rust enum members + stored Postgres values are `SCREAMING_SNAKE`
(`ADMIN`). The **GraphQL wire value** is `PascalCase` (`Admin`) — the generated
enums carry `#[graphql(rename_items = "PascalCase")]` — **for both query results
and mutation inputs** (`createProject(input:{priority:"Medium"})`, not `"MEDIUM"`).
But a **filter argument** passed as raw JSON (`{ role: { _eq: "ADMIN" } }`)
compares the *stored* text, so it uses `SCREAMING_SNAKE`. Rego role literals are
lowercase (`"admin"`).

---

## 5.4 Relationships and "projection"

Three files under `relationships/`, one per set:

- `01-identity-project.yaml` — User↔Project (`manager`), Project self-reference
  (`duplicate_of`), stakeholders, fields.
- `02-workflow.yaml` — the definition→stage-definition→instance→stage→task→
  assignment→checklist chain, plus gate reviews, gate submissions, approvals.
- `03-supporting.yaml` — risks, attachments, comments (incl. self-referential
  replies), audit events, notifications, knowledge chunks.

Every relationship is declared **once**, as a `OneToMany` with a storage
`ForeignKey`:

```yaml
- name: project_manager
  kind: OneToMany
  one:  { entity: User,    field: managed_projects }   # User.managed_projects  (NavToMany)
  many: { entity: Project, field: manager }            # Project.manager         (NavToOne)
  storage:
    type: ForeignKey
    owner: Project
    field: manager_id                                  # the real column: projects.manager_id
```

The generator then **projects** both navigation fields (`User.managedProjects`,
`Project.manager`) into the GraphQL schema and the Rust projection structs. You
never hand-write a `NavToOne` property on an entity — if you do, `boundary-check`
/ validation flags a conflict. The comments in these files call out the two
places a projected field was renamed to avoid clashing with a real scalar column
(`GateSubmission.submitter` not `submitted_by`; `ProjectApproval.approver` not
`approved_by`).

One important non-mechanical note in `03-supporting.yaml`:
`project_audit_events` (AuditEvent → Project) **must not cascade-delete** — the
grammar has no cascade knob, so a comment is the only control. A hard project
delete would otherwise destroy its audit trail (this is why "delete project" is
modelled as a status transition to `CANCELLED`, never a real row delete).

---

## 5.5 Facets: `audited` and `concurrency`

A **facet** (`_facets/`) is a bundle of entity-level behaviour mixed in by name.
Two matter here:

### `concurrency`

Injects a read-only `version: Int64` column with `is_concurrency_control: true`
(`_facets/version_property.yaml`). This is **optimistic locking**: every update
must send the version it read; if the row's version moved in between (someone
else wrote), the update is rejected. This is why every service `*_input(...)`
helper copies `version: p.version` and every service response returns
`updated.version` — the SPA round-trips it. You never author the `version`
property by hand.

### `audited`

Generates a companion `<Entity>Audit` table and a matching read-only
`<entity>_audit.rego` (admin/epmo only). The companion is a **21-field
hash-chained** record: `before_json`, `after_json`, `diff_json`, `policy_json`,
`redactions_json`, `actor_user_name`, `actor_roles`, `action`, `outcome`,
`prev_hash`, `event_hash`, `signature`, ... (`_facets/audit_entity_type.yaml`
lists them all). On every insert/update/delete of the parent row, a database
trigger writes an audit row whose `event_hash` includes the previous row's
`prev_hash` — a tamper-evident chain. The smoke test (`scripts/smoke/`) exists
specifically to verify this chain stays linked.

**Two audit mechanisms, both live** (reconciled in `000-INDEX.md` point 1):

| Mechanism | What it records | Where |
|-----------|-----------------|-------|
| `audited` **facet** | row-level CRUD diffs, hash-chained, per entity | DB trigger → `<entity>_audit` table |
| `AuditEvent` **entity** | ~18 named *semantic* events (a gate was approved, a workflow advanced) | `services/audit.rs` → `audit_history` table, append-only |

---

## 5.6 Fragments (`_fragments/`)

~70 tiny files, each defining one reusable property shape:
`property-string-required.yaml`, `property-enum.yaml`,
`property-primary-key-uuid.yaml`, `property-date-time.yaml`,
`property-json-array.yaml`, `property-boolean-toggle.yaml`, ... An entity
property that says `fragment: property-string-required` inherits
`{ is_required: true, data_type: String, ... }` from that file, keeping the
entity YAML short and consistent. They're generated/curated framework-side and
you rarely edit them — you *reference* them.

---

## 5.7 Seeds (`seeds/`)

Applied after the tables are created, in filename order:

| File | Inserts | Notes |
|------|---------|-------|
| `01_users.yaml` | 7 demo users, one per key role (`admin@abchealth.com` … `finance@abchealth.com`) | `hashed_password` is a **placeholder** Argon2 string (`...REPLACE...`) — must be replaced out of band before real login works (chapter 4.10). Synthetic data only. |
| `02_workflow_definitions.yaml` | 1 row: "Standard Project Lifecycle v2" | `version` renamed `definition_version` because the `concurrency` facet owns `version`. |
| `03_workflow_stage_definitions.yaml` | 19 stage-definition rows forming the gate DAG | **PROVISIONAL** — a verbatim port of the legacy `seed.rs` 19-node DAG, *not* the authoritative Excel gate matrix (open decision P5). Stage codes: `INTAKE_BTA`, `INTAKE_EPMO`, `BTA_MEETING`, `PM_ASSIGN`, `VCR_REVIEW`, `VRA_REVIEW`, `EAC_REVIEW`, `PIC_REVIEW`, `INTAKE_TRC`, `INTAKE_SRA`, `TRC_REVIEW`, `SRA_REVIEW`, `APM_REVIEW`, `INTAKE_ST`, `ST_RUNBOOK`, `TECH_RB`, `VENDOR_ST`, `CAB_CT`, `CAB_ER`. Each row's `prerequisites: {gates: [...]}` defines the DAG edges the eligibility engine walks. |

---

## 5.8 RBAC policies (`rbac/`)

One hand-written `.rego` file per table entity (bodies only — the generator adds
the package header, `import rego.v1`, `default access = {"allow": false}`, and the
`check_schema_type()` / `has_role` helpers), plus one `<entity>_audit.rego` per
audited entity. Example — [`project.rego`](../../.appfw/model/schemas/governance/rbac/project.rego):

```rego
# Admin manages all projects.
access := res if { check_schema_type(); has_role(input.user, "admin"); res := {"allow": true, "filter": {}} }

# Any authenticated user can create/read.
access := res if { check_schema_type(); input.action in ["create","read"]; res := {"allow": true, "filter": {}} }

# EPMO can update/delete (cancel) any project.
access := res if { check_schema_type(); input.action in ["update","delete"]; has_role(input.user, "epmo"); res := {"allow": true, "filter": {}} }

# The managing user can update THEIR OWN project.
access := res if {
    check_schema_type()
    input.action == "update"
    not has_any_role(input.user, ["admin","epmo"])
    res := {"allow": true, "filter": {"manager_id": {"_eq": input.user.id}}}
}
```

The `filter` in the last rule is a **row filter** — the backend appends it to the
SQL `WHERE` clause, so a plain PM only ever sees/edits rows where
`manager_id = <their id>`. `input.user.id` availability is open decision A; if
the runtime doesn't carry an actor id, these filters degrade to role-only and
more scoping falls to the service layer.

`notification.rego` has a useful comment explaining why `create` can't be
caller-scoped: the *recipient* of a system notification is someone other than the
caller, so create is allowed for any authenticated actor and the *service*
decides the recipient. Same pattern for `audit_event.rego`. This is the
"service writes go through the same Rego path as client writes — there is no
bypass" principle.

---

## 5.9 How a model change reaches the running app

```
1. Edit .appfw/model/schemas/governance/entity_types/<entity>.yaml
        (add a field, an index, a custom method, ...)
        │
2. scripts/appfw product validate --json          → catches model errors
        │
3. scripts/appfw product generate                  (in the rust-appfw container on Windows)
        │  rewrites:
        │   backend/src/schemas/governance.rs   (new field on the projection + input structs)
        │   backend/src/handlers/governance/generated.rs   (CRUD picks it up)
        │   backend/config/generated/schemas/governance/entity_types.yaml
        │   database/_pkg/schemas/governance/tables.pg.sql   (ALTER TABLE ADD COLUMN)
        │   frontend/src/generated/appfw-ui-contract.ts
        │   appfw.lock
        │  and, if you added a NEW custom method:
        │   backend/src/handlers/governance/<entity>.rs   gets a new empty <name>_impl stub
        │
4. Write the logic:
        - custom method → fill the _impl body, usually calling backend/src/services/**
        - new business rule → new/edited function under backend/src/services/**
        - access change → edit .appfw/model/schemas/governance/rbac/<entity>.rego, regenerate
        │
5. Apply the DB change:   scripts/appfw product migrate     (or pipe the new DDL via psql)
        │
6. cargo check --workspace   +   cd frontend && npm run typecheck
        │
7. scripts/appfw product generate --check --json   +   boundary-check --json   → must pass
        │
8. cargo run -p backend   +   npm run dev   → verify
```

Chapter 7 walks a concrete request end to end.

---

Next: [`06-workflow-engine.md`](06-workflow-engine.md).
