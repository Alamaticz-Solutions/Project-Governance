# 10. Every file under `.appfw/`

`.appfw/` is the **application model** — the source of truth chapter 5 introduced.
Almost everything here is **hand-written [P]** (it's the input to code generation,
not an output). The exceptions are the `_res.yaml` merged views and
`.appfw/target/` diagnostics, which are **[G]**.

`.appfw/model/_fragments/` and `.appfw/model/_facets/` are framework-curated
templates — you *reference* them from entity files but rarely edit them; treated
as **[F]** (framework-owned, vendored here).

---

## 10.1 Top-level files

| File | | What it does |
|------|--|--------------|
| `manifest.yaml` | [P] | **Topology.** `app` name/display; `topology.data_sources` (one: `pg_primary` PostgreSQL); `topology.schemas` (`system` = framework, `governance` = product); `topology.ingress` (`governance-http` enabled at `/governance`; `app-mcp` and `governance-events` Kafka **disabled**); `ui.product_spa` (enabled, `backend-product-dist` packaging); `ui.admin_ui` (disabled in the product image). This drives `podman-compose.yml` and the route assembly. |
| `agent-profile.yaml` | [P] | Least-privilege allow-list of `scripts/appfw` subcommands automated agents may run (`validate`, `harness-check`, `boundary-check`, `feature-check`, `generate --check`, `policy-test`, `test --fast`). |
| `poc-intake.yaml` | [P] | The original product-intake record: app name, schema, provider, ingress flags, and the pointer to the legacy source (`../../Governance/Project-Governance`). Modernization input. |
| `legacy-analysis.yaml` | [P] | Step-1 legacy analysis: detected signals (`prototype_or_legacy_ui`, `source_reference`), provider, UI mode. Modernization input. |
| `legacy-modernization.yaml` | [P] | Step-2 full discovery inventory: the 24 tables, the wired/unwired tiers, every route/service/enum/FK/sensitive-field, the enum-casing break. Referenced by `specs/000-INDEX.md`. Modernization input. |
| `model-proposal.yaml` | [P] | The generator's *proposed* model (`writes_final_model: false`, `requires_human_review: true`) — a suggestion that a human turned into the real `model/` tree. Historical. |
| `appfw.lock` | (at repo root, not here) [G] | Framework provenance — chapter 3.3. |

The four `specs/*.md` + `specs/000-INDEX.md` are covered in [chapter 2.8](02-architecture.md#28-the-four-feature-specs).
Read `000-INDEX.md` first.

---

## 10.2 `.appfw/model/schemas/governance/` — the product model

### `entity_types/` — 24 entity files + `_res.yaml`

One YAML per entity (listed in [chapter 5.2](05-data-model.md#52-the-24-governance-entities)).
Each declares: `id` (stable UUID), `name`, `is_table`, `facets`, `indexes`,
`execution`, `custom_methods`, and `props` (each prop either references a
`fragment:` or spells out `data_type` / `is_required` / `foreign_key` /
`enum_type_name` / `default_value`). Nav fields are **not** here — they're
projected from the relationship files.

| File | Facets | Custom methods | Notes |
|------|--------|----------------|-------|
| `project.yaml` | `audited`, `concurrency` | `submit_decision`, `pending_approvals`, `fast_track_complete`, `workspace`, `eligible_gates`, `cancel`, `extract_intake`, `extract_team_fields` | ~50 props; `project_number` is a plain writable String (generated in the Create `_impl`), not `computed` |
| `user.yaml` | `audited`, `concurrency` | — | `role` (`UserRole`), `hashed_password` (Argon2) |
| `gate_review.yaml` | `audited`, `concurrency` | `decide` | REST-wired in legacy via `/gate-reviews/*` |
| `gate_submission.yaml` | `audited`, `concurrency` | `save_stage` | the stage form store (`data` JSON) |
| `project_approval.yaml` | `audited`, `concurrency` | — (driven by `Project.submit_decision`) | the sequential chain |
| `meeting.yaml` | `audited`, `concurrency` | `schedule_via_graph`, `cancel_via_graph`, `process_transcript` | renamed from `poc_meetings`; `meeting_audit.rego` exists |
| `graph_write_attempt.yaml` | — | — | net-new; the G1 idempotency/replay/audit ledger |
| `graph_subscription.yaml` | — (no audit) | — | stub; the renewer/webhook isn't built |
| `audit_event.yaml` | — | — | append-only; `standard_methods` exclude Update/Delete |
| `notification.yaml` | — (no audit) | — | written by the service, read/mark-read by the SPA |
| `project_field.yaml`, `project_stakeholder.yaml` | `audited`, `concurrency` | — | Set A supporting |
| `comment.yaml`, `attachment.yaml`, `risk_item.yaml` | `audited`, `concurrency` | — | Set C supporting, partially wired |
| `checklist_item.yaml`, `task_assignment.yaml`, `workflow_instance.yaml`, `workflow_task.yaml` | varies | — | "schema fidelity only" — modelled, nothing creates rows |
| `workflow_definition.yaml`, `workflow_stage_definition.yaml` | varies | — | seeded every boot; read by the eligibility engine |
| `workflow_stage.yaml` | `concurrency` | (driven by `WorkflowStage.start/submit/skip`) | GraphQL-only |
| `knowledge_document.yaml`, `knowledge_chunk.yaml` | — | — | RAG KB deferred (decision Q3); `embedding` column dropped |
| `email_queue_item.yaml` | — (no audit) | — | renamed from `email_queue`; no sender wired |
| `_res.yaml` | [G] | — | the fully-merged, defaults-expanded view of all 24 entities — read to see everything, edit the individual files |

### `gql_enum_types/` — 9 enum files + `_res.yaml`

`approval_decision`, `gate_code`, `notification_type`, `project_priority`,
`project_risk`, `project_status`, `task_status`, `user_role`,
`workflow_stage_status`. Values in [chapter 5.3](05-data-model.md#53-the-enums-gql_enum_types).
Model values are **SCREAMING_SNAKE**; the generated Rust enum members are also
SCREAMING_SNAKE; but the **GraphQL wire values are PascalCase**
(`#[graphql(rename_items = "PascalCase")]` on the generated enums) — so
`role` is `Admin` on the wire, not `ADMIN` (see `tests/users.yaml` and
`frontend/src/features/shared/enums.ts`). Filter arguments passed as raw JSON,
however, compare the **stored** SCREAMING_SNAKE text.

### `relationships/` — 3 files + `_res.yaml`

`01-identity-project.yaml`, `02-workflow.yaml`, `03-supporting.yaml`. Every
relationship is one `OneToMany` with a storage `ForeignKey`; the generator
projects the two nav fields. Details + the "must not cascade-delete AuditEvent"
note in [chapter 5.4](05-data-model.md#54-relationships-and-projection).

### `rbac/` — 42 `.rego` files

One `<entity>.rego` per table entity (21) + one `<entity>_audit.rego` per audited
entity (21). Hand-written **bodies only** — the generator adds the package
header, `import rego.v1`, `default access = {"allow": false}`, and the
`check_schema_type()` / `has_role` / `has_any_role` / `tenant_filter` helpers,
then copies the wrapped result to
`backend/config/generated/schemas/governance/`. Each answers: *given
`input.user`, `input.action`, `input.entity_type` — `{allow, filter}`?* The
`_audit.rego` files are uniformly read-only for `admin`/`epmo`. Pattern + the
`project.rego` / `notification.rego` examples in
[chapter 5.8](05-data-model.md#58-rbac-policies-rbac).

| Rego file group | Rule shape |
|-----------------|-----------|
| `project`, `gate_review`, `gate_submission`, `project_approval` | role gates + single-row owner filters; parent-row ownership handled in the service layer |
| `notification`, `comment`, `audit_event` | recipient/author-scoped read/update; `create` open to any authenticated actor (the service picks the row owner) |
| `user`, `user_audit` | admin-managed; self-read |
| `meeting`, `graph_subscription`, `graph_write_attempt` | operator/admin scoped |
| `workflow_*`, `checklist_item`, `task_assignment`, `knowledge_*`, `email_queue_item`, `risk_item`, `attachment`, `project_field`, `project_stakeholder` | mostly role-gated; several are "fidelity only" so the policy is minimal |
| all `*_audit.rego` (21) | read-only, `admin`/`epmo` |

### `seeds/` — 3 files

`01_users.yaml` (7 demo users, placeholder Argon2 hash), `02_workflow_definitions.yaml`
(1 definition), `03_workflow_stage_definitions.yaml` (19 provisional stage rows —
the gate DAG). Details in [chapter 5.7](05-data-model.md#57-seeds-seeds).

### `tests/` — 2 files

`projects.yaml`, `users.yaml` — **API scenario fixtures** the framework's test
harness runs (`scripts/appfw product harness-check`). Each declares a GraphQL
query/mutation, variables, an `auth_token`, and an `expect` block. `users.yaml`'s
comment documents the PascalCase-on-the-wire enum fact.

### `_res.yaml` (schema level)

`schemas/governance/_res.yaml` — the merged schema descriptor (id, name,
data_source_name). [G].

---

## 10.3 `.appfw/model/schemas/system/` — the framework's own model

You almost never edit this. It's the model *of the model* — the entities the
framework's `/system` GraphQL API and admin UI expose.

| Path | | What it is |
|------|--|-----------|
| `entity_types/` | [F] | `entity_type`, `data_source`, `custom_method`, `computed`, `many_to_many_property`, `validators` — the meta-entities. `product_api.rs` converts the loaded versions of these into `RuntimeModelMetadata`. |
| `gql_enum_types/` | [F] | `data_type` (`Uuid`, `String`, `Enum`, `Json`, `NavToOne`, …), `data_source_type` (`PostgreSQL`, `MongoDB`, `Snowflake`, … — the full provider list the framework supports, of which this app uses one), `facet`, `standard_method`, `custom_method_kind`, `computed`, `field_value_source`, `audit`, `user`, `workflow`. |
| `relationships/core.yaml` | [F] | Core meta-relationships. |
| `rbac/user.rego` | [F] | The system-schema user policy. |
| `_res.yaml` files | [G] | Merged views. |

---

## 10.4 `.appfw/model/_fragments/` — property templates [F]

~70 one-property files. An entity prop `fragment: property-string-required`
inherits `{ is_required: true, data_type: String }`. Groups:

| Prefix | Examples | Meaning |
|--------|----------|---------|
| `property-primary-key-*` | `-uuid`, `-string`, `-int64`, `-objectid` | primary key of that type |
| `property-string*` | `-required`, `-caption`, `-email`, `-phone`, `-secret`, `-readonly`, `-stringmax-{sm,md,lg,xl}`, `-zipcode`, `-ipv4`, `-state`, `-word`, `-code` | string variants with validation baked in |
| `property-int-{sm,md,lg}[-required]` | | 16/32/64-bit ints |
| `property-float{32,64}[-required]` | | floats |
| `property-{date,date-time,time}[-required]` | | temporal |
| `property-boolean-toggle[-required]` | | a checkbox-style bool |
| `property-enum[-required]`, `property-enum-array[-required]` | | enum (pair with `enum_type_name:`) |
| `property-json[-required]`, `property-json-array[-required]`, `property-json-map`, `property-object[-array][-required]` | | JSON / JSONB columns |
| `property-person-name[-required]`, `property-audit-records` | | specialised |

You reference these; you rarely write new ones (that's a framework change).

---

## 10.5 `.appfw/model/_facets/` — entity behaviours [F]

| File | Effect when an entity lists this facet |
|------|----------------------------------------|
| `version_property.yaml` | injects the read-only `version: Int64` optimistic-lock column (facet name: `concurrency`) |
| `audit_entity_type.yaml` | the shape of the generated `<Entity>Audit` companion table — 21 read-only fields: `audit_id`, `occurred_at`, `tenant_id`, `actor_user_name`, `actor_roles`, `action`, `outcome`, `schema_name`, `entity_name`, `table_name`, `audit_table_name`, `record_id`, `before_json`, `after_json`, `diff_json`, `policy_json`, `redactions_json`, `chain_scope`, `prev_hash`, `event_hash`, `signature` |
| `audit_property.yaml` | the per-property audit metadata used to build the diff |
| `soft_deleted_property.yaml` | injects a soft-delete flag (facet `soft-deleted`) — **not used** by any governance entity; "delete project" is a status transition instead |
| `schema_entity_type_related.yaml` | relates an entity to its schema (internal) |

---

## 10.6 `.appfw/model/data_sources/_res.yaml` [G]

The resolved data-source config: `pg_primary` (PostgreSQL, `is_system_schema_host:
true`) with two environments — `local` (`localhost:5432`) and `compose`
(`postgres:5432`), both `security_profile: local_dev`, `tls_mode: disabled`.
The generator copies this to `backend/config/generated/data_sources.yaml` and
`database/_pkg/data_sources.yaml`; the backend loads it at startup and
`config/loader.rs::add_secrets` pins the one matching `ENV_NAME`.

---

## 10.7 `.appfw/model/_specs/CONFIG_CONTRACT.md` and `.appfw/target/`

- `_specs/CONFIG_CONTRACT.md` [P/F] — the config-contract document
  (what shape the model must have; hashed as `config_contract_source_hash` in
  `appfw.lock`).
- `.appfw/target/appfw/*.json` [G] — generation diagnostics, listed in
  [chapter 3.6](03-framework-dependency.md#36-appfwtargetappfw--the-generation-diagnostics).
  Outputs; safe to delete.

---

Next: [`11-generated-config-db-tests.md`](11-generated-config-db-tests.md).
