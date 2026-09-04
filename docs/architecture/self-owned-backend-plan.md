# Replacing the App Framework backend: scoping plan

**Status:** draft, no code written against this plan yet.
**Companion to:** the frontend replacement already shipped (`frontend/src/ui/kit.tsx` — see commit `f4d741d`, "Replace vendored @appfw/pds-health-components with a self-owned UI kit").

## Why this exists

The client's App Framework was supplied as a reference for how to structure Project Governance, not as something the shipped product should carry a runtime dependency on — especially since this product may be pitched to other clients. The frontend dependency (a vendored component library) was bounded and has been replaced already. The backend dependency is not bounded the same way: it is a code generator plus a runtime, and replacing it means replacing a small framework, not a component set. This document scopes that work before any of it starts.

## What the product actually depends on today

Five path-dependency crates, all resolved from a sibling `../../app-framework/` checkout (client IP, not present in this repo):

| Crate | What it does | Roughly how much of it the product exercises |
|---|---|---|
| `appfw_runtime` | Codegen input (`.appfw/model/**`) → GraphQL schema (async-graphql), request pipeline, JWT extraction (Okta + local-dev bypass), the `DataAccess` trait or provider-backed CRUD every service call goes through, Rego policy evaluation wiring, OpenTelemetry setup, config loading. Also ships `app_gen`, the CLI/codegen binary invoked by `scripts/appfw`. | Nearly all of it — this is the framework's core. |
| `appfw_provider_postgres` | Turns `RuntimeDataType` + a `serde_json::Value` into parameterized SQL for Postgres (insert/update/select), via `tokio-postgres`/`deadpool-postgres`. | All of it — this product is Postgres-only. |
| `appfw_mssql_auth` | MSSQL auth token acquisition for a provider we don't use (product is Postgres-only). | Effectively unused — dead weight. |
| `appfw_saas_core` | OAuth M2M token cache, redaction helpers, retry-after parsing — used by `backend/src/services/graph` (Microsoft Graph integration). | A handful of small, generic utility functions. |
| `appfw_test` | Test harness helpers for `api_tests`/`rego_test`. | A thin assertion/fixture layer. |

Two things already **aren't** framework-dependent and stay as-is regardless of what we do below:
- **Rego policy evaluation itself** — `regorus = "0.2"` (open-source Rust Rego engine) is already a direct `backend/Cargo.toml` dependency, separate from `appfw_runtime`. The `.rego` policy files under `.appfw/model/schemas/**/rbac/*.rego` and their generated wrappers under `backend/config/generated/schemas/**/*.rego` are product-owned, hand-authored content — only the *generator that wraps and publishes them* is framework code.
- **The database driver** — `tokio-postgres`/`deadpool-postgres`/`postgres-types` are already direct, open-source dependencies. `appfw_provider_postgres` sits on top of them; it doesn't replace them.

## Architecture options

**Option A — Hand-written, no generator.** Drop `app_gen` entirely. Write the GraphQL schema, resolvers, and Rego-check call sites directly in Rust for each of the 41 entities, by hand or via a one-time script that reads today's *generated* output and turns it into a static starting point. Ongoing schema changes become manual Rust edits instead of a model-config regeneration.
 - Pro: least new infrastructure to build; every line is inspectable, ordinary Rust.
 - Con: loses the model-as-source-of-truth workflow this session's audit relied on (`product validate`, `generate --check`, `policy-test`) — 41 entities × CRUD × Rego wiring by hand is a lot of repetitive code to keep in sync by discipline rather than by generation.

**Option B — Small self-owned generator, same shape as today.** Keep `.appfw/model/**` as the source of truth; write a much smaller `build.rs`/CLI (product-owned, in this repo) that reads it and emits the GraphQL schema + Rego wrappers + SQL DDL, dropping the parts of the real `app_gen` this product doesn't use (MSSQL/Snowflake/Mongo output, the frontend-contract generator now that the frontend owns its own UI — `src/generated/appfw-ui-contract.ts` would need a decision too, see Open questions).
 - Pro: keeps the workflow (`validate`/`generate --check`/`policy-test`) and the model-driven discipline this session depended on to fix findings A–Q safely.
 - Con: real engineering — a code generator is qualitatively harder to get right than the entities it generates; the deny-by-default Rego semantics (finding Q) is exactly the kind of subtle behavior a hand-rolled reimplementation could silently drop.

**Recommendation: Option B, scoped down hard.** Single provider (Postgres), single schema namespace (governance), no MSSQL/Snowflake/Mongo output, no `appfw_saas_core`/`appfw_mssql_auth` equivalent (fold their handful of functions directly into `backend/src/services/graph` and drop MSSQL auth entirely — it's unused). That cuts real scope, not just crate count.

## Proposed phases (in dependency order — each phase removes one path dependency)

1. **`appfw_mssql_auth` — delete, don't replace.** Unused in this product. Drop the dependency and the `mcp`/`kafka`/`sync` cargo features that pull in framework surface we don't use either, if audit confirms they're dead. Near-zero effort, do this first as a quick win.
2. **`appfw_saas_core` — inline.** Three small, generic, already-understood functions (`redact_json_value`, `parse_retry_after_seconds`, an OAuth M2M token cache + request-plan struct). Port them into `backend/src/services/graph/` directly as product code. Low effort, low risk — these are utility functions, not framework machinery.
3. **`appfw_provider_postgres` — reimplement directly on `tokio-postgres`.** We already depend on the underlying driver; this phase writes the `RuntimeDataType → SqlParam` mapping and insert/update/select statement builders as product code. This is also where finding N (the null-jsonb binding bug) lives — reimplementing it is a chance to fix it for real instead of carrying a session-local patch note. Medium effort — bounded (one file's worth of logic, `param.rs`/`mutation.rs` equivalents), well-understood after this session's audit.
4. **`appfw_runtime`'s non-generator parts — reimplement directly on `axum`/`async-graphql`/`jsonwebtoken`/`opentelemetry`.** JWT extraction + the local-dev bypass, the request pipeline, tracing setup, config loading. All standard patterns on top of libraries already in `backend/Cargo.toml`. Medium effort.
5. **`appfw_runtime`'s `DataAccess`/policy-check plumbing.** The piece that makes every `create_item`/`update_item` call run through Rego regardless of caller (the architectural fact behind finding Q) needs to be preserved exactly, not just approximately — get this reviewed against the current behavior (`policy-test` suite) before considering it done. Medium-high effort, high care.
6. **`app_gen` itself — the actual code generator.** Highest effort by far: parsing `.appfw/model/**`, rendering GraphQL schema + Rego wrappers + SQL DDL from it, reproducing today's `product validate`/`generate --check`/`boundary-check`/`feature-check`/`policy-test` CLI surface (`scripts/appfw`). This is the phase that turns "a product that happens to use a framework" back into "a product with its own model-driven backend" rather than one frozen at today's generated output. Do this last, once phases 1–5 have already proven the underlying pieces work without the framework.

## Effort shape (rough, not a commitment)

Phases 1–3: small, days each. Phase 4: a couple of weeks. Phase 5: a couple of weeks, most of it verification rather than writing code. Phase 6: the generator — realistically the largest single piece of this whole plan, likely comparable in size to everything else combined. Worth treating as its own project once we get there, not a line item.

## Open questions to resolve before phase 6 starts

- **`src/generated/appfw-ui-contract.ts`** (frontend): currently `app_gen`-produced, describes the entity/relationship contract the frontend reads. If we own the generator, this is one more thing it emits — no new problem. If we ever stop generating entirely (Option A), the frontend needs a different source for this contract.
- **How much of the 41-entity, 38-relationship model is actually load-bearing** vs. legacy from the product-intake scaffold — worth an inventory pass before phase 6, since every entity the generator has to support is scope.
- **Where the private registry fits in going forward.** Even after every phase above, `.cargo/config.toml`'s `pds-app-framework-crates` registry becomes moot for this product specifically — but if other teams/products still depend on it, that's a separate, client-side conversation, not something this plan needs to resolve.

## What this plan does *not* cover

It does not touch the frontend (already done) or propose changing product behavior — the goal throughout is to reproduce current behavior on self-owned code, verified against the same gates this session already used (`product validate`, `generate --check`, `policy-test`, live GraphQL testing), not to redesign the product while also swapping its foundation.
