# 001 — Auth, RBAC, Tenancy

Full spec (rulebook file 07 §7.2 — this touches authentication, authorization, tenant isolation, audit, PHI/PII). Product: `governance`. Schema: `governance` (product) + `system` (framework). Data source: `pg_primary` (single PostgreSQL). Branch: `governance-restructure`.

**Related specs.** This is the foundational spec; 002 / 003 / 004 build on it. `002-gate-workflow-engine.md` owns the workflow `custom_methods`, the `WorkflowStageStatus` enum, the `AuditEvent` entity design, and the service-layer authorization split. `003-msgraph-saas-provider.md` owns the `Meeting` entity (legacy table `poc_meetings`) and its `.rego`. `004-ai-storage-and-nonprimitives.md` owns the AI-egress boundary and the document-storage / KB decisions. The authoritative wired-vs-unwired classification of every legacy table is `.appfw/legacy-modernization.yaml` → `data_discovery.tables_views_and_row_counts` (three-tier: REST-wired / seeded-only / GraphQL-only / fully unwired); the `*` marks in the checklist below are indicative only.

Golden path is docs-only right now: the framework CLI cannot run on this Windows host, so `## Acceptance evidence` lists the commands that *will* prove conformance (file 07 §7.4), not commands runnable today.

---

## Business value

The legacy Governance backend enforces access with one coarse mechanism: a scalar `user_role` per user, checked by ad-hoc `matches!(current_user.role, …)` guards scattered through `project_service.rs`, `gate_review_service.rs`, `workspace_service.rs`, and a handful of `ensure_role(...)` handler calls. Its own source comments admit the gaps this produced ("PATCH previously had no permission check at all"; "this endpoint had no role check at all"; "Owner role gating shown in the UI — not exhaustively enforced server-side"). There is no row-level scoping: any authenticated user can read every project, every gate review, every attachment.

Governance is a compliance tool. It carries clinical/HIPAA project intake (`has_phi_data`, `is_clinical` flags on `projects`), vendor-screening and security-review workflow, and an append-only audit trail that auditors rely on. "A user sees only their own scope" (file 05 §5.7) is a regulatory expectation here, not a nicety. The framework's answer is a **per-entity Rego policy that returns a row-level filter**, evaluated once at the shared Query IR boundary (file 03 ADR 0001), applied uniformly to every data-access path including any future custom service. Replacing the coarse guard with per-entity deny-by-default policies (a) closes the "forgot to check" class of bug structurally — an entity with no allow rule is inaccessible, not wide open; (b) makes "which roles can see/do what" reviewable as config, not archaeology across Rust services; and (c) gives the audit facet a policy context (`policy_json`) to record on every write.

---

## Scope

### Actor / JWT claim set

Carried forward from legacy `auth/jwt.rs` `Claims`, projected into the framework actor context at the HTTP ingress boundary (file 01 §1.3 — "HTTP/GraphQL owns … JWT/header extraction"):

| Claim | Source | Notes |
|---|---|---|
| `sub` | user UUID (string) | maps to actor identity |
| `role` → `roles: ["<role>"]` | scalar `users.role` enum | **projected to a one-element array** at the auth boundary so the framework `has_role(user, role)` / `has_any_role` helpers (which iterate `input.user.roles[_]`) work unchanged. Multi-role is a future change, not now. |
| `email` | `users.email` | present on access tokens only (legacy behaviour) |
| `exp` | issue time + `access_token_expire_minutes` / `refresh_token_expire_days` | |
| `type` | `"access"` \| `"refresh"` | extractor rejects a refresh token used as a bearer credential |

- **Password hashing:** Argon2 (`argon2` crate, default params, per-hash `SaltString`), carried over verbatim from legacy `auth/password.rs`. No change.
- **`register` → viewer-only:** public self-registration always creates `role = VIEWER`; the request body's role (if any) is ignored. This is a **value constraint on create, not a row filter** — Rego cannot express "force this column value on insert." It lands in the product service / custom method that owns user creation (force-set the column), and the constraint's preservation across every create path is a file 01 §1.1 obligation ("Access-control behavior must be preserved across custom data access paths"). The `.rego` for `User` governs *who may call create*, not *what role is written*.
- **Admin-only user creation:** `POST /users` (`admin_create_user`) requires `ADMIN`. In the rebuild this is the `create` action on the `User` entity's `.rego`.
- **Tenancy = single-tenant.** Hand-authored policy bodies never call `tenant_filter`; the actor context carries no `tenant_id`. The generated wrapper still supplies an (inert) `tenant_filter` helper and a hard-coded `pds_tenant_id` constant — Governance simply never references them. No `tenant_id` predicate appears in any Governance filter.
- **One hand-authored `.rego` per table entity** in `schemas/governance/rbac/`, bodies-only (`access := res if { … }` — no `package`, no `import`, no helper definitions; file 02 §5). Plus one `<entity>_audit.rego` for **each** entity that carries `facets: [audited]` (count is conditional on that model decision — see Open decisions).
- **`rego_test` fixtures** (product-owned, `rego_test/`) with positive and negative assertions per entity, including: denied read for an out-of-scope role; cross-scope / IDOR-style attempts (e.g. `PROJECT_MANAGER` reading a project they do not manage; a non-assigned reviewer posting a gate decision); `VIEWER` attempting any write.

### Interim role-string casing convention (depends on Q7 — see Open decisions)

All framework examples (file 02 §5: `"admin"`, `"sales_rep"`, `"crm_ops"`) and the scaffold's only existing policy (`schemas/system/rbac/user.rego` → `has_role(input.user, "admin")`) use **lowercase** role literals. The entity layer and DB enum use SCREAMING_SNAKE (`ADMIN`, `PROJECT_MANAGER`, …). **Interim decision for this spec:** the auth-boundary projection **lowercases** the role into `roles[]` (`ADMIN` → `"admin"`, `PROJECT_MANAGER` → `"project_manager"`), and every `.rego` literal in the plan below is lowercase. If Q7 resolves the other way, the change is a mechanical find-replace of the string literals across all `governance/rbac/*.rego` files plus the `rego_test` fixtures — no rule-structure change.

### Role × action × entity plan

Roles (14, from `user_role`, lowercased for Rego): `admin`, `project_manager`, `bta`, `epmo`, `finance`, `vendor_screening`, `analysis_team`, `eac`, `cab`, `security`, `taf`, `trc`, `pic`, `viewer`.

Actions map to the framework set `create | read | update | delete`. Derived **only** from inline checks that exist in the legacy services today; where there is no check, the row says "currently unguarded".

| Entity (legacy table) | Wired? | Roles → actions | Row filter | Derived from |
|---|---|---|---|---|
| **User** (`users`) | yes | `admin`: C/R/U/D. `epmo`: R (list). all others: R self only. | non-admin/epmo read → `{"id": {"_eq": <actor sub>}}` *(needs actor id — see Open decisions; else R denied to non-privileged)* | `handlers/users.rs` (`ensure_role([Admin])` create, `ensure_role([Admin,Epmo])` list); `auth/extractor.rs` loads self |
| **Project** (`projects`) | yes | any authenticated: C (self becomes `manager_id`), R. `admin`,`epmo`: U, D. owner: U. | read: `{}` (all authenticated can read today). update: role in {admin,epmo} → `{}`; else `{"manager_id": {"_eq": <actor sub>}}` *(needs actor id)*. `delete` = **soft cancel** (`status = CANCELLED`), not a row delete — the framework `delete` action does not map; model as a custom method or `update` restricted to {admin,epmo}. | `project_service.rs` `create_project` (no role gate), `update_project` L308-316, `delete_project` L362-364 |
| **ProjectApproval** (`project_approvals`) | yes | `admin`,`epmo`: R all. other roles: R where the approval is addressed to them. U (decision) same. | `{"assigned_role": {"_eq": "<role>"}}` for non-privileged; `{}` for admin/epmo | `project_service.rs` `get_pending_approvals` L396-398 — **worked example, cleanest real row filter in the codebase** |
| **GateReview** (`gate_reviews`) | yes | R: authenticated (no scope today). U (decision): `admin` OR the review's `assigned_role`. | decision update: `{"assigned_role": {"_eq": "<role>"}}`; `admin` → `{}` | `gate_review_service.rs` `submit_gate_decision` L40-49; `handlers/gate_reviews.rs` `list`/`get` unguarded |
| **GateSubmission** (`gate_submissions`) | yes | currently unguarded — authenticated R/C/U. Propose: R for `admin`,`epmo` + project owner; C/U for the stage-owner role. | propose `{"project_id": {"_in": <owned/assigned project ids>}}` — **flag: not expressible without a relationship sub-filter or actor id** | `m20260101_000002`; no explicit check found |
| **WorkflowStage** (`workflow_stages`) | yes | currently unguarded server-side. Propose: R authenticated; U for the stage-owner role (`stage_owner_role()` string) or `admin`. | none (stage owner is a string on the parent project, not a row attr) | `services/workflow_engine.rs`; `workspace_service.rs` L45-53 comment ("not exhaustively enforced server-side") |
| **ProjectField** (`project_fields`) | yes | currently unguarded. Propose: R/U for project `manager_id == actor` or `admin`/`epmo`; per-stage owner role for U. | `{"project_id": {"_in": <owned project ids>}}` *(needs actor id + relationship filter)* | `workspace_service.rs` `save_stage` — gating is UI-only today |
| **ProjectStakeholder** (`project_stakeholders`) | unwired | currently unguarded. Propose: R authenticated; C/U/D for project owner + `admin`/`epmo`. | `{"project_id": {"_in": <owned project ids>}}` *(needs actor id)* | table exists; no service reads/writes it |
| **RiskItem** (`risk_items`) | partial | currently unguarded. Propose: R authenticated; C/U for project owner, `security`, `admin`; D `admin` only. | `{"project_id": {"_in": <owned project ids>}}` for non-privileged writers | table read by GraphQL; no inline check |
| **Attachment** (`attachments`) | yes | currently unguarded — any authenticated R/download/C. Propose: R for project owner + `admin`/`epmo` + roles on that project's active stage; C by same; D `admin`. | `{"project_id": {"_in": <owned/assigned project ids>}}` — **flag: PHI-adjacent (uploaded intake docs); must be scoped, cannot ship as `{}`** | `projects::extract_team_fields`, `list_documents`, `download_document` — no check today |
| **Comment** (`comments`) | partial | currently unguarded. Propose: R authenticated on projects in scope; C authenticated; U/D author only or `admin`. | U/D: `{"created_by": {"_eq": <actor sub>}}` *(needs actor id)*; else `{}` | table exists; no inline check |
| **AuditEvent** (`audit_history` — entity renamed; see 002 §"AuditEvent") | yes | R: `admin`, `epmo` only. No client C/U/D — append-only; the only writer is the product `audit` service (spec 002), never generated CRUD Create from a client. `standard_methods` exclude `Update`/`Delete` (ADR 0004). | `{}` | `handlers/audit.rs` `ensure_role([Admin, Epmo])` |
| **Notification** (`notifications`) | yes | R/U (mark-read): recipient only. | `{"user_id": {"_eq": <actor sub>}}` *(needs actor id — otherwise notifications cannot be scoped in Rego at all)* | `handlers/notifications.rs` — `notification_service` already filters by current user |
| **KnowledgeDocument** (`knowledge_documents`) | unwired | currently unguarded. Propose: R authenticated; C/U/D `admin`, `epmo`, `analysis_team`. | `{}` (org-wide reference content) | table exists; no service |
| **Meeting** (`poc_meetings`) | yes (PoC) | currently unguarded. Propose: R authenticated; C/U for `admin` + meeting organizer; D `admin`. | organizer scope needs actor id; else role-only | `services/poc_meeting_service.rs`, `graph_meeting_service.rs`; Teams PoC — note: task said "Meeting", the actual entity is `poc_meetings` |

Cross-cutting rules baked into every entity body:
- `admin` → `{"allow": true, "filter": {}}` first rule (mirrors `system/rbac/user.rego`).
- `viewer` → `read` only, `filter: {}` on genuinely org-public entities; no `viewer` write rule anywhere (deny-by-default handles it).
- Gate-advance ownership (`project.current_owner_role`, a lowercase free-string column: `"epmo"`, `"bta"`, `"finance"`, `"eac"`, `"pic"`, `"trc"`, `"project_manager"`) drives the `update` allow rule for `Project` state transitions — matched case-insensitively today (`project_service.rs` L562), which the rego layer must normalise (see Open decisions, Q7).

Illustrative body (`rbac/project_approval.rego`, body-only, non-privileged reviewer scope):

```
access := res if {
    check_schema_type()
    input.action in ["read", "update"]
    has_any_role(input.user, ["bta", "epmo", "finance", "eac", "pic", "trc", "security", "cab", "taf", "vendor_screening", "analysis_team", "project_manager"])
    res := {"allow": true, "filter": {"assigned_role": {"_eq": input.user.roles[0]}}}
}
```

---

## Non-goals

- **Multi-tenant.** No `tenant_id` claim, no `tenant_filter` call, no per-tenant row scoping. Future ADR if it ever changes.
- **Okta / OIDC wiring.** The framework shell default is Okta/JWT identity (file 05 §5.7). The legacy app ships its own HS256 JWT (`jsonwebtoken`, shared-secret) with a custom refresh flow. This spec **keeps the legacy JWT** and flags the divergence; switching identity providers is a separate spec (`ADR: identity provider`). The `roles[]` projection is provider-agnostic, so the switch does not invalidate the policy set.
- **SSO** (SAML / desktop / Entra) — out.
- **Frontend re-implementing authorization.** The React SPA reflects backend policy and `standard_methods` and **fails closed on permission errors** (file 05 §5.7). It never becomes the authorization authority; a UI that hides a button is not a control.
- Multi-role per user (deferred; see the one-element-array decision above).
- Release/deployment gates (rulebook file 09) — local/dev only for now.
- MCP and Kafka ingress — disabled in the manifest; no actor-mapping / service-principal work here.

---

## Contracts touched

- **File 02 §5 — Rego grammar & generated wrapper.** Hand-authored files are bodies-only; the generator supplies `package governance.<snake_entity>`, `import rego.v1`, `default access = {"allow": false}` (deny-by-default), `check_schema_type()`, and the `has_role` / `has_any_role` / `tenant_filter` helpers. Every `access` rule must resolve to `{"allow": bool, "filter": object}`. `filter` is a Hasura-style predicate — `_and`, `_eq`, `_ne`, `_in` are the observed operators. We use `_eq` / `_in` / `_and` only.
- **File 01 §1.1 —** "Access-control behavior must be preserved across custom data access paths." Every legacy inline check enumerated in the plan must have an equivalent allow rule (or a documented, intentional relaxation) before the corresponding service is rebuilt. The `register → VIEWER` value constraint is explicitly in scope of this clause even though it is not a Rego rule.
- **File 03 ADR 0001 —** the access filter is applied once, at the shared Query IR boundary (`QueryPlan.access_filter` / `MutationPlan.access_filter`), not per provider and not in Rust services. Product services must route through `DataAccess`; they must not re-filter or bypass.
- **File 05 §5.7 —** UI reflects backend authz and fails closed; synthetic data only in fixtures/tests (no real PHI/PII in `rego_test`).
- **File 10 —** every table entity needs its own `.rego`; a missing file = silently inaccessible (deny-by-default), which is safe-but-broken, not safe-and-done.
- **File 02 §10 / ADR 0004 —** the `audited` facet auto-generates the 21-field companion audit entity and its `record_id` nav; each such companion needs its own `<entity>_audit.rego` (read-only, privileged roles).

---

## Options considered

**(a) One shared product-wide default-deny policy.** *Rejected* — the framework has no shared product policy template; the generator only wraps per-entity files. There is nowhere to put a single shared body.

**(b) Per-entity Rego with row-level filters that port the current inline service checks.** *Recommended.* Each legacy check becomes an `access := res if { … }` rule returning a Hasura filter. Example: `project_service.rs` "only the project's manager, an EPMO reviewer, or an admin may edit" →

```
access := res if {
    check_schema_type()
    input.action in ["read", "update"]
    has_any_role(input.user, ["admin", "epmo"])
    res := {"allow": true, "filter": {}}
}
access := res if {
    check_schema_type()
    input.action in ["read", "update"]
    has_role(input.user, "project_manager")
    res := {"allow": true, "filter": {"manager_id": {"_eq": input.user.id}}}
}
```

*Rationale:* it is the only option the framework can actually evaluate; it makes the policy reviewable as config; it puts the filter at the Query IR boundary so every future service inherits it; and it maps almost 1:1 onto checks that already exist, keeping the rebuild low-risk. **Caveat:** the manager-scoped filter above assumes `input.user` carries an actor id — see Open decisions.

**(c) Keep authorization in Rust services (`ensure_role`, inline `matches!`).** *Rejected* — violates file 01 (access control must live at the shared boundary, preserved across all data paths) and file 02 §5 (policy is Rego config). It also reproduces the exact "forgot a check" bug class this rebuild exists to remove.

---

## Risks and controls

| Risk | Control |
|---|---|
| Forgetting a `.rego` file ⇒ entity silently inaccessible to everyone (deny-by-default). | Checklist below of **all 24 table entities** + their audit companions; `product validate --json` RBAC-lint pass is the gate; `rego_test` must have at least one positive fixture per entity so a missing file fails a test, not just a manual review. |
| 14 roles × 4 actions × 24 entities is a large matrix; copy-paste drift. | Group roles with `has_any_role`; one "`admin` → allow-all" rule per file; derive rows only from real legacy checks, mark everything else "currently unguarded — propose". |
| PHI-adjacent data (`attachments` = uploaded clinical/vendor intake docs; `projects.has_phi_data`/`is_clinical`; `risk_items`). | Row filters keep users to project scope — `attachments` and `project_fields` must **not** ship with `filter: {}`; field-level redaction is the `audited` facet's job (`meta.audit.redact: true`), not this spec's. No real PHI in fixtures. |
| Owner-scoped filters may be inexpressible (no actor id in `input.user`). | See Open decisions; interim, those entities degrade to role-only scoping and the gap is logged as a condition on this spec, not silently shipped as `filter: {}`. |
| `register → VIEWER` bypassed by a future create path. | File 01 §1.1 obligation; the User-create service force-sets the column; `rego_test` cannot cover it, so an API test asserts a self-registered user gets `VIEWER`. |
| Legacy JWT ≠ framework Okta default. | Documented divergence (Non-goals); `roles[]` projection keeps policies provider-agnostic; separate identity-provider ADR owns the switch. |

**Entity `.rego` checklist (all 24 `governance` tables; * = currently wired to a service/handler):**

1. `users` * — `user.rego`
2. `projects` * — `project.rego`
3. `project_approvals` * — `project_approval.rego`
4. `gate_reviews` * — `gate_review.rego`
5. `gate_submissions` * — `gate_submission.rego`
6. `workflow_stages` * — `workflow_stage.rego`
7. `workflow_stage_definitions` * — `workflow_stage_definition.rego`
8. `workflow_definitions` * — `workflow_definition.rego`
9. `project_fields` * — `project_field.rego`
10. `attachments` * — `attachment.rego`
11. `audit_history` → entity **`AuditEvent`** * — `audit_event.rego`
12. `notifications` * — `notification.rego`
13. `poc_meetings` → entity **`Meeting`** * — `meeting.rego` (see spec 003 §"`.appfw/model` boundary")
14. `comments` (partial) — `comment.rego`
15. `risk_items` (partial) — `risk_item.rego`
16. `project_stakeholders` (unwired) — `project_stakeholder.rego`
17. `checklist_items` (unwired) — `checklist_item.rego`
18. `task_assignments` (unwired) — `task_assignment.rego`
19. `workflow_instances` (unwired) — `workflow_instance.rego`
20. `workflow_tasks` (unwired) — `workflow_task.rego`
21. `knowledge_documents` (unwired) — `knowledge_document.rego`
22. `knowledge_chunks` (unwired) — `knowledge_chunk.rego`
23. `graph_subscriptions` (unwired) — `graph_subscription.rego`
24. `email_queue` (unwired) — `email_queue.rego`

Plus `<entity>_audit.rego` for each entity that ends up with `facets: [audited]` (read-only; `admin`/`epmo`). The `.appfw/model` mirrors the full ~24-table data model (scope ceiling); human-owned services are built only for the wired subset, but **every table still needs its `.rego`** or it is inaccessible.

---

## Acceptance evidence

Commands that *will* prove conformance once the framework CLI can run (file 07 §7.4):

- `scripts/appfw product validate --json` — **0 RBAC lints**; every `governance` table entity resolves to a hand-authored `rbac/*.rego`; no `primary_schema`/`primary_data_source`, no credentials in config.
- `scripts/appfw product policy-test` — all `rego_test` fixtures pass; positive fixtures confirm each role reaches its intended rows; **negative fixtures fail closed** — denied read for out-of-scope role returns `{"allow": false}`; a `project_manager` querying a project they do not manage gets a filter that excludes it; a non-assigned reviewer's gate decision is denied; any `viewer` write is denied.
- `scripts/appfw product test` — generated API scenarios pass, including: self-registration yields `role = VIEWER`; `POST /users` as non-admin is rejected; `audit_history` read as a non-`admin`/`epmo` role is rejected.
- `scripts/appfw product handoff --json` — names this spec path + status.

Expectation stated for the reviewer: the `rego_test` negative fixtures are the load-bearing evidence — a green run must include them actually denying, not merely absent.

---

## Open decisions

| # | Decision | Recommendation | Who decides |
|---|---|---|---|
| Q7 | Enum casing. Migration `m20260101_000001` declares the 9 Postgres enums lowercase; the entity layer + `m20260902_000001` use SCREAMING_SNAKE, and `m20260901`/`m20260902` dropped `workflow_stage_status` + `task_status`. This spec's `.rego` role literals and the auth-boundary `roles[]` projection depend on the chosen casing. `project_status` is additionally 6 values in `m..._000001` vs **7** in the entity layer (adds `IN_DELIVERY`). `WorkflowStageStatus` specifically is owned by **spec 002 Q7** (its base and entity label sets are *disjoint*, not just cased differently). | Entity-layer **SCREAMING_SNAKE authoritative** for the 8 stable enums (`project_status` = the 7-value set incl. `IN_DELIVERY`); `user_role`'s 14 values carry over as-is. **For Rego specifically:** project the role to **lowercase** in `roles[]` (matches all framework examples + `system/rbac/user.rego`); if overridden, it is a mechanical find-replace of string literals across `governance/rbac/*.rego` + `rego_test`, no rule-structure change. Also decide whether `projects.current_owner_role` (free lowercase string) is normalised to the enum or kept as-is with case-insensitive comparison moved into the rego body. | Human architect, M3 checkpoint |
| A | **Actor identity in `input.user`. (Shared with spec 002 — both specs depend on the answer.)** File 02 §5 documents `input.user` as carrying `.roles` and `.tenant_id` only — no actor id. Owner/recipient/author row filters in the plan (`Project.update` by manager, `Notification` by recipient, `ProjectField`/`Comment`/`ProjectStakeholder` by project owner) all need one. Per file 00 ground rule 3, not inventing it here. | Confirm whether the generated wrapper/actor context exposes an actor id (e.g. `input.user.id` / `input.user.sub`). If yes, Rego row filters use it as written and own **all single-row-column** owner scoping; the service layer (spec 002) then only enforces parent-row / cross-entity ownership Rego cannot express (e.g. current-gate-owner routing). If no, the single-row filters degrade to **role-only** and "manager may edit only their own project" is an accepted gap until a claim/context change adds it. | Human architect, M3 checkpoint |
| B | **Audit model (= plan Q5).** Legacy `audit_history` is a single hand-rolled table that `record_audit()` writes. The rebuild uses **both** mechanisms, per spec 002: (1) the framework `audited` facet (ADR 0004 — per-entity 21-field append-only hash-chained companion, record-level before/after diffs) on the regulated mutated entities **`Project`, `GateReview`, `ProjectApproval`, `Attachment`, `User`, `GateSubmission`**; each such entity gets a read-only `<entity>_audit.rego` (`admin`/`epmo`). (2) The legacy `audit_history` table → entity **`AuditEvent`** (append-only; `standard_methods` exclude `Update`/`Delete`), written only by the product `audit` service for the ~18 named semantic governance events (design §18) plus login/non-entity events. Decision for the human: confirm this two-mechanism split and the six-entity facet list. | Human architect, M3 checkpoint (with spec 002) |
| C | **Real `tenant_id` claim later (multi-tenant).** Out of scope now. | Future ADR only if Governance is ever multi-tenanted; the current policy set adds `tenant_filter` calls at that point with no structural change. | Human architect, future |
| D | **Identity provider switch (legacy JWT → Okta/OIDC).** Framework default is Okta/JWT (file 05 §5.7); legacy ships its own HS256 JWT + refresh flow. | Defer to a dedicated ADR; keep legacy JWT for the rebuild. `roles[]` projection is provider-agnostic so policies are unaffected. | Human architect, future |

---

## Status

`draft`
