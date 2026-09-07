# Project Governance

Governance portfolio + gate-workflow application: a schema-driven Rust/Axum
backend and React/TS frontend. Originally scaffolded from the PDS App
Framework's generator/runtime; as of backend framework replacement phase 7
(2026-09-07, see `docs/architecture/self-owned-backend-plan.md`), that
framework is no longer a dependency at all -- the backend runs on self-owned
code only (`product_gen`/`product_cli` replace the generator, `backend/src/
platform/*` replaces the runtime). Branch `governance-restructure`. Local git
only.

**Start here:** [`HANDOFF.md`](./HANDOFF.md) — full state, what is generated vs
hand-owned, how to run every gate, retained evidence, and the open decisions.

## Topology

- Product schema: `governance` on a single PostgreSQL (`pg_primary`)
- Frontend: `scaffold` UI mode; product screens under `frontend/src/features/**`
- MCP server: off · Kafka: off · single-tenant (`180000`)

## Layout

| Path | What |
|---|---|
| `.appfw/model/` | config source of truth (24 entities, 9 enum types, 41 governance RBAC policies + 1 framework `system`, seeds) — edit here, then regenerate |
| `.appfw/specs/` | four specs + `000-INDEX.md` reconciliation and the five open decisions |
| `backend/src/services/` | hand-owned M8 gate/workflow engine + M9 governed MS Graph provider |
| `backend/src/handlers/governance/<entity>.rs` | hand-owned `*_impl` fns (delegate to services) |
| `frontend/src/{lib,app,components,features}/` | product-owned SPA (M11) |
| `frontend/src/generated/`, `backend/src/{routes,schemas}/` | generated — do not hand-edit |
| `docs/evidence/` | retained gate output |

## Running the gates

Frontend needs no framework (vendored components):

```bash
cd frontend && npm install
npm run typecheck && npm run build && npm run appfw:check
```

Backend gates no longer need the App Framework at all (backend framework
replacement phase 7, complete 2026-09-07); `scripts/appfw` and the framework
checkout are both gone. Run everything directly with `cargo`, no Docker/Linux
container required:

```bash
cd product_gen
cargo run --bin product_cli -- generate --check --json
cargo run --bin product_cli -- boundary-check --json
cargo run --bin product_cli -- validate --json
cd .. && cargo check --workspace --all-targets && cargo test -p backend --bin backend
```

## Current state

- `appfw_runtime` is no longer a dependency of `backend` at all -- removed
  from `backend/Cargo.toml`, and the local framework reference copy deleted
  from disk (2026-09-07). `cargo check --workspace --all-targets` and the
  full backend test suite (311 tests) both pass with the framework genuinely
  absent from disk.
- Backend generate / validate / boundary-check / `generate --check`: green at
  HEAD, verified directly (no framework needed to run them any more).
- Frontend typecheck / build / appfw:check: green at HEAD.
- Independent 11-section + file-12 review: **still owed** — see HANDOFF §10.
