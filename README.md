# Project Governance

Governance portfolio + gate-workflow application, rebuilt on the PDS App
Framework (schema-driven Rust/Axum backend generator + React/TS frontend
scaffold). Branch `governance-restructure`. Local git only.

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

Backend gates go through `scripts/appfw` and **require the App Framework restored
at `../app-framework/`** (it was removed as client IP — see HANDOFF §6), run in a
Linux container. Commands are listed in HANDOFF §5.

## Current state

- Backend generate / validate / boundary-check / `generate --check` /
  `product test`: green as of `937dfbd` (M9); not re-run at HEAD (framework absent).
- Frontend typecheck / build / appfw:check: green at HEAD.
- Independent 11-section + file-12 review: **still owed** — see HANDOFF §10.
