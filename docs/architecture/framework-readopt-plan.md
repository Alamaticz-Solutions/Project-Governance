# Re-adopting the PDS App Framework: execution plan

**Status:** PLAN — not started. Supersedes the "what path" discussion in
`framework-readoption-analysis.md`; that doc holds the decision rationale, this
one holds the how.

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
- **Framework repo: case 2** — `Alamaticz-Solutions/app-framework`, an org-hosted
  pinned mirror of a PDS release. Not the ProGet registry (Mode A), not a
  submodule.
- Still open: which specific PDS tag/SHA the mirror is seeded from (§8 ask 2).

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
| `frontend/src/ui/kit.tsx` | **Decide separately** (§6) | Self-owned replacement for vendored `@appfw/pds-health-components`. Independent of the backend swap. |
| `backend/src/platform/{errors,security_config,model_metadata,provider_registry,graphiql,provider_*,query_*,record_locator,...}.rs` | **Delete** | Self-owned reimplementations of `appfw_runtime` internals. Consume from the framework instead. |
| `backend/src/platform/runtime.rs` | **Rewrite** | Flip from re-exporting `crate::platform::*` back to `pub use appfw_runtime::*` (+ the submodule-path shadows phase 7 documented). Keep the module — it stays the seam. |
| `backend/src/data/clients/postgres/**` | **Delete** | Self-owned SQL layer (param mapping, statement builders, TLS connector). `appfw-provider-postgres` owns this. |
| `backend/src/data/keyset_cursor.rs` | **Delete** | Framework owns keyset pagination. |
| `backend/src/data/clients/database_client.rs` | **Rework** | Re-introduce `DatabaseClientRuntimeAdapter` + the bidirectional `From` bridges phase 7 slice 8 removed. |
| `product_gen/`, `product_gen/product_cli/` | **Delete** | `app_gen` is the generator. |
| `backend/src/{routes,schemas}/`, `backend/src/handlers/<schema>/generated.rs`, `backend/src/handlers/<schema>/mod.rs`, `entity_types.yaml` | **Regenerate** | `app_gen` output, typed against `appfw_runtime`. Large diff — reviewed, not authored. |
| `frontend/src/generated/appfw-ui-contract.ts` | **Regenerate** | `app_gen` emits it. |
| `scripts/appfw` | **Restore** | Removed at commit `9d54215`. The framework ships this wrapper; take it from the framework checkout. |
| `.cargo/config.toml` | **Restore** | Registry stanza (Mode A) or nothing (Mode B path deps). |
| `podman-compose.yml` | **Regenerate** | Generated from `.appfw/manifest.yaml` + data-source config. |
| `Cargo.toml` (workspace) | **Rework** | Re-add framework deps; possibly restore `rego_test`/`api_tests` to `members` per how they consume `appfw-test`. |

Cargo features: `default-features = false` + `features = ["http"]` only. **Do
not** re-enable `mcp` / `kafka` / `sync` — none were ever in `default`, none run
in this product, and leaving them off keeps `feature-check` at 4 combinations
instead of 32.

---

## 4. Slice plan

Each slice ends with a green `cargo check -p backend --all-targets` against the
restored framework checkout, committed independently. Mirrors phase 7's slice
discipline, in reverse.

### Slice 0 — framework acquisition (blocked on PDS, start now)

- Settle the framework repo URL / registry question (§2, §8).
- Clone framework as `../app-framework`, checked out to a **specific tag or
  SHA** — request a `v0.2.0` tag from PDS rather than pinning a bare `main`
  commit.
- Confirm `cargo check` works inside the framework checkout on our machines
  (the private-registry dep `appfw-saas-core` must resolve — via ProGet or a
  sibling path in the same checkout).

### Slice 1 — restore wiring, facade still self-owned underneath

- Re-add framework deps to `backend/Cargo.toml`, restore `.cargo/config.toml`,
  restore `scripts/appfw`.
- Do **not** flip the facade yet. Goal: workspace resolves and `scripts/appfw
  context --json` runs. `product_gen` still the generator at this point.

### Slice 2 — flip the facade

- `platform/runtime.rs`: `pub use appfw_runtime::*` + submodule-path shadows
  (`runtime::security::SecurityConfig`, etc. — a crate-root override alone is
  silently inert, per phase 7's recurring lesson).
- Delete the self-owned `platform/*` reimplementations listed in §3.
- Compiler drives the rest — ~45 files, mostly a single `use` line each.
- Re-introduce `DatabaseClientRuntimeAdapter` + `From` bridges in
  `data/clients/database_client.rs`.

### Slice 3 — swap the generator

- Delete `product_gen/` and `product_cli/`.
- `scripts/appfw product validate --json` → `scripts/appfw product generate` →
  `git diff` (large, generated) → `scripts/appfw product generate --check
  --json`.
- Regenerates `routes/`, `schemas/`, `handlers/*/generated.rs`,
  `entity_types.yaml`, `appfw-ui-contract.ts`, `podman-compose.yml`.

### Slice 4 — reconcile `.appfw/` to the framework contract

- `.appfw/manifest.yaml`: `version`, `topology.data_sources[].role`,
  `topology.schemas[].role` — match the adopted framework's expected shape.
- Schema `_res.yaml`: storage postures (`app_owned` etc.).
- `scripts/appfw product validate --json` until clean.

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

**Effort:** slices 2–5 are the bulk, ~2–4 weeks. Slice 0 lead time is on PDS —
run it in parallel from day one.

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

- **`scripts/appfw` on native Windows** (found during slice 1): `appfw-cli`
  fails with `os error 193` invoking its bash compatibility wrapper. The
  self-owned `product_cli` was a pure Rust binary with no such issue. Options
  for slice 3: run the framework CLI only under WSL/CI (Linux), invoke
  `appfw-cli` directly without the wrapper, or ask PDS whether a
  wrapper-free entrypoint exists. Does not block slices 1–2.
- **Frontend kit (slice 6):** revert to vendored PDS components, or keep the
  self-owned `kit.tsx`? Decouple from the backend decision.
- **`rego_test` / `api_tests` workspace membership:** they were restructured
  around `product_gen::policy` / a self-owned harness in phase 7 slice 7 —
  re-adoption may move them back onto `appfw-test`.
- **Delete vs. keep dormant** the self-owned modules — recommend delete (they
  cannot be maintained against a moving framework and would rot), but the git
  history preserves them if ever needed.

---

## 10. Fallback

If Slice 0 cannot be completed — no framework source access, no reachable
registry, no tag to pin — re-adoption is not viable. Fall back to
`framework-readoption-analysis.md` Path A: keep the working self-owned code,
withdraw the multi-client note from `README.md` and `self-owned-backend-plan.md`,
and revisit if PDS's packaging situation changes.
