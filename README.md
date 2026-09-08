# Project Governance

A governance portfolio and gate-workflow application: a schema-driven Rust/Axum
backend and a React/TypeScript single-page frontend, built on the PDS App
Framework.

## Architecture

The backend is generated and run on the **PDS App Framework** (`appfw_runtime`
plus `appfw-provider-postgres`), consumed as a pinned dependency. The
application model lives in `.appfw/model/**`; the framework's `app_gen`
generator turns that model into the GraphQL schema, routes, handler scaffolds,
database DDL, and the frontend contract. Durable business logic is hand-owned
and lives outside the generated surface.

| Path | Contents | Ownership |
|---|---|---|
| `.appfw/model/` | Application model — 24 governance entities, 9 enum types, RBAC policies, seeds. Source of truth. | Product |
| `.appfw/manifest.yaml` | Topology: schemas, data sources, ingress, UI packaging. | Product |
| `.appfw/specs/` | Feature specifications (auth/RBAC, gate-workflow engine, Microsoft Graph provider, AI storage). | Product |
| `backend/src/services/` | Gate/workflow engine and the governed Microsoft Graph provider. | Product |
| `backend/src/handlers/governance/<entity>.rs` | Custom method implementations; delegate to services. | Product |
| `backend/src/routes/`, `backend/src/schemas/`, `backend/src/handlers/**/generated.rs`, `backend/src/operations/` | Generated from the model. | Generated — do not hand-edit |
| `backend/src/platform/` | Thin product-side wiring over `appfw_runtime`. | Product |
| `frontend/src/features/**` | Product screens. | Product |
| `frontend/src/generated/` | Generated UI contract. | Generated — do not hand-edit |
| `frontend/src/ui/` | Self-owned component kit (`kit.tsx` + `kit.css`). | Product |

## Topology

- Single PostgreSQL data source (`pg_primary`) hosting the `governance` product
  schema and the framework `system` schema.
- Frontend: `scaffold` UI mode; built into the backend image and served at `/`
  when `APP_PRODUCT_UI_ENABLED=true` (single-image deployment).
- MCP server: off. Kafka: off. Single-tenant.

## Framework dependency

The framework is **not** vendored into this repository. It is consumed as a
sibling git checkout:

```
<parent>/
├── app-framework/       # Alamaticz-Solutions/app-framework, pinned
└── governance-appfw/    # this repository
```

`appfw.lock` records the exact framework commit this checkout builds against.
Clone `Alamaticz-Solutions/app-framework` as a sibling and check out the tag
named in `appfw.lock` (currently `pinned/local-patch-1`). See
`app-framework/PATCHES.md` for local patches carried ahead of PDS upstream.

## Build and test

```bash
# backend (framework must be present as ../app-framework)
cargo check --workspace --all-targets
cargo test --workspace

# model validation and codegen drift — the framework CLI is a bash wrapper;
# on Windows run it in a Linux container (see the note below)
scripts/appfw product validate --json
scripts/appfw product generate --check --json
scripts/appfw product boundary-check --json

# frontend
cd frontend && npm install
npm run typecheck && npm run test && npm run build
```

On Windows, `scripts/appfw` (an `appfw-cli` bash wrapper) is run inside a Linux
container:

```bash
docker run --rm -v <parent>:/work -w /work/governance-appfw \
  rust-appfw:latest ./scripts/appfw product validate --json
```

where `rust-appfw:latest` is `rust:1` with `rustfmt` and `rsync` added.

## Run locally

```bash
# 1. database
docker compose -f podman-compose.yml up -d postgres

# 2. backend on http://127.0.0.1:8080  (GraphQL at /governance and /system)
cargo run -p backend

# 3. end-to-end smoke test (see scripts/smoke/README.md for prerequisites)
python scripts/smoke/smoke_test.py
```

## Documentation

- `docs/architecture/` — architecture notes, including the governed Microsoft
  Graph write stack and the register of open decisions.
- `docs/research/` — options papers (e.g. SharePoint document storage).
- `.appfw/specs/` — the feature specifications and their reconciliation index.
- Component READMEs under `backend/`, `frontend/`, `database/`, `api_tests/`,
  `rego_test/`.
