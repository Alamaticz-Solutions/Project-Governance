# Governance rebuild — spec index & reconciliation

Step 1 (specs) and Step 2 (legacy discovery inventory) of the M3 milestone. All four specs are `draft`.
This file is the authoritative reconciliation across them — read it before treating any single spec's
wording as final where they touch the same subject.

## Specs

| # | File | Depth | Owns |
|---|---|---|---|
| 001 | `001-auth-rbac-tenancy.md` | Full | Actor/JWT claim set, single-tenant posture, Argon2, register→viewer, admin-only user creation, **one hand-authored `.rego` per table entity** (bodies-only) + `<entity>_audit.rego` per audited entity, `rego_test` fixtures, the **Rego row-filter layer** (all single-row-column owner scoping). |
| 002 | `002-gate-workflow-engine.md` | Full | The net-new configurable gate/workflow engine: state machine + eligibility + transitions in `backend/src/services`, the workflow `custom_methods`, the `WorkflowStageStatus` enum, the `AuditEvent` entity design, the **service-layer authorization** for parent-row/cross-entity ownership Rego cannot express. |
| 003 | `003-msgraph-saas-provider.md` | Full | The governed MS Graph SaaS provider (named-operation registry, read-only initially, all writes G1-gated), the `Meeting` + `GraphSubscription` entities, and the `Meeting.process_transcript` custom method (orchestration). |
| 004 | `004-ai-storage-and-nonprimitives.md` | Lightweight | OpenAI egress boundary + pre-egress PHI gate, net-new `document_storage` service, pgvector/RAG decision, email, BPMN placement, Firebase removal, notifications writer note. |

Step 2 artifact: `.appfw/legacy-modernization.yaml` (full discovery inventory — 24 tables, three-tier
wired/unwired split, all routes/services/enums/FKs/sensitive fields, and the enum-casing break).

## Dependency graph

```
001 (auth/RBAC/tenancy)  ── foundational; 002, 003, 004 all build on it
      │
      ├── 002 (workflow engine)   depends on 001; defines AuditEvent + WorkflowStageStatus + the service-layer authz split
      ├── 003 (MS Graph provider)  depends on 001; owns Meeting entity + Meeting.process_transcript; calls 004's AI boundary
      └── 004 (AI / storage)       depends on 001; owns the AI-egress boundary 003 calls; owns document-storage + KB decisions
```

## Reconciled cross-spec points (previously inconsistent between the parallel drafts — now aligned)

1. **Audit (= plan Q5).** Two mechanisms, both used, stated identically in 001 §Open-decision-B and 002 §Risks:
   - `audited` **facet** (ADR 0004, per-entity 21-field hash-chained companion, record-level diffs) on the
     regulated mutated entities **`Project`, `GateReview`, `ProjectApproval`, `Attachment`, `User`, `GateSubmission`**.
     Each gets a read-only `<entity>_audit.rego` (`admin`/`epmo`).
   - Legacy `audit_history` table → entity **`AuditEvent`** (append-only; `standard_methods` exclude
     `Update`/`Delete`), written **only** by the product `audit` service for the ~18 named semantic
     governance events + login/non-entity events.

2. **Authorization split.** 001 owns the **Rego** layer, including every single-row-column row filter
   (`manager_id == actor`, `assigned_role == actor role`, `notifications.user_id == actor`). 002's
   **service layer** enforces only ownership Rego structurally cannot express as a single-row predicate
   (current-gate-owner routing where the owning role lives on a parent row). Both depend on **001 Open
   decision A** (whether `input.user` carries an actor id); if not, 001's single-row filters degrade to
   role-only and more scoping falls to 002's service layer.

3. **`Project` "delete".** Legacy `delete_project` is a **status transition** (`status = CANCELLED`),
   not a soft-delete flag. Modelled as a `Project.cancel` custom method (or an `override-standard`
   `Delete`), restricted to `{admin, epmo}` — **not** the `soft-deleted` facet. Aligned in 001's Project
   row and 002's standard-operation-overrides.

4. **`Meeting.process_transcript`.** One owner: **spec 003** (orchestration + idempotent claim/reaper).
   Sub-steps: transcript fetch = 003's governed Graph read `get_online_meeting_transcript` (or a
   manual VTT paste, no Graph call); extraction = **004's** single AI-egress boundary (004 owns the
   egress contract + PHI gate); persist = generated `Update` on `Meeting`. 002 defers all meeting work
   to 003.

5. **Document storage.** Net-new, not "keep S3" — `s3_service.rs` has zero call sites; real storage is
   ephemeral local disk. 004 specifies a config-driven `document_storage` service (S3 default,
   filesystem for dev); SharePoint is a Graph write → G1-gated → deferred (003 D1).

6. **Entity renames.** `poc_meetings` → `Meeting`; `audit_history` → `AuditEvent`; `email_queue` →
   `EmailQueueItem`. Final entity names are settled at M5 from `backend/src/entities/*.rs`; the specs
   use these consistently now.

7. **Enum casing.** SCREAMING_SNAKE is authoritative for entity/DB enum values (`project_status` = the
   7-value set incl. `IN_DELIVERY`). Rego role **string literals** are lowercase (matches all framework
   examples). `WorkflowStageStatus` specifically is owned by 002 Q7 (its legacy base and entity label
   sets are *disjoint*, not merely cased differently — see the inventory's `lookup_values` notes).

## Consolidated open decisions for the M3 human checkpoint

| ID | Decision | Recommendation | Spec(s) |
|---|---|---|---|
| **P5** | The authoritative Excel gate/field matrix is not in the repo; three conflicting gate vocabularies exist in-code. | Hard prerequisite. Build the engine skeleton + a provisional generic gate config; scope field-exact work "pending P5". Do not invent business field names. | 002 |
| **Q7** | Enum casing + `WorkflowStageStatus` label set. | Entity-layer SCREAMING_SNAKE authoritative (`project_status` = 7 values). `WorkflowStageStatus` = `LOCKED, ELIGIBLE, IN_PROGRESS, PENDING_APPROVAL, APPROVED, CHANGES_REQUESTED, REJECTED, SKIPPED`. Rego role literals lowercase. | 001, 002 |
| **A** | Does `input.user` carry an actor id? | Confirm from the generated wrapper. If yes, Rego owns all single-row owner scoping. If no, degrade to role-only + more in the service layer; log as an accepted gap. | 001, 002 |
| **B (Q5)** | Audit model. | The two-mechanism split in reconciled point 1 above; confirm the six-entity facet list. | 001, 002 |
| **Q3** | pgvector / RAG knowledge base (no vector type in `.appfw/model`). | Option (a): model `KnowledgeDocument`/`KnowledgeChunk` as normal entities, drop `embedding`, defer RAG. Zero-cost — the entity already omits the column and the tables are unwired. | 004 |
| **project_number** | Framework `computed:` has no sequence option. | Generate in the human-owned `Project` Create `_impl` using the existing (unused) `project_number_seq`. Provider-routine Function is the portable alternative. | 002 |
| **Document storage** | S3-backed `document_storage` now vs SharePoint later. | Build the S3-backed abstraction with a real config surface now; SharePoint is G1-gated, defer. | 003 (D1), 004 |
| **Transcript continuity** | Portal meeting scheduling is now write-gated, so the meeting-correlation key is not populated. | Ship two read-only ingestion paths (manual paste; admin-provisioned subscription) + a local-only "register external meeting" CRUD path. Accept the temporary reduction. | 003 (D2) |
| **D3** | No Microsoft Graph value in the `data_source_type` enum. | Do not register a Graph `.appfw/model` data source at all (Graph data isn't CRUD). Flag as a framework-source gap, not a violation. | 003 |
| **D5** | `compiler_contracted` — does the tier forbid an execution path? | Adopt the ADR 0002 reading (tier = no retained live run, not no code path). Fallback: relabel reads to `planned_gated` + execution waiver. | 003 |
| **Identity provider** | Legacy HS256 JWT vs framework Okta/OIDC default. | Keep the legacy JWT for the rebuild; the `roles[]` projection is provider-agnostic. Separate future ADR. | 001 (D) |
| **Analytics screen** | Placeholder today; the analytical-report frontend archetype has no example anywhere. | Defer until the document/workflow archetype (workspace/gate-review UI) is proven. | 004 |

## Findings against the current repo (surfaced during discovery — not rebuild scope, but recorded)

- Unauthenticated endpoints: all 8 `/teams-poc/*` routes + `GET /projects/:id/documents/:doc_id/download`.
- JWT validates `exp` only — no `aud`/`iss`.
- Hardcoded `SECRET_KEY` fallback in `config.rs`; hardcoded S3 bucket; committed Firebase `apiKey` literal;
  hardcoded `Demo1234!` for 7 seeded accounts.
- `audit_history.project_id` is `ON DELETE CASCADE` — a hard project delete would destroy its audit trail
  (mitigated only because delete is a soft cancel today).
- `generate_project_number` = `count()+1` — not concurrency-safe against the `UNIQUE` constraint.
- `backend/README.md` is stale (claims `attachments` / workflow tables unwired; they aren't).
- The manual SQL `2026-08-31_align_enum_types_to_rust.sql` pushes enum casing the opposite way from the
  entity layer and migration 0902 — stale, unsafe to run, do not carry forward.

## Not done here (needs the framework tooling, which is unavailable on this machine)

`scripts/appfw product validate` / `generate` / `test` — every spec's "Acceptance evidence" section lists
the commands that *will* prove conformance. Steps 3+ of the plan (author `.appfw/model`, generate, custom
methods, provider crate, frontend) resume once the framework is available in a Linux environment.
