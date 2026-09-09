# 12. Operations, known gaps, and glossary

The reference you'll come back to.

---

## 12.1 Command cheat-sheet

### Backend (from `project-governance/` or `backend/`)

```bash
cargo check --workspace --all-targets     # type-check everything (fast)
cargo build -p backend                    # build the debug binary
cargo run -p backend                      # build + run on 127.0.0.1:8080
cargo test --workspace                    # unit tests (backend + rego_test + api_tests compile)
cargo test -p rego_test                   # Rego policy contract tests (needs ../app-framework)
cargo run -p api_tests                    # live GraphQL scenario tests (backend must be running)
cargo clean                               # delete target/ (~12 GB) — next build is cold
```

### Frontend (from `frontend/`)

```bash
npm install                               # populate node_modules/
npm run dev                               # Vite dev server on :5173 (proxies API to :8080)
npm run typecheck                         # tsc --noEmit
npm run test                              # vitest
npm run appfw:check                       # scaffold-contract check
npm run phi:check                         # PHI/PII source lint
npm run build                             # emit SPA bundle to ../backend/product_dist
npm run test:frontend                     # appfw:check → phi:check → typecheck → test → build
```

### Framework CLI (Windows: prefix with the `rust-appfw` container — chapter 3.7)

```bash
scripts/appfw product validate --json          # validate the model
scripts/appfw product generate                 # (re)write all generated artifacts
scripts/appfw product generate --check --json  # fail if committed generated code drifted
scripts/appfw product boundary-check --json    # fail if hand-code leaked into generated files
scripts/appfw product policy-test --json       # Rego policy tests
scripts/appfw product harness-check --json     # API-test-harness conformance
scripts/appfw product migrate                  # apply DDL + seeds to the DB
scripts/appfw product lock --write             # refresh appfw.lock
scripts/appfw product test --fast              # the fast verification path
```

### Database (local, via the compose container)

```bash
docker compose -f podman-compose.yml up -d postgres
docker exec -i governance-postgres psql -U postgres -d governance < database/_pkg/schemas/governance/tables.pg.sql
docker exec -i governance-postgres psql -U postgres -d governance < database/_pkg/schemas/governance/seed.pg.sql
docker exec governance-postgres psql -U postgres -d governance -c "\dt governance.*"
python scripts/smoke/smoke_test.py             # end-to-end + audit hash-chain check
```

### Before you push a change

```bash
cargo check --workspace --all-targets
cargo test --workspace
cd frontend && npm run test:frontend && cd ..
scripts/appfw product generate --check --json      # (container) must pass
scripts/appfw product boundary-check --json        # (container) must pass
```

---

## 12.2 Storage & time (measured on this machine, 2026-09)

| Item | Value |
|------|-------|
| `project-governance` source (no `target`/`node_modules`/`.git`) | ~6 MB |
| `app-framework` source | ~96 MB |
| `frontend/node_modules/` | ~113 MB |
| **`project-governance/target/` fully built** | **~12 GB** |
| Debug `backend.exe` / `backend.pdb` | ~80 MB / ~575 MB |
| Docker images (`postgres:14` + `rust:1`) | ~1.7 GB |
| Rust toolchain + cargo registry cache | ~1.5–2 GB |
| **Recommended free disk** | **≥ 16 GB** |
| `cargo check --workspace` — warm | ~36 s (measured) |
| `cargo check --workspace` — cold | 8–20 min (estimate) |
| `cargo build --release -p backend` — cold | 10–25 min (estimate) |
| `npm install` | 1–2 min |
| `npm run typecheck` | ~10 s (measured) |
| `npm run build` | ~20–60 s (estimate) |
| Backend cold start (binary exists) | 1–3 s |
| Postgres container → healthy | ~15 s |

**Runtime memory:** the backend is a single process; expect a few hundred MB
resident. The 128 MiB worker stack (`BACKEND_WORKER_STACK_MIB`) is *reserved
address space committed lazily by the OS*, not resident RAM (see the `main.rs`
comment). Postgres container: ~50–150 MB for a dev dataset.

---

## 12.3 Where things are enforced (quick map)

| Concern | Enforced in |
|---------|-------------|
| "Who are you" (authentication) | `appfw_runtime` — JWT → `UserAuth`; local test-auth via `APP_ENABLE_LOCAL_TEST_AUTH` |
| "What may you do" (role + row filter) | `.appfw/model/schemas/governance/rbac/*.rego` → compiled → run in `config/app_config.rs::evaluate_user_access` on **every** read/write |
| Parent-row / chain ownership | `backend/src/services/*.rs` (service layer) — see [6.6](06-workflow-engine.md#66-the-authorization-split-why-some-checks-are-in-rust) |
| Tenant isolation | `backend/src/platform/tenant_isolation.rs` — no-op today (no entity has `tenant_id`) |
| Optimistic locking | `concurrency` facet → `version` column; services round-trip it |
| Row-level audit (hash chain) | `audited` facet → DB trigger → `<entity>_audit` tables |
| Semantic audit events | `backend/src/services/audit.rs` → append-only `AuditEvent` |
| PHI never leaves for AI | `backend/src/services/ai_extraction/phi_gate.rs` — pre-egress, refuse-don't-redact |
| Graph writes governed | `backend/src/services/graph/writes.rs` — the 8-component G1 stack |
| GraphQL abuse (deep/complex queries) | `routes/governance.rs` — `limit_depth` / `limit_complexity` |
| Introspection exposure | `APP_GRAPHQL_INTROSPECTION_ENABLED` + `_REQUIRED_ROLES` |

---

## 12.4 Known gaps and open decisions

### Open product decisions ([`docs/architecture/open-decisions.md`](../architecture/open-decisions.md))

| ID | What's undecided | Blocks |
|----|------------------|--------|
| **P5** | The authoritative Excel gate/field matrix is not in the repo. The 19-stage DAG is the legacy placeholder. | full gate-workflow fidelity; `gate_eligibility` returns `provisional: true`; `conditions` (skip rules) not evaluated |
| **Q7** | Enum casing (SCREAMING_SNAKE authoritative) + the exact `WorkflowStageStatus` label set | generated enum types, every Rego role literal |
| **A** | Does the runtime carry an actor **id** (not just role) in the Rego input? | single-row owner filters in Rego; if not, they degrade to role-only and more scoping moves to the service layer; the `rego_test` owner-filter fixtures are on hold |
| **Q5 / B** | Which six entities carry the `audited` facet vs. rely on `AuditEvent` | which `*_audit` tables generate |
| **Q3** | Keep the pgvector / RAG knowledge base or drop it | whether `KnowledgeDocument`/`KnowledgeChunk` become real; `embedding` column already dropped |
| project_number | Framework `computed:` has no sequence option; the server-side Create `_impl` generation was never built | **currently the frontend (`IntakeScreen.tsx`) generates it and sends it**; a direct `createProject` without it fails |
| Identity provider | Legacy HS256 JWT vs PDS Okta/OIDC | managed-environment auth topology |

### Framework re-adoption issues — found 2026-09-09 ([chapter 13](13-verification-log.md))

| # | Defect | Owner | Status |
|---|--------|-------|--------|
| 13.2 | Generated `seed.pg.sql` emits `ARRAY['admin']` for `jsonb` columns → `product migrate` fails | **PDS framework** (`app_gen` seed generator) | Reported to PDS (Finding Q). Not fixed here — `sed` workaround in the setup guide. |
| 13.3 | `eligibleGates`/`workspace`/`pendingApprovals`/`submitDecision` pass a stale array `sort` + `limit 500` > cap 250 | **Product** (`services/{approval_state_machine,gate_eligibility,workspace}.rs` tracking the framework contract) | ✅ Fixed & verified live — 5 sort + 3 page-size sites. |
| 13.4 | `createProject` fails when a nullable `jsonb` column is omitted — `error serializing parameter N` | **PDS framework** (`appfw_provider_postgres/src/param.rs`, sibling of Finding N) | Reported to PDS (Finding P). Not fixed here — send `{}` for nullable jsonb. |

The two framework-side items are written up for PDS in
[`docs/architecture/framework-issues-for-pds.md`](../architecture/framework-issues-for-pds.md)
(repro, root cause, proposed fix, workaround for each, plus a `sort` / page-size
compatibility note). **Fixing framework bugs is not this team's job** — those two
are PDS's to fix and release.

### Built-but-incomplete

| Area | State | Reference |
|------|-------|-----------|
| Auto-process meeting transcript on meeting end | **not built** — only the manual `processTranscript` mutation works. No Graph subscription, no webhook, no renewer. `graph_subscriptions` empty; no `tokio::spawn` anywhere. | [`meeting-graph-gaps.md`](../architecture/meeting-graph-gaps.md) |
| `CreateSubscription` / `RenewSubscription` / `DeleteSubscription` Graph writes | registered in `writes.rs` (G1 applies) but **no handler entry point** — need a public HTTPS callback this environment lacks | `services/graph/writes.rs` |
| SharePoint upload | registered placeholder only; `plan()`/`body()` return `None` | decision 004 D1 |
| Organizer-availability check (`getSchedule`) | `ReadOperation::CheckOrganizerAvailability` exists but `#[allow(dead_code)]` — not wired to a custom method | `meeting-graph-gaps.md` §Remaining work |
| `.docx` document extraction | not supported (documented limitation); `.txt` + PDF only | `ai_extraction/text_extract.rs` |
| Password login | **no `/login` mutation exists.** Local dev: no auth header → admin, or an `appfw-local:` token. Managed: Okta only. Seed ships a placeholder Argon2 hash for a future login path. | chapter 4.10; `schemas/common.rs` unused `Login` DTOs |
| Real document/blob storage | `Attachment` has `s3_key` etc. but storage is deferred | decision 004; `s3_service.rs` in legacy had zero call sites |
| `WorkflowInstance` / `WorkflowTask` / `TaskAssignment` / `ChecklistItem` | modelled for schema fidelity; nothing creates rows | chapter 5.2 |
| Analytics screen | placeholder (`/analytics` → "coming soon") | `frontend/src/app/App.tsx` |
| `rego_test` coverage | only `comment.rego` covered | `rego_test/README.md` |

### PDS deployment readiness ([`docs/architecture/deployment-pds.md`](../architecture/deployment-pds.md))

Not deployable to PDS as-is. Missing: a `bitbucket-pipelines.yml`, the `app/`
layout (`app/Dockerfile`, `app/microservice_name`), the three Helm/ArgoCD paired
repos, the framework published to the ProGet Cargo registry (for hermetic
container builds — "Mode A"), and secrets moved out of `.env` into per-environment
Bitbucket deployment variables. `GRAPH_NOTIFICATION_CLIENT_STATE` should be
rotated (it has been committed in docs).

---

## 12.5 Read these three architecture docs

They are short and they matter:

1. [`docs/architecture/open-decisions.md`](../architecture/open-decisions.md) —
   the 5 unresolved product decisions that can still change generated output.
2. [`docs/architecture/meeting-graph-gaps.md`](../architecture/meeting-graph-gaps.md) —
   the diagnosed meeting bugs, what's fixed (calendar-backed scheduling,
   directory search), and the detailed plan for the transcript-automation work
   that isn't built.
3. [`docs/architecture/deployment-pds.md`](../architecture/deployment-pds.md) —
   how PDS expects a service to deploy and the gap list to get there.

And, in the framework repo:
[`app-framework/PATCHES.md`](../../../app-framework/PATCHES.md) — the local
framework patches carried ahead of upstream (currently one: the `jsonb[]` null
binding fix).

---

## 12.6 Glossary

| Term | Meaning in this project |
|------|-------------------------|
| **`.appfw` model** | The YAML under `.appfw/model/` describing entities, enums, relationships, policies, seeds — the source of truth for code generation. |
| **`app_gen`** | The framework's code generator. Reads the model, writes the backend/DB/frontend generated files. |
| **`appfw.lock`** | Records which framework commit + generator + template hashes produced the committed generated code. |
| **Argon2 / Argon2id** | A password-hashing algorithm. `User.hashed_password` stores an Argon2id hash, never a plaintext password. |
| **async / `.await`** | Rust's model for I/O. An `async fn` doesn't run until `.await`ed; every DB/network call is awaited. |
| **Axum** | The Rust web framework the HTTP layer is built on (via `appfw_runtime`). |
| **boundary-check** | `scripts/appfw product boundary-check` — fails if hand-written code leaked into generated files or vice versa. |
| **Cargo** | Rust's build tool + package manager. |
| **claims** | The facts inside a JWT (username, roles, tenant, expiry). |
| **connection pool** | A set of reusable open DB connections (`deadpool-postgres`). |
| **CORS** | Cross-Origin Resource Sharing — the browser rule that lets `:5173` call `:8080`. `APP_CORS_ALLOWED_ORIGINS`. |
| **crate** | A Rust package. `backend`, `api_tests`, `rego_test`, `appfw_runtime`, … |
| **CTE** | Common Table Expression — a `WITH ... AS (...)` SQL clause. `data/clients/postgres/cte.rs` builds these for nested selections. |
| **custom method** | A non-CRUD operation declared on an entity in the model (`Project.submit_decision`). The generator emits an empty `_impl` stub; your team writes the body. |
| **DAG** | Directed Acyclic Graph — here, the gate stages and their prerequisite edges. |
| **DataAccess** | The single backend object every read/write goes through. Runs the Rego policy + tenant filter, then SQL. |
| **DDL** | Data Definition Language — SQL that creates/alters tables. |
| **`deadpool-postgres`** | The Postgres connection-pool library. |
| **facet** | A reusable entity-level behaviour mixed in by name: `audited` (hash-chained companion table), `concurrency` (a `version` column). |
| **feature (Cargo)** | A compile-time on/off switch. `http`, `provider-postgres` on; `mcp`/`kafka`/`sync` off. |
| **fragment** | A reusable property template in `.appfw/model/_fragments/` (`property-string-required`). |
| **G1** | The 8-component "governed write" stack for Microsoft Graph writes (`services/graph/writes.rs`). |
| **generated / `[G]`** | Written by `app_gen` from the model; do not hand-edit. |
| **GraphQL** | The API style: one endpoint, the caller sends a query describing the exact data it wants. `/governance`. |
| **hash / SHA-1 / SHA-256** | A function turning input into a fixed-size fingerprint that changes completely if the input changes. Git commits use SHA-1; `appfw.lock` and the audit chain use SHA-256. |
| **hash chain** | Each audit row's `event_hash` includes the previous row's hash, so tampering is detectable. |
| **`_impl`** | A hand-written custom-method body in `backend/src/handlers/governance/<entity>.rs`; almost always a one-line call into `services/`. |
| **introspection** | Asking a GraphQL server to describe its own schema. On in local dev, role-restricted in prod. |
| **JWT ("jot")** | JSON Web Token — a signed token the browser sends in `Authorization: Bearer`. |
| **migration** | A versioned DB structure change applied in order. (This project applies DDL wholesale + idempotently rather than incremental migration files.) |
| **`mod.rs`** | A folder's "front door" file in Rust — lists the folder's other modules. |
| **Okta / OIDC** | The identity provider expected in managed environments. |
| **optimistic locking** | Every update carries the `version` it read; the write is rejected if the row changed meanwhile. |
| **PHI / PII** | Protected Health Information / Personally Identifiable Information. The `phi_gate` refuses to send anything containing it to OpenAI. |
| **product / `[P]`** | Hand-written code your team owns and edits. |
| **projection** | (1) the generated read-shape struct `<Entity>Projection`; (2) the generator "projecting" nav fields onto an entity from a relationship. |
| **provider** | A framework database/SaaS adapter. This app compiles only `appfw_provider_postgres`. |
| **RBAC** | Role-Based Access Control. |
| **Rego** | The policy language for the RBAC files. Evaluated at runtime by `regorus`. |
| **`regorus`** | The Rust Rego engine. |
| **relationship (model)** | A `OneToMany` + storage `ForeignKey` declaration; the generator projects the nav fields. |
| **schema** | Three meanings: a Postgres namespace (`governance`, `system`); the GraphQL type system; the `.appfw` model. This guide disambiguates when it matters. |
| **seed** | Initial rows inserted after tables are created (users, workflow definitions). |
| **selection set** | The list of fields a GraphQL query asks for. Services build the same shape by hand with `field()`/`selection()`. |
| **SPA** | Single-Page Application — the React frontend. |
| **tenant** | A customer/org whose data is isolated. This app is single-tenant. |
| **`tracing`** | The Rust structured-logging crate. `#[tracing::instrument]` groups logs per operation. |
| **Vite** | The frontend build tool + dev server. |
| **VTT / WEBVTT** | The subtitle/transcript text format Teams produces. `vtt_to_text` strips its markup. |
| **workspace (Cargo)** | The set of crates built together (root `Cargo.toml`). |
| **workspace (product)** | The gate-operator screen / the `Project.workspace` custom method that assembles its payload. |

---

## 12.7 A 60-second orientation for a new teammate

1. This is a **schema-driven** app. The model is `.appfw/model/`. A generator in
   `../app-framework` turns it into most of the backend.
2. **You edit**: `.appfw/model/**`, `backend/src/services/**`, the `_impl` bodies
   in `backend/src/handlers/governance/<entity>.rs`, `.appfw/model/.../rbac/*.rego`,
   and all of `frontend/src/**` except `frontend/src/generated/`.
3. **You don't edit**: anything marked `// Generated by app_gen`,
   `backend/config/generated/`, `database/_pkg/`, `frontend/src/generated/`.
   Change the model and run `scripts/appfw product generate` instead.
4. **The custom heart** is the gate/workflow engine in `backend/src/services/` —
   [chapter 6](06-workflow-engine.md).
5. Every request goes **browser → GraphQL → handler → service → DataAccess
   (Rego + SQL) → Postgres** — [chapter 7](07-request-flows.md).
6. To run it: [chapter 4](04-getting-started.md).
7. Before it's "done" for PDS: [`deployment-pds.md`](../architecture/deployment-pds.md).

---

*End of the onboarding guide. Corrections and additions welcome — this folder is
part of the repo.*
