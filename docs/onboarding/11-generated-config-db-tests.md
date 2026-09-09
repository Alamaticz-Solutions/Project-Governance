# 11. `backend/config/`, `database/`, `api_tests/`, `rego_test/`, `scripts/`, Docker, `target/`

The remaining folders. Markers as before: **[P]** hand-written, **[G]**
generated, **[G-once]** generated then hand-owned.

---

## 11.1 `backend/config/` — the runtime config the backend reads at startup [all G]

`config/loader.rs` reads this folder at boot (chapter 7.0 step 4). It is
generated from `.appfw/model/**` by `app_gen`.

```
backend/config/generated/
├── data_sources.yaml                         [G]  the pg_primary data source + environments
├── sync_workers.yaml                         [G]  sync-worker plan — enabled: false, worker_count: 0
└── schemas/
    ├── governance/
    │   ├── schema.yaml                       [G]  id, name, description, data_source_name
    │   ├── entity_types.yaml                 [G]  every entity, fully expanded (fragments + facets resolved) — the runtime metadata
    │   └── <entity>.rego  × 42               [G]  the WRAPPED policies (bodies from .appfw/model/rbac/ + generated header/helpers)
    └── system/
        ├── schema.yaml                       [G]
        ├── entity_types.yaml                 [G]  the framework meta-entities
        └── user.rego                         [G]
```

Why a *second* copy of the model as YAML (separate from `.appfw/model/`): the
`.appfw/model/` tree is authored with fragments/facets/relationships that a human
maintains; `backend/config/generated/` is the **flattened, resolved** form the
running backend actually parses — no fragment references, every projected nav
field materialised, every Rego file wrapped and ready to compile. You never edit
`backend/config/`; edit `.appfw/model/` and regenerate.

`sync_workers.yaml` is `enabled: false` with seven `activation_gates` unmet —
the framework's change-data-capture / projection-worker subsystem, entirely
dormant for this product.

---

## 11.2 `database/` — the generated database package [all G except README]

```
database/
├── README.md                                 [P]  regenerate + apply instructions
├── _pkg/
│   ├── data_sources.yaml                     [G]  pg_primary, environments local + compose
│   └── schemas/governance/
│       ├── schema.yaml                       [G]
│       ├── tables.pg.sql                     [G]  ~3,800 lines — CREATE/ALTER every governance.* table, enum, *_audit companion, index, audit hash-chain trigger. Re-runnable (IF NOT EXISTS).
│       ├── seed.pg.sql                       [G]  ~920 lines — the 7 users + workflow definitions + 19 stage definitions (from .appfw/model/schemas/governance/seeds/)
│       ├── tables.mssql.sql / .snowflake.sql [G]  the same DDL in other SQL dialects (unused — Postgres-only product)
│       ├── seed.mssql.sql / .snowflake.sql   [G]  ditto
│       ├── tables.mongo.json / seed.mongo.json [G] MongoDB shape (unused)
└── target/appfw/database_metrics.{json,prom} [G]  generator diagnostics
```

Apply it with `scripts/appfw product migrate` (in the container on Windows) or by
piping `tables.pg.sql` then `seed.pg.sql` into `psql` (chapter 4.6). There is no
`database/_pkg/migrations/` folder yet — the DDL is applied wholesale and is
written to be idempotent.

---

## 11.3 `api_tests/` — live-server GraphQL scenario tests

A **separate Cargo crate** (a workspace member) that connects to an
already-running backend over HTTP and asserts on GraphQL responses. Not linked
into the `backend` binary.

```
api_tests/
├── Cargo.toml                                [P]  its own deps: reqwest, graphql_client, tokio
├── README.md                                 [P]
└── src/
    ├── main.rs / lib.rs                      [P]  entry — runs every scenario, prints a report
    ├── harness/
    │   ├── mod.rs                            [P]  "connects to a running backend over HTTP and asserts on its GraphQL responses"
    │   ├── config.rs                         [P]  backend URL, auth token env
    │   ├── auth.rs                           [P]  mints/loads the test bearer tokens (pdsh_admin, etc.)
    │   ├── graphql_client.rs                 [P]  the HTTP GraphQL client for tests
    │   ├── scenario.rs                       [P]  the Scenario type + runner
    │   ├── assertions.rs                     [P]  expect-block matching
    │   └── result_store.rs                   [P]  captures results across scenarios (for chained tests)
    └── schemas/
        ├── mod.rs                            [G]
        └── governance/
            ├── mod.rs                        [G]
            ├── projects.rs                   [G]  from .appfw/model/schemas/governance/tests/projects.yaml
            └── users.rs                      [G]  from .appfw/model/schemas/governance/tests/users.yaml
```

**Run:** `cargo run -p backend` in one shell, `cargo run -p api_tests` in
another. Regenerate the scenario modules after editing the `tests/*.yaml`
fixtures with `scripts/appfw product generate` (or `harness-check`).

---

## 11.4 `rego_test/` — policy contract tests

Another workspace-member crate. Verifies the **generated** Rego policies behave
(deny-by-default, correct allows/denies per role) using the framework's
`appfw-test` policy verifier.

```
rego_test/
├── Cargo.toml                                [P]  path-depends on ../../app-framework/appfw_test
├── Cargo.lock                                [P]
├── README.md                                 [P]  coverage goals
├── src/{lib.rs,main.rs}                      [P]  trivial (a marker fn + empty main)
└── tests/policy_contract.rs                  [P]  the actual tests
```

`policy_contract.rs` runs fixtures against
`backend/config/generated/schemas/governance/comment.rego` (e.g. "admin is
allowed every action", "a role with no matching rule is denied"). **Only
`comment.rego` is covered so far** — the README lists the coverage goals for the
rest. The single-row-owner-filter branch that reads `input.user.id` is
**deliberately not tested** because that field's presence is unresolved open
decision **A** — testing it would silently pick a side.

**Run:** `cargo test -p rego_test` (needs the `../app-framework` checkout —
`appfw-test` is a path dep).

---

## 11.5 `scripts/`

| Path | | What it does |
|------|--|--------------|
| `scripts/appfw` | [P] | Bash wrapper around the framework CLI. Resolves the framework root, checks for `Cargo.lock`, `exec`s `cargo run -p appfw-cli -- --app-root <here> --framework-root <fw> <args>`. Run in the `rust-appfw` container on Windows. Subcommands in [chapter 3.7](03-framework-dependency.md#37-running-the-generator-and-why-windows-needs-a-container). |
| `scripts/smoke/README.md` | [P] | Live smoke-test instructions + what it verifies. |
| `scripts/smoke/smoke_test.py` | [P] | End-to-end check: create a `Comment` via GraphQL, then `docker exec ... psql` into `governance.comments_audit` to confirm the **hash chain** recorded the insert + update with linked `prev_hash`/`event_hash`. Python stdlib only. Chapter 4.12. |

---

## 11.6 Docker / compose

| File | | What it does |
|------|--|--------------|
| `backend/Dockerfile` | [P] | The production image (chapter 8.1). Build context = the parent dir (needs both repos). |
| `backend/Dockerfile.dockerignore` | [P] | Build-context excludes. |
| `.dockerignore` (repo root) | [P] | Root-level context excludes. |
| `podman-compose.yml` | [G] | Generated from `manifest.yaml` + data-source config. Services: `postgres` (`postgres:14`, the local DB — the one you actually use), `backend` (`rust:latest`, bind-mounts `./backend` and `../app-framework/appfw_runtime`, runs `cargo run` — an *alternative* to running the backend on the host, less common), and behind the `observability` profile: `loki`, `alloy`, `prometheus`, `alertmanager`, `grafana` (all bind-mounting configs from `../app-framework/observability/`). Networks `app-network` + `observability-network`; volumes `postgres-data`, `backend-observability-logs`. |

For normal local development you use only the `postgres` service and run
`cargo run -p backend` + `npm run dev` on the host.

---

## 11.7 `target/` directories (all [G], none committed)

| Path | Size | What |
|------|------|------|
| `project-governance/target/` | **~12 GB** | Rust build output for the whole workspace (`backend`, `api_tests`, `rego_test`) + all compiled dependencies incl. the framework. `debug/` has the runnable `backend.exe` (~80 MB) + `backend.pdb` (~575 MB debug symbols). `cargo clean` empties it; next build is cold. |
| `project-governance/target/appfw-cargo/` | varies | `CARGO_TARGET_DIR` for the framework CLI when `scripts/appfw` runs (set in that script). |
| `.appfw/target/`, `database/target/`, `frontend/target/` | small | Generator / tool diagnostics (JSON). Not Rust build output. Safe to delete. |
| `frontend/node_modules/` | ~113 MB | npm dependencies. Not a `target/` but same idea — regenerate with `npm install`. |
| `app-framework/target/` | ~0.1 MB | The framework isn't built standalone; its crates compile into the product's `target/`. |

---

## 11.8 Root files not yet mentioned

| File | | What |
|------|--|------|
| `Cargo.toml` (root) | [P] | Workspace: members `api_tests`, `backend`, `rego_test`; `resolver = "2"`. |
| `Cargo.lock` (root) | [P] | Exact resolved versions for the whole workspace. Committed. |
| `.cargo/config.toml` | [P] | Declares the `pds-app-framework-crates` ProGet registry (for future "Mode A" — not used yet). |
| `.gitignore` | [P] | Ignores `target/`, `node_modules/`, `*.env`, etc. |
| `appfw.lock` | [G] | Framework provenance — [chapter 3.3](03-framework-dependency.md#33-appfwlock--the-provenance-record). |
| `README.md` | [P] | Repo overview + the ownership table + build/test commands. |
| `docs/architecture/*.md` | [P] | `open-decisions.md`, `meeting-graph-gaps.md`, `deployment-pds.md` — read all three (chapter 12.5). |
| `docs/onboarding/*.md` | [P] | This guide. |

---

Next: [`12-operations-and-glossary.md`](12-operations-and-glossary.md).
