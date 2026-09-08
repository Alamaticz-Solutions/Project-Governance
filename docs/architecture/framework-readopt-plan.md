# Re-adopting the PDS App Framework: execution plan

**Status:** IN PROGRESS — slices 0, 1, and 2 done (`origin/framework-readopt`).
Slice 3 (swap generator) is next. Supersedes the "what path"
discussion in `framework-readoption-analysis.md`; that doc holds the decision
rationale, this one holds the how.

**Decision recorded:** consume the PDS App Framework as a **pinned upstream
dependency**, per the model its own docs mandate
(`docs/reference/product-workspace-contract.md`,
`docs/lifecycle/application-lifecycle.md`,
`docs/architecture/framework-packaging.md` in the framework repo). Not
copy-and-own, and not the current copy-and-rewrite state.

**Driver:** only PDS will run this product; PDS's platform team maintains the
framework and develops it actively. That removes the reason the framework was
replaced (`self-owned-backend-plan.md`) and makes the framework's upgrade path
(shared bug-fixes, `appfw product upgrade`) a net benefit.

**Decisions confirmed (2026-09-08):**

- PDS has approved re-adoption and approved hosting the framework source in our
  GitHub org.
- **Consumption mode: B** — framework as a pinned sibling git checkout (§2).
- **Framework repo:** `Alamaticz-Solutions/app-framework` (private), an org-hosted
  pinned mirror. Not the ProGet registry (Mode A), not a submodule.
- Still open: swapping the interim archive seed for a proper PDS tag (§8 ask 2) —
  **not blocking**; the interim seed builds.

---

## 0. Current state — read this first if you are picking this up

**Branch:** `framework-readopt` off `governance-restructure` (`44caa6c`), pushed
to `origin`. Commits so far:

| Commit | What |
|---|---|
| `ba14bff` | this doc + `framework-readoption-analysis.md` |
| `4c88c55` | **slice 1** — wiring restored, `cargo check -p backend` green |
| `8efc7c1` | this doc §6a (teammate setup) + §9 (Windows caveat) |
| `9e90b94` | **slice 2** — facade flipped, 19 platform + 12 sql files deleted, `appfw-provider-postgres` adopted |
| `87bec07` | **slice 2b** — dead code cleanup (183→0 warnings), live GraphQL audit-hash-chain smoke passed against Postgres |
| `b6ef392` | **slice 3** — swap generator (product_gen deleted, app_gen adopted, workspace 0 warnings/0 errors) |
| `25a8999` | slice 3 followup — repoint rego_test to appfw-test, restore to workspace members |
| `c702fc8` | slice 3 review — live smoke test rerun, non_camel_case_types comment, docker runner recipe in §9 |

**Framework checkout:** `Alamaticz-Solutions/app-framework` @ tag
`pinned/archive-893829ad0e30` must be cloned as a sibling of this repo (see §6a
for exact steps). It builds offline — `cargo check -p appfw-runtime
-p appfw-provider-postgres` in that checkout is green; the ProGet private
registry is never contacted (every `pds-app-framework-crates` dep resolves by
sibling path).

**Verify your setup before doing anything:**

```bash
# from governance-appfw/ on branch framework-readopt, with ../../app-framework present
cargo check -p backend --all-targets      # must be 0 errors
```

**Next action:** Slice 5 (§4). Product-surface fallout & boundary-check cleanup.

**The detailed reverse-map lives in `self-owned-backend-plan.md` §"Phase 7"** —
that section documents, slice by slice, exactly how each `appfw_runtime` symbol
was ported *out*. Slice 2 here is that work run backwards, so read Phase 7's
progress notes before starting: the file/reference counts, the top-8 heaviest
files, the symbol-surface grep, and the "alias + bidirectional bridge" pattern
are all there.

---

## 1. Starting point: current `HEAD`, on a new branch

Branch from `governance-restructure` HEAD (`44caa6c` at time of writing). **Do
not** start from the pre-divergence commit or from `origin/Dev`.

| Option | Keeps for free | Must rebuild | Verdict |
|---|---|---|---|
| Pre-divergence commit (`cafe585`, M12) | Framework pristine, `app_gen` wired | ~100 commits: findings bug-fixes (N/K/L/M/P/Q), M10 governed-write stack, Meeting Center rewrite, AI document extraction, 5 gate review forms, live Graph search — all written against `platform::*`, so each is a **re-port** | Slowest. Backwards. |
| From scratch off `origin/Dev` | Nothing — `Dev` is a different, non-framework backend (the product we ported features *from*) | Everything | Reject. |
| **Current `HEAD`** | **Everything** — full `.appfw/model` (30 entities / 39 relationships), every bug-fix, every feature; product-owned surfaces (`handlers/<entity>.rs`, `services/`, `frontend/`) untouched; the `platform::runtime` facade already exists as the single seam | Reverse the plumbing only: `platform::*` → `appfw_runtime` (~45 files, mostly one import line each, compiler-driven), `product_gen` → `app_gen` (regenerate, not hand-written) | **Fastest + safest.** Green build at every slice. |

The valuable, hard-to-reproduce work is all in `.appfw/model` (already
framework-format) or in product-owned surfaces the framework contract preserves
across regeneration. Only the plumbing beneath it changes — and phase 7
deliberately left `backend/src/platform/runtime.rs` as a re-export chokepoint at
exactly that boundary.

```bash
cd governance-appfw
git checkout -b framework-readopt
git push -u origin framework-readopt
```

---

## 2. Where the framework lives, and how teammates consume it

**Do not commit framework source into this repo.** It is ~52k lines of PDS IP,
it would bloat every diff, and the framework's own docs call the copied-source
layout a transitional anti-pattern
(`framework-packaging.md` extraction order, step 6:
*"Convert downstream apps from copied framework source to dependency-based
consumption"*). The product repo carries only `appfw.lock` (the framework SHA/
version pointer) — never the framework tree.

**Chosen: Mode B** (§"Decisions confirmed" above). Mode A is retained here as the
target to migrate to once PDS's registry lane is real.

### Mode A — ProGet Cargo registry (target, not yet available)

PDS publishes `appfw-runtime`, `appfw-codegen`, `appfw-provider-postgres`,
`appfw-test` to an approved Cargo registry. Then:

```toml
# backend/Cargo.toml
[dependencies]
appfw-runtime = "0.2"
appfw-provider-postgres = "0.2"
[build-dependencies]
appfw-codegen = "0.2"
[dev-dependencies]
appfw-test = "0.2"
```

```toml
# .cargo/config.toml (committed)
[registries.pds-app-framework-crates]
index = "<proget cargo index url>"
```

Teammates need registry credentials in `~/.cargo/credentials.toml` (documented
in the product README, never committed). Nothing else — no framework checkout.
**Confirm with PDS whether this feed exists and is reachable from our CI/deploy
runners before planning around it.** As of the framework snapshot reviewed
(2026-08-30) this lane is marked "pending W3-E" — not yet real.

### Mode B — framework as a sibling git checkout (works today)

The framework repo lives beside the product repo:

```text
Governance-Restructure/
|-- governance-appfw/       <- this repo (origin: Alamaticz-Solutions/Project-Governance)
`-- app-framework/          <- PDS framework repo, pinned to a tag/SHA
```

```toml
# backend/Cargo.toml
appfw-runtime = { package = "appfw-runtime", path = "../../app-framework/appfw_runtime", default-features = false, features = ["http"] }
appfw-provider-postgres = { package = "appfw-provider-postgres", path = "../../app-framework/appfw_provider_postgres" }
```

`scripts/appfw` resolves the framework via `APPFW_FRAMEWORK_ROOT`, an adjacent
`../app-framework`, or the in-repo example layout (framework docs,
`application-lifecycle.md` §"Recommended Repo Topology").

**Teammate onboarding** (put this in the product README):

```bash
# one directory up from where you cloned governance-appfw
git clone <framework repo url> app-framework
cd app-framework && git checkout <sha-or-tag from ../governance-appfw/appfw.lock>
cd ../governance-appfw
git remote add framework <framework repo url>   # optional, for upgrades
cargo check -p backend
```

The framework SHA teammates check out is dictated by `appfw.lock` in this repo —
that is the single source of truth for "which framework version builds this
product." CI does the same: clone framework at the locked SHA, then build.

### Framework repo: `Alamaticz-Solutions/app-framework` (org mirror)

Confirmed 2026-09-08. We host `Alamaticz-Solutions/app-framework` as a
read-only, pinned mirror of a specific PDS framework release. PDS updates are
pulled into it deliberately, on an explicit upgrade branch — never auto-synced.
Teammates and CI clone this mirror as the `../app-framework` sibling.

Mirror setup (one-time):

```bash
# with PDS-provided source for the agreed tag/SHA
gh repo create Alamaticz-Solutions/app-framework --private
cd app-framework
git remote add pds <pds framework repo url>     # PDS upstream, fetch-only
git fetch pds --tags
git checkout <agreed PDS tag/SHA>               # see §8 ask 2
git push origin HEAD:main
git tag pinned/v0.2.0 && git push origin pinned/v0.2.0
```

`appfw.lock` in *this* repo records the mirror SHA that builds the product.
Upgrades: fetch new PDS state into the mirror, tag it, bump `appfw.lock` on a
`framework-upgrade/*` branch (§6).

### Do NOT use a git submodule for the framework

A submodule would force the framework tree (or a gitlink to it) into this repo's
worktree and tie framework upgrades to product commits in a way the
`appfw.lock` + `appfw product upgrade` workflow already handles better. Keep
them as independent sibling clones.

---

## 3. What we keep, what we delete

| Surface | Action | Notes |
|---|---|---|
| `.appfw/model/**` | **Keep**, reconcile to framework contract | Already in framework YAML format. Check `manifest.yaml` topology fields and schema `_res.yaml` storage postures against the adopted framework's `CONFIG_CONTRACT.md`. |
| `backend/src/handlers/<schema>/<entity>.rs` | **Keep** | Product-owned extension points. Survive regeneration by contract. |
| `backend/src/services/**` | **Keep** | Product-owned. May need import repointing where they reached into `platform::`. |
| `backend/src/services/graph/**` (Microsoft Graph provider, M9/M10) | **Keep** | Product code, sits on top of the framework — not affected by the swap except imports. |
| `frontend/src/features/**`, product screens | **Keep** | Product-owned. |
| `frontend/src/ui/kit.tsx` | **Decide separately** (slice 6) | Self-owned replacement for vendored `@appfw/pds-health-components`. Independent of the backend swap. |
| `backend/src/platform/runtime.rs` | **Rewrite** (slice 2) | Flip from re-exporting `crate::platform::*` back to `pub use appfw_runtime::*` + the submodule-path shadows (§4 slice 2). Keep the module — it stays the seam. Its own doc comment lists every self-owned override slice-by-slice; that list is the delete inventory. |
| self-owned `backend/src/platform/*.rs` reimplementations | **Delete** (slice 2) | Candidates, confirm each against `platform/runtime.rs`'s override list and a `grep`: `errors.rs`, `security_config.rs`, `model_metadata.rs`, `provider_registry.rs`, `graphiql.rs`, `provider_error.rs`, `provider_keys.rs`, `provider_operation.rs`, `provider_pool_stats.rs`, `provider_request.rs`, `provider_result.rs`, `provider_time_period.rs`, `query_cost.rs`, `query_filter.rs`, `query_pagination.rs`, `record_locator.rs`, `security.rs`, `user_auth.rs`, `policy.rs`. **Do not blind-delete** — several (`identifier.rs`, `secrets.rs`, `cors.rs`, `host.rs`, `observability.rs`, `connection_security.rs`, `tenant_isolation.rs`, `request_context.rs`, `readiness.rs`, `routing.rs`, `metrics.rs`, `json_utils.rs`, `product_ui.rs`, `admin_runtime/`) were self-owned well before phase 7 and may be genuine product code or thin shells — check whether the framework still exposes an equivalent first. |
| `backend/src/data/clients/postgres/**` (17 files) | **Delete** (slice 2, with `appfw-provider-postgres` added) | Self-owned SQL layer: `param.rs`, `mutation.rs`, `aggregate.rs`, `filter.rs`/`filter_sql.rs`, `sort.rs`, `cte.rs`/`cte_sql.rs`, `audit_sql.rs`, `routine_sql.rs`, `connection.rs` (TLS connector), `execution.rs`, `pg_error.rs`, `postgres_client.rs`, `many_to_many_config.rs`. `appfw-provider-postgres` owns all of this. |
| `backend/src/data/keyset_cursor.rs` | **Delete** (slice 2) | Framework owns keyset pagination. |
| `backend/src/data/clients/database_client.rs` | **Rework** (slice 2) | Re-introduce `DatabaseClientRuntimeAdapter` + the 8 bidirectional `From` bridges removed at `c9e971e` (that commit message enumerates them: `errors.rs`, `policy.rs`, `provider_keys.rs`, `provider_pool_stats.rs`, `provider_result.rs`, `query_cost.rs`, `query_pagination.rs`, `user_auth.rs`). |
| `product_gen/` (23 `.rs` files) + `product_gen/product_cli` bin | **Delete** (slice 3) | `app_gen` is the generator. Note `rego_test/` path-depends on `product_gen::policy` — slice 3 must repoint or drop that too (§9). |
| `backend/src/routes/**`, `backend/src/schemas/**`, `backend/src/handlers/<schema>/generated.rs`, `backend/src/handlers/<schema>/mod.rs`, `backend/src/handlers/mod.rs`, `backend/src/schemas/mod.rs`, `.appfw/model/schemas/*/entity_types.yaml` (if generated) | **Regenerate** (slice 3) | Currently `product_gen` output typed against `crate::platform::*`. After `app_gen` runs, typed against `appfw_runtime`. Large diff — reviewed, not authored. `schemas/system.rs` already carries pre-existing accepted drift — expect it to change. |
| `frontend/src/generated/appfw-ui-contract.ts` | **Regenerate** (slice 3) | `app_gen` emits it. |
| `scripts/appfw` | ✅ **Restored** (slice 1, `4c88c55`) | From `9d54215^`. Resolves `../app-framework` and runs `appfw-cli --locked`. Note the Windows `os error 193` issue (§9). |
| `.cargo/config.toml` | ✅ **Restored** (slice 1, `4c88c55`) | `pds-app-framework-crates` registry stanza. Only publish metadata — never fetched (path deps win). |
| `podman-compose.yml` | **Regenerate** (slice 3) | Generated from `.appfw/manifest.yaml` + data-source config. |
| `Cargo.toml` (workspace) | **Rework** (slices 2–3) | `appfw_runtime` re-added in slice 1. Slice 2 adds `appfw-provider-postgres`. Slice 3 removes `product_gen` refs; may restore `rego_test`/`api_tests` `members` per how they consume `appfw-test`. Current `members = ["api_tests", "backend"]`. |

Cargo features: `default-features = false` + `features = ["http"]` only. **Do
not** re-enable `mcp` / `kafka` / `sync` — none were ever in `default`, none run
in this product, and leaving them off keeps `feature-check` at 4 combinations
instead of 32.

---

## 4. Slice plan

Each slice ends with a green `cargo check -p backend --all-targets` against the
restored framework checkout, committed independently. Mirrors phase 7's slice
discipline, in reverse.

### Slice 0 — framework acquisition ✅ DONE

- `Alamaticz-Solutions/app-framework` created (private), seeded from the source
  archive `pacificdental-app-framework-893829ad0e30` (no upstream git history
  was available). Tag `pinned/archive-893829ad0e30`. Provenance recorded in the
  seed commit: `framework_git_sha 1d97819b1d400951178ed9d327c5b199496ccee1`,
  version 0.1.0 per the archive's `appfw.lock` (source tree is ahead — Cargo.toml
  says 0.2.0, unreleased).
- Cloned as `../app-framework` (sibling of this repo).
- **Acceptance met:** `cargo check -p appfw-runtime -p appfw-provider-postgres`
  in the checkout = 0 errors, ~1m42s. `appfw-saas-core` and all other
  `pds-app-framework-crates` deps resolve by sibling path; ProGet never
  contacted.
- Deferred (not blocking): swap the archive seed for a proper PDS tag (§8 ask 2).
- Known issue: the mirror includes the CRM sample's ~70MB of seed SQL
  (`database/_pkg/schemas/crm/seed.*`, `app_gen/_config/schemas/crm/seeds/*`) —
  harmless (we never build the framework's own sample), trim later if desired.

### Slice 1 — restore wiring, facade unchanged ✅ DONE (`4c88c55`)

- `scripts/appfw` restored from `9d54215^`.
- `.cargo/config.toml` restored (registry stanza).
- `backend/Cargo.toml`: `appfw_runtime = { package = "appfw-runtime", path =
  "../../app-framework/appfw_runtime", default-features = false }` re-added, plus
  `appfw_runtime/http` in the `http` feature.
- **Deviations from the original plan text, intentional:**
  - `appfw-provider-postgres` was **not** added — it comes in slice 2 alongside
    deleting `data/clients/postgres/**`, so the workspace never has both the
    self-owned SQL layer and the framework provider fighting over the same role.
  - `scripts/appfw context --json` was **not** verified to run — `appfw-cli`
    hits `os error 193` on native Windows (§9). The slice-1 gate is
    `cargo check -p backend --all-targets` = 0 errors, which passed (2m28s).
- Facade untouched: `platform/runtime.rs` still `pub use crate::platform::*`;
  `appfw_runtime` compiles into the workspace but nothing consumes it.

### Slice 2 — flip the facade ✅ DONE (`9e90b94`)

- **Facade flipped:** `backend/src/platform/runtime.rs` repointed to `pub use appfw_runtime::*;`.
- **19 self-owned platform files deleted:** `errors.rs`, `graphiql.rs`, `graphql_context.rs`,
  `model_metadata.rs`, `policy.rs`, `provider_error.rs`, `provider_keys.rs`, `provider_operation.rs`,
  `provider_pool_stats.rs`, `provider_registry.rs`, `provider_request.rs`, `provider_result.rs`,
  `provider_time_period.rs`, `query_cost.rs`, `query_filter.rs`, `query_pagination.rs`,
  `record_locator.rs`, `security_config.rs`, `user_auth.rs`.
- **Provider adoption:** `appfw-provider-postgres` added to `backend/Cargo.toml`.
  `DatabaseClientRuntimeAdapter` restored in `backend/src/data/clients/database_client.rs`
  implementing `RuntimeProviderIdentity` and `RuntimeProviderDataClient`.
- **AuditEvent bridges:** Bidirectional `From` implementations for `AuditEvent` <-> `RuntimeAuditEvent`
  and `AuditQuery` <-> `RuntimeAuditQuery` added in `backend/src/data/audit_event.rs`.
- **SQL layer streamlined:** Deleted 12 redundant SQL generation and execution files from
  `backend/src/data/clients/postgres/**` (`param.rs`, `pg_error.rs`, `mutation.rs`, `aggregate.rs`,
  `sort.rs`, `cte_sql.rs`, `many_to_many_config.rs`, `filter_sql.rs`, `routine_sql.rs`,
  `audit_sql.rs`, `execution.rs`, `connection.rs`). Kept `postgres_client.rs`, `cte.rs`, `filter.rs`,
  and `mod.rs` integrated with `appfw_provider_postgres`.
- **Keyset cursor & Query IR:** Deleted `backend/src/data/keyset_cursor.rs`, repointed keyset
  logic in `query_ir.rs` and `read_orchestration.rs` to `appfw_runtime::query_ir`. Added `From`
  bridges for `SortDirection` and `AggregateFunction` in `query_ir_validation.rs`.
- **Diagnostics:** Bridges for `QueryPlanDiagnostic` and `PaginationDiagnostic` in
  `read_orchestration.rs` repointed to `appfw_runtime::data_access`.
- **Admin UI:** Repointed `backend/src/admin_ui.rs` to `appfw_runtime::admin` and
  `appfw_runtime::observability::RequestContext`.
- **Acceptance gate met:** `cargo check -p backend --all-targets` = 0 errors (clean build).

### Slice 2b — warning elimination & live smoke test ✅ DONE

- **Dead platform cleanup:** Removed dead Phase 7 duplicate files: `request_context.rs`,
  `product_ui.rs`, `admin_runtime/` (mod + provider_capabilities), `connection_security.rs`,
  `json_utils.rs`, `metrics.rs`, `readiness.rs`. Replaced `identifier.rs` with a direct shim
  `pub use appfw_runtime::identifier::*;`.
- **Zero compiler warnings:** `cargo check -p backend --all-targets` and
  `cargo check --workspace --all-targets` both pass with **0 warnings, 0 errors** (down from 183).
- **Unit test suite verified:** `cargo test -p backend --bin backend` passes (162 passed, 0 failed, 1 ignored).
  Confirmed the 311→162 delta is 100% deleted framework-reimplementation tests, with zero product tests lost.
- **Live GraphQL smoke test verified:** Server booted against live PostgreSQL container `governance-postgres`.
  Executed `createComment` mutation → verified `governance.comments_audit` row created with initial `prev_hash`
  and computed `event_hash`. Executed subsequent `updateComment` mutation → verified second audit row whose
  `prev_hash` exactly matches the first row's `event_hash`. Live audit hash chain contract verified end-to-end.
- **Accepted framework behavior:** The framework now directly owns Prometheus metric emission, the `/info`,
  `/readyz`, and `/livez` probe response shaping, and TLS connection security enforcement. Any behavioral differences
  from the retired self-owned shims are accepted as the standard framework contract.

### Slice 3 — swap the generator ✅ DONE

- **Generator swapped:** Deleted `product_gen/` (23 files + `product_cli` binary). Repointed `rego_test` to `appfw-test` and restored `rego_test` as an active member in root `Cargo.toml`.
- **Clean framework validation:** Executed `scripts/appfw product validate --json` under Linux container (`rust-appfw`) → 0 errors, 0 warnings.
- **Code regenerated via `app_gen`:** Executed `scripts/appfw product generate` → regenerated `routes/`, `schemas/`, `handlers/*/mod.rs`, `database/_pkg/**`, `entity_types.yaml`, `appfw-ui-contract.ts`, and `podman-compose.yml`.
- **Deterministic verification:** Executed `scripts/appfw product generate --check --json` → `{"command":"generate-check","ok":true}`.
- **Dead platform cleanup:** Removed dead Phase 7 duplicate files now owned by framework runtime: `auth.rs`, `cors.rs`, `graphql_gateway.rs`, `host.rs`, `observability.rs`, `routing.rs`, and `security.rs`.
- **Zero compiler warnings:** `cargo check -p backend --all-targets` and `cargo check --workspace --all-targets` both pass with **0 warnings, 0 errors**.
- **Test suites pass:** `backend` (122 passed, 0 failed, 1 ignored, including `audit_event::golden_test`), `rego_test` (4 passed), and `api_tests` (7 passed) all pass cleanly.

### Slice 4 — reconcile `.appfw/` to the framework contract ✅ DONE

Verified against the adopted framework contract (`app_gen/_config/_specs/CONFIG_CONTRACT.md` and CRM sample):
- `.appfw/manifest.yaml` field names, versions, topology blocks (`pg_primary` transactional, `system` framework schema, `governance` product schema, `governance-http` ingress, UI product_spa packaging) match the framework v1 contract.
- Schema `_res.yaml`: storage postures verified (`governance` defaults to `app_owned` for product tables; `system` is `role: framework`). Data sources declare `pg_primary` for `local` and `compose` environments with `is_system_schema_host: true`.
- `scripts/appfw product validate --json` (run in `rust-appfw:latest` container) passes cleanly: `valid: true`, `summary: { errors: 0, warnings: 0 }`, `ok: true`.
- `scripts/appfw product generate --check --json` (run in `rust-appfw:latest` container) passes cleanly: `ok: true` (zero generation drift).
- `cargo check --workspace --all-targets` passes with **0 warnings, 0 errors**.
- All unit tests pass (`backend`: 122 passed, `rego_test`: 4 passed, `api_tests`: 7 passed).

### Slice 5 — product-surface fallout

- Handlers/services that imported `platform::` symbols which moved or changed
  signature under the framework. Mechanical; compiler-driven.
- `scripts/appfw product boundary-check --json` green.

### Slice 6 — frontend UI kit (optional, independent)

- Decide: revert `kit.tsx` → vendored `@appfw/pds-health-components`, or keep
  the self-owned kit. Weaker case to revert if PDS isn't actively developing the
  component library. Can be deferred past first green build.

### Slice 7 — reconcile the fixes made during the replacement

Confirm each is fixed in the adopted framework version, or carry as a documented
`[patch]` (never an untracked edit):

- jsonb `null` binding — commit `e58978f` / "finding N"
- cors feature-gating — commit `a338f58` / "finding K"
- deny-by-default Rego semantics — "finding Q"

### Slice 8 — lock, verify, done

- `scripts/appfw product lock --write` → commit `appfw.lock`.
- Full 311-test backend suite (`cargo test -p backend`).
- Live GraphQL smoke against real Postgres: a `createComment` → `comments_audit`
  row with computed `event_hash`, then `updateComment` → second row whose
  `prev_hash` matches (the method that verified phase 5).
- `scripts/appfw product handoff --json`.

**Effort:** slices 0–1 done. Slices 2–5 are the bulk, ~2–4 weeks; slice 2 is the
largest single piece.

### Related docs (read before slice 2)

- `self-owned-backend-plan.md` — the authoritative reverse-map. §Phase 7 is
  slice 2's mirror; §Phase 6 is slice 3's. Findings A–Q referenced in slice 7
  are defined there.
- `framework-readoption-analysis.md` — why this path, Path A/B/C, the fallback.
- `phase6-app-gen-scoping.md` — how `app_gen`'s output is typed against
  `appfw_runtime` (why slices 2 and 3 can't be separated across the
  runtime/generator boundary).
- `HANDOFF.md` (repo root) — prior-session handoff notes; context, not authority.
- Framework checkout: `docs/lifecycle/product-golden-path.md`,
  `docs/reference/product-workspace-contract.md`,
  `docs/architecture/framework-packaging.md`.

---

## 5. Verification gates (per slice, and final)

| Gate | Command | When |
|---|---|---|
| Type-check | `cargo check -p backend --all-targets` | every slice |
| Workspace | `cargo check --workspace --all-targets` | slices 3, 8 |
| Model valid | `scripts/appfw product validate --json` | slices 3, 4, 8 |
| Generated drift | `scripts/appfw product generate --check --json` | slices 3, 4, 8 |
| Extension boundary | `scripts/appfw product boundary-check --json` | slices 5, 8 |
| Policy | `scripts/appfw policy-test` / `rego_test` | slice 7, 8 |
| Unit tests | `cargo test -p backend` | slice 8 (and any slice where the linker has RAM — historically flaky on the low-memory dev box) |
| Live e2e | GraphQL audit-hash-chain smoke | slice 8, plus any slice touching a request path |
| Handoff | `scripts/appfw product handoff --json` | slice 8 |

---

## 6. How teammates work after re-adoption

**Daily loop** (config-first, matches the framework golden path):

```bash
scripts/appfw product validate --json
scripts/appfw product test --fast
```

**Model or topology change:**

```bash
scripts/appfw product validate --json
scripts/appfw product generate
git diff                    # review the generated cascade
scripts/appfw product generate --check --json
scripts/appfw product test
```

**What teammates edit:** `.appfw/manifest.yaml`, `.appfw/model/**`,
`backend/src/handlers/<schema>/<entity>.rs`, `backend/src/services/**`,
`frontend/**`, deployment overlays, migrations via `scripts/appfw product
migrate new`.

**What teammates do NOT hand-edit:** generated `routes`/`schemas`/
`handlers/*/generated.rs`, `entity_types.yaml`, `podman-compose.yml`, anything
under the framework checkout. Change the model/config/topology and regenerate.
`scripts/appfw product explain ownership <path>` when unsure.

**Framework upgrades** (never on a feature branch):

```bash
git checkout -b framework-upgrade/v0.2.1
git -C ../app-framework fetch && git -C ../app-framework checkout v0.2.1
scripts/appfw product upgrade --json
scripts/appfw product validate --json
scripts/appfw product generate && scripts/appfw product generate --check --json
scripts/appfw product test
scripts/appfw product lock --write
scripts/appfw product upgrade --json      # must pass before review
```

**Bug found in framework-owned code:** file it upstream to PDS, contribute the
fix to the framework repo. If the product must ship ahead of upstream, add a
`[patch]` pointing at a tracked fork branch, documented in `appfw.lock` notes,
with a commitment to upstream it. Never patch framework source in-place.

---

## 6a. Teammate setup — testing slices 0–1 (or any `framework-readopt` state)

Mode B means **two repos, cloned as siblings under one parent directory**. The
framework is not in this repo.

```bash
# pick any parent dir; both repos must sit side by side in it
mkdir -p ~/work/governance && cd ~/work/governance

# 1. the framework mirror, pinned
git clone git@github.com:Alamaticz-Solutions/app-framework.git
cd app-framework
git checkout pinned/archive-893829ad0e30      # the tag in appfw.lock provenance
cd ..

# 2. the product, on the re-adoption branch
git clone git@github.com:Alamaticz-Solutions/Project-Governance.git governance-appfw
cd governance-appfw
git checkout framework-readopt

# 3. verify — this is the slice-1 acceptance gate
cargo check -p backend --all-targets           # expect: 0 errors (~2-3 min first run)
```

Resulting layout (the `../../app-framework` path in `backend/Cargo.toml` and the
`../app-framework` fallback in `scripts/appfw` both depend on it):

```text
~/work/governance/
|-- app-framework/        <- Alamaticz-Solutions/app-framework @ pinned/archive-893829ad0e30
`-- governance-appfw/     <- Project-Governance @ framework-readopt
```

Notes:
- **Access:** the mirror is a private repo in the `Alamaticz-Solutions` org. A
  teammate needs org membership + read access before the clone works — an
  org-admin grant, done once.
- **Slice 0–1 is a wiring checkpoint, not a behavior change.** `appfw_runtime`
  is present in the build but not yet consumed (the `platform::runtime` facade
  still points at self-owned code). The product behaves exactly as it does on
  `governance-restructure`. The only observable difference is `cargo` now
  compiles `appfw-runtime` and its deps.
- **`scripts/appfw` on native Windows:** the bundled `appfw-cli` shells out to a
  bash compatibility wrapper and fails with `os error 193` on native Windows.
  Run it under WSL, macOS, or Linux — or use `cargo run --locked
  --manifest-path ../app-framework/Cargo.toml -p appfw-cli -- --app-root .
  --framework-root ../app-framework <cmd>` directly. This does **not** affect
  the `cargo check` gate above, which is the real slice-1 acceptance and works
  on every platform. Tracked as an open item for slice 3 (generator swap) — see
  §9.
- **No `APPFW_FRAMEWORK_ROOT` needed** if the sibling layout is exact. Set it in
  `governance-appfw/.appfw/local.env` (gitignored) only if the framework lives
  elsewhere.

## 7. Product README additions

Add a "Framework dependency" section:

- Which consumption mode (A registry / B sibling checkout) and the framework
  repo URL.
- The onboarding commands from §2 Mode B (or the credentials setup for Mode A).
- `appfw.lock` is the pinned framework version; CI and teammates build against
  that SHA.
- The upgrade-branch procedure from §6.
- Link to this doc and to `framework-readoption-analysis.md`.

---

## 8. PDS asks (blockers — raise on day one)

1. **Framework source access.** ✅ RESOLVED 2026-09-08 — PDS approved re-adoption
   and approved hosting the framework in `Alamaticz-Solutions/app-framework` as
   a pinned mirror.
2. **A tagged release to pin.** ⏳ OPEN — get from PDS the specific tag or SHA
   the mirror is seeded from. Prefer a real `v0.2.0` (or current RC) tag over a
   bare `main` commit, and confirm PDS will support that baseline as a pilot.
3. **ProGet registry reachability** from our CI and deploy runners — verified,
   with a named owner and date. If it can't be made reliable, we are on Mode B
   (sibling checkout) indefinitely.
4. **Bug-fix contribution path.** Can we PR into the framework repo, or only
   file tickets? Determines whether "both teams fix bugs" is workable or means
   we carry `[patch]` forks.
5. **Confirm `mcp` / `kafka` / `sync` / MSSQL-auth stay out of scope** for this
   product.

---

## 9. Open decisions

- **`scripts/appfw` on native Windows (resolved in slice 3):** `appfw-cli`
  fails with `os error 193` invoking its bash compatibility wrapper. Additionally,
  `app_gen`'s output safety checks rely on Unix inode/hard-link metadata (`st_nlink`),
  and `generate --check` invokes `check_app_gen_backend_equivalence.sh` which requires
  `rsync` and `rustfmt`. The proven, reproducible solution on Windows with Docker Desktop:
  ```bash
  # 1. One-time setup: build or tag the container (rust:1 base + rustfmt + rsync)
  docker run --name rust-setup rust:1 bash -c "rustup component add rustfmt && apt-get update && apt-get install -y rsync"
  docker commit rust-setup rust-appfw:latest
  docker rm rust-setup

  # 2. Run any scripts/appfw command (mounting the parent directory so both siblings sit side-by-side):
  docker run --rm -v C:\Users\ManojRajakumar\Governance-Restructure:/work -w /work/governance-appfw rust-appfw:latest ./scripts/appfw product validate --json
  docker run --rm -v C:\Users\ManojRajakumar\Governance-Restructure:/work -w /work/governance-appfw rust-appfw:latest ./scripts/appfw product generate
  docker run --rm -v C:\Users\ManojRajakumar\Governance-Restructure:/work -w /work/governance-appfw rust-appfw:latest ./scripts/appfw product generate --check --json
  ```
  Alternatively, use a local wrapper script `scripts/appfw-docker.bat`.
- **Frontend kit (slice 6):** revert to vendored PDS components, or keep the
  self-owned `kit.tsx`? Decouple from the backend decision.
- **`rego_test` / `api_tests` workspace membership (resolved in slice 3):**
  `rego_test` repointed to `appfw-test` path dependency (`../../app-framework/appfw_test`)
  and restored to root `Cargo.toml` `members`. All 4 policy tests pass against the adopted harness.
- **Delete vs. keep dormant:** resolved in slice 2b and slice 3 — dead platform and
  sql modules and `product_gen/` were deleted cleanly (0 dead code warnings, -10k net lines).

---

## 10. Fallback

If Slice 0 cannot be completed — no framework source access, no reachable
registry, no tag to pin — re-adoption is not viable. Fall back to
`framework-readoption-analysis.md` Path A: keep the working self-owned code,
withdraw the multi-client note from `README.md` and `self-owned-backend-plan.md`,
and revisit if PDS's packaging situation changes.
