# Re-adopting the PDS App Framework: scoping analysis

**Status:** ANALYSIS ONLY — no work started, no decision ratified.
**Date:** 2026-09-08
**Companion to:** `self-owned-backend-plan.md` (the replacement this would reverse), `phase6-app-gen-scoping.md`.

## Why this document exists

`self-owned-backend-plan.md` recorded the decision to remove the PDS App
Framework as a runtime/generator dependency, completed 2026-09-07. Its stated
driver was: *"this product may be pitched to other clients"* and so should not
carry a runtime dependency on client IP.

That premise is now in question. If **only PDS will ever run this app**, the
reason for the replacement weakens, and re-adopting the framework becomes worth
scoping. This document scopes it.

## The decision inputs (as given, 2026-09-08)

| Question | Answer given | How it actually reads |
|---|---|---|
| Will PDS's platform team maintain/support this app with their framework tooling? | Yes | Favors re-coupling. |
| Is there active upstream framework development you'd benefit from? | Yes | Favors re-coupling **but** — see "moving target" below. Cuts both ways. |
| Will the private registry (`pds-app-framework-crates`) be reachable from CI/deploy? | "It should be" | **Not yet verified. Currently confirmed *failing* locally** (`self-owned-backend-plan.md` line 75: `curl` times out). This is the gating precondition — it must be proven, not assumed. |
| Who owns backend bug-fixes going forward? | Both | The messy case, not the clean one. "Both" means the product keeps patching framework-owned code — the exact divergence the replacement removed. Forces the vendor-vs-registry decision below. |

**Net:** direction of travel is toward re-adoption (Path B), but the
recommendation is **conditional on two verifications** (registry access in CI,
and upstream API drift), and one open decision (vendor vs. registry), all
below.

## State of the ground right now

- **The local framework reference copy is gone.** `self-owned-backend-plan.md`
  line 108 said the `../app-framework` build-aid copy was "deliberately left in
  place for independent review before deletion." It has since been deleted — it
  does not exist on this machine. The **only** framework source available today
  is the Downloads copy: `pacificdental-app-framework-893829ad0e30`, a snapshot
  dated **2026-08-30**.
- **That snapshot is `appfw-runtime 0.2.0`, an unreleased candidate.** Its own
  CHANGELOG: *"No production-certified framework release has been cut yet…
  This local candidate does not claim package publication, Product acceptance,
  live-provider readiness, security approval, release, or deployment."*
- **The private registry is unreachable from this machine** (confirmed, not
  assumed). `appfw-runtime`'s manifest pulls `appfw-saas-core 0.1.1` from
  `pds-app-framework-crates`.
- **`.appfw/model/**` was kept in the framework's format** throughout the
  replacement — the model itself is still framework-compatible and does not need
  to change under any path.
- **The `platform::runtime` facade module still exists** as the single seam all
  `backend/src` code reaches framework-shaped types through. It currently
  re-exports self-owned types; re-adoption flips it back to re-exporting the
  framework's.

## Two things that constrain every path

### 1. Generator and runtime move together — no half-measure

Confirmed from `phase6-app-gen-scoping.md` (§3, lines 71 / 106–110 / 131):
`app_gen`'s Rust **output** is typed against `appfw_runtime`. The self-owned
generator (`product_gen`/`product_cli`) emits the same files typed against
`backend/src/platform/*`. Therefore:

- You cannot keep `product_gen` and take the framework runtime.
- You cannot take `app_gen` and keep the self-owned runtime.
- Re-adopting one means re-adopting both, in one coordinated change.

### 2. "Active upstream development" makes this a port, not a revert

The phase-7 ports were byte-verified against a specific framework snapshot
(now deleted). The Downloads copy is the 2026-08-30 `0.2.0` candidate. If PDS
has developed the framework since — and the answer above says they have, and
the CHANGELOG shows `0.2.0` still isn't cut — then re-adoption couples this
product to **current upstream**, whose API surface for the ~30 ported symbols
may have moved.

**Required check before any effort estimate is real:** obtain current upstream
framework source from PDS, then diff the used symbol surface:

```
grep -rhoE "appfw_runtime::[A-Za-z0-9_]+(::[A-Za-z0-9_]+)*" backend/src | sort -u
```

against current upstream. If that surface is stable → Path B step 2 is a
guided revert (~1–2 weeks). If it has drifted → step 2 is a port to a new API,
and step 3's regeneration diff grows to match.

## Path A — Withdraw the multi-client premise, keep the self-owned code

The cheapest option, and the default if the verifications below don't clear.

- The self-owned backend already works: 311 backend tests green, all gates
  (`boundary-check` / `validate` / `generate --check` / `rego_test`) green,
  framework absent from disk.
- Changes required: update `self-owned-backend-plan.md` and `README.md` to
  record that the multi-client rationale is withdrawn but the completed work
  stands on its own merits (fixed the null-jsonb bug, the cors feature-gating
  bug, made the deny-by-default Rego semantics product-owned and explicit).
- Cost: an afternoon of documentation.

**"Only PDS will use it" removes the original *reason* for the replacement. It
does not by itself create a reason to *undo* completed, tested, working code.**
Re-adopt only for a concrete forward benefit — which, per the answers above,
does plausibly exist (PDS maintenance + upstream development). Hence Path B is
live. But it is not free, and it is not a revert.

## Path B — Re-adopt the framework (runtime + generator together)

Ordered. Each step ends green against a restored framework reference.

### B0 — Preconditions (do these before touching code)

1. **Get current upstream framework source + access from PDS.** Not the
   2026-08-30 Downloads snapshot — the version CI/deploy will actually resolve.
   Establish: which `appfw-runtime` version, published to
   `pds-app-framework-crates` or consumed by git path / vendored.
2. **Prove registry reachability from a CI runner and the deploy pipeline** —
   not from a laptop. Name the owner at PDS who confirms this and the date it
   was verified. If it cannot be made reliably reachable, **stop — Path B is not
   viable as a registry dependency**; fall back to vendoring (see "Open
   decisions") or to Path A.
3. **Run the symbol-surface drift check** from §2 above. Feeds the estimate.
4. **Decide vendor vs. registry** (see "Open decisions"). This changes B1.

### B1 — Restore the framework dependency

- Re-add to `backend/Cargo.toml`: `appfw_runtime` (`appfw-runtime`),
  `appfw_provider_postgres`, `appfw_saas_core`. Re-add `appfw_mssql_auth` only
  if MSSQL auth is now actually wanted (it was dropped as unused — likely still
  is).
- Re-add the `.cargo/config.toml` `pds-app-framework-crates` registry stanza
  (registry path) **or** a vendored `vendor/app-framework/` + path deps
  (vendor path).
- Re-add the `mcp` / `kafka` / `sync` cargo features **only if** a worker-mode
  process is now in scope. It wasn't; `operations/generated.rs` (6,857 lines)
  and `mcp/mod.rs` / `kafka.rs` / `sync_workers.rs` were deleted. Leaving these
  out keeps `feature-check` at 4 combinations instead of 32.

### B2 — Repoint the backend runtime (~45 files, ~295 references)

Phase 7 in reverse, using the facade that already exists:

- Flip `backend/src/platform/runtime.rs` from re-exporting self-owned types to
  `pub use appfw_runtime::*` (plus the submodule-path shadows —
  `runtime::security::SecurityConfig` etc. — that phase 7 learned are the ones
  real call sites use; a crate-root override alone is silently inert).
- Re-introduce `DatabaseClientRuntimeAdapter` and the bidirectional `From`
  bridges deleted in phase 7 slice 8
  (`platform/{errors,policy,provider_keys,provider_pool_stats,provider_result,query_cost,query_pagination,user_auth}.rs`).
- Delete or stop wiring the self-owned replacements:
  `platform/{errors,security_config,model_metadata,provider_registry,graphiql}.rs`,
  `data/keyset_cursor.rs`, and the self-owned Postgres SQL layer
  `data/clients/postgres/*` (param mapping, statement builders, TLS connector).
  Decide per-file: delete, or keep dormant behind a feature.
- **Easier than the original removal** — the facade module exists, the framework
  compiles locally once B0 restores a reference, and the compiler drives every
  edit. Estimate **1–2 weeks if the symbol surface is stable**; longer if B0.3
  shows drift.

### B3 — Switch the generator `product_gen`/`product_cli` → `app_gen`

- `.appfw/model/**` is unchanged — the model format was kept compatible.
- Re-add the `scripts/appfw` wrapper (removed in commit `9d54215`); repoint the
  dev + CI workflow (`generate` / `generate --check` / `validate` /
  `boundary-check` / `feature-check` / `policy-test`) at `app_gen`.
- **Regenerate and expect a large diff** across `backend/src/schemas/`,
  `routes/`, `handlers/**/generated.rs`, `entity_types.yaml`, and
  `frontend/src/generated/appfw-ui-contract.ts` — `app_gen` re-types all of it
  against `appfw_runtime`. Re-verify the regenerated tree against every gate.
- Decide: delete `product_gen`/`product_cli` from the workspace, or keep them
  present-but-unused. Note `rego_test` and `api_tests` were restructured around
  `product_gen::policy` / a self-owned harness (phase 7 slice 7) — re-adoption
  may move them back to `appfw_test`.

### B4 — Frontend UI kit (separate, smaller)

- `frontend/src/ui/kit.tsx` replaced vendored `@appfw/pds-health-components`
  (commit `f4d741d`). Re-add the dependency (same registry/vendor question for
  npm), swap `kit.tsx` imports back. **This is independent of B1–B3** — it can
  be done, deferred, or skipped on its own. ~days. If PDS isn't actively
  developing the component library, there's a weaker case to revert this than
  the backend.

### B5 — Re-verify, and reconcile the fixes made during replacement

Confirm each of these is fixed in the framework version being adopted, or
re-apply as a `[patch]` / local override:

- jsonb `null` binding bug — commit `e58978f` ("finding N" in the plan doc)
- cors feature-gating bug — commit `a338f58`
- deny-by-default Rego semantics — "finding Q"; made explicit and product-owned
  during the replacement, needs to stay guaranteed

Then: full 311-test backend suite, all gates, and live GraphQL smoke against
real Postgres (the method that verified the phase-5 audit hash-chain), on every
step that touches a request path.

### B6 — Rework the post-cutover feature work

~13 commits landed after the framework was removed, built against `platform::*`:
M10 Graph governed-write stack (`e5b6df0`, `115c2bd`), Meeting Center rewrite
(`300dabc`), AI document extraction (`877a7cd`, `0f2cb81`), the 5 gate review
forms (`55c6848`), live Graph directory search (`44caa6c`). Import repointing is
mechanical **if the `platform::runtime` facade is kept as the permanent seam**
(recommended regardless of path).

### Total

**~2–4 weeks of engineering** if B0.3 shows a stable symbol surface, plus the
elapsed time to clear B0.1/B0.2 with PDS. More if upstream has drifted.

## Path C — Hard git revert

**Not viable.** Reverting past `b8adf3a` (phase 5 start) drops ~3 weeks of real
product features that landed after the cutover, plus the three bug fixes in B5.
Replacement commits and feature commits interleave after the cutover. Listed
only to close it off.

## Open decisions to ratify before Path B starts

1. **Vendor vs. registry.** "Both own bug-fixes" means the product will patch
   framework code. A registry-published crate is not patchable without
   `[patch."pds-app-framework-crates"]` overrides pointing at a fork — workable
   but adds a maintenance seam. A vendored `vendor/app-framework/` copy is
   directly patchable but drifts from upstream and erodes the "free upstream
   fixes" benefit that motivates Path B. **Recommendation to discuss:** registry
   dependency as the norm + a documented `[patch]` fork for the cases where the
   product must fix something ahead of upstream, with a standing commitment to
   upstream those patches so the fork stays thin.
2. **Is there an upstream contribution path?** Can this team PR into the PDS
   framework, or only file tickets? If only tickets, "both fix bugs" in practice
   means "we carry patches indefinitely" — which pushes back toward vendoring,
   or back toward Path A.
3. **MSSQL auth, worker mode (`mcp`/`kafka`/`sync`).** Dropped as unused. Confirm
   still unused before re-adding any of it — each one re-expands the feature
   matrix and the surface area.
4. **Frontend kit (B4) — in or out of scope?** Decouple this decision from the
   backend.

## Recommendation

**Conditional Path B.** The forward benefits are real given PDS ownership +
active upstream development, so re-adoption is the right direction — but gate it:

1. Clear B0.2 (registry reachable from CI/deploy, named owner, verified date).
   If it can't be cleared reliably → vendor, or fall back to Path A.
2. Clear B0.3 (symbol-surface drift check against *current* upstream). If
   drifted → re-scope B2/B3 before committing to a timeline.
3. Ratify the vendor-vs-registry decision and the contribution-path question.

Until all three clear, **hold at Path A** — the self-owned code is working and
carries no schedule risk. Path A is not a failure state; it's the safe hold
while the Path B preconditions are settled with PDS.
