# Governance rebuild — handoff (M12)

Branch `governance-restructure`, local git only (no remote). This document is the
entry point for the next engineer / reviewer. It records what was built (M1–M11),
what is generated vs hand-owned, how to run each gate, what evidence exists and
how fresh it is, and what still needs an independent pass.

Companion documents:

- `GOVERNANCE-APPFW-REBUILD-PLAN.md` (repo parent dir) — the milestone plan.
- `.appfw/specs/000-INDEX.md` — the four specs + cross-spec reconciliation + the
  five open decisions. **Read it before treating any single spec as final.**
- `docs/evidence/` — retained gate output (see “Evidence & freshness” below).

---

## 1. Status at a glance

| Area | State | Last green at |
|---|---|---|
| `.appfw/model` (config source of truth) | 24 entity_types, 9 enum types, 4 relationship files, 41 governance RBAC policies (+1 framework `system`), 3 seeds, 2 model tests | `937dfbd` (M9) |
| Backend generate / validate / boundary-check / generate --check / product test | all green in Docker (framework mounted) | `937dfbd` (M9) |
| Backend hand-owned services (M8 workflow engine, M9 Graph provider) | compile, boundary-clean, unit tests pass | `937dfbd` (M9) |
| Frontend `typecheck` / `vite build` / `appfw:check` / `phi:check` | all green | `f506819` (HEAD) |
| Frontend `product frontend-test` | N/A — scaffold ships no `test:frontend`; manifest does not require one | — |
| Independent 11-section review + file-12 verification pass | **not done** — must be a separate reviewer | — |
| **App actually running (read path)** | verified live — real seeded data through the SPA + GraphQL API | see §11 |
| **App actually running (write path)** | verified live **after a local, session-only patch** to the extracted framework copy (finding N — root cause is a one-line bug in `appfw_provider_postgres`, not fixable from this repo; not committed here, deleted with the framework tree) | see §11 |

The rest of this file predates §11. **§11 is the current, most-verified state** —
read it for what was actually machine-checked and live-tested, including the
framework was temporarily restored for that work and the exact commits
(`25746f2`, `9926424`, `6abfb43`, `a164c65`) it produced.

---

## 2. What was built, by milestone

- **M1–M2** — App Framework `product-intake --source-kind legacy` scaffold;
  retained legacy analysis + model proposal (review-only). Commits `a4f30bb`,
  `36d799e`.
- **M3** — Four specs (`001` auth/RBAC/tenancy full, `002` gate/workflow engine
  full, `003` MS Graph SaaS provider full, `004` AI/storage/non-primitives
  lightweight) + `000-INDEX.md` reconciliation; completed legacy discovery
  inventory (`.appfw/legacy-modernization.yaml`); hand-authored `.appfw/model`
  for schema `governance` (24 entities, `audited` facet on the workflow-critical
  ones, `concurrency` facet where the legacy app had `version`, one bodies-only
  Rego per table under `rbac/`, 9-node → 19-node workflow-stage-definition seed
  DAG). Commits `86561c4`, `cfaf2ef`, `90e9253`.
- **M4–M7** — data source / manifest / enums / entities / relationships / RBAC /
  seeds folded into M3’s model authoring and the first green generate+validate.
- **M8** — net-new gate/workflow engine as product code in
  `backend/src/services/` wired through the generated
  `route → handler → _impl → service → DataAccess` pattern. Custom methods:
  `Project.{submit_decision, fast_track_complete, cancel}`,
  `GateReview.decide`, `GateSubmission.save_stage`,
  `WorkflowStage.{start, submit, skip}`. Commits `f09e65f`, `017229e`.
- **M9** — governed Microsoft Graph SaaS provider in
  `backend/src/services/graph/`: named-operation read registry (5 reads,
  `compiler_contracted` tier — request-plan proven by unit contracts, no
  retained live run), **every write `write_gated`** behind the 8-item “G1”
  evidence stack, honest capability tiers (`vendor_contract.rs` + its
  `contracts_are_honest` test), single outbound call site (`client.rs`).
  `Meeting.process_transcript` orchestration (transcript via governed Graph read
  **or** pasted VTT; AI extraction deferred to spec 004, recorded as pending, no
  egress). Commit `937dfbd`.
- **M10** — the G1 governed-write stack is built (`backend/src/services/graph/writes.rs`
  + `services/meeting_scheduling.rs`), all 8 components real: enforcement
  chokepoint (`writes::execute` is the only non-GET call site), actor context
  (`WriteContext`), token isolation (`GRAPH_WRITE_CLIENT_ID`/`_SECRET`, falls
  back to the read app with a warning), named mutation registry + typed
  request binding (`WriteOperation::plan/body`), idempotency + replay
  protection (`GraphWriteAttempt` ledger, sha256 fingerprint), policy gate
  (Admin/ProjectManager/EPMO, provisional pending the P5 matrix), audit
  evidence (`AuditEvent` on every outcome). Two operations are wired to a
  callable custom method (`Meeting.schedule_via_graph`, `.cancel_via_graph`)
  and the Meeting Center UI; `vendor_contract.rs` upgrades them to
  `compiler_contracted` (a G1-gated write, not `write_gated`) via an explicit
  allow-list `assert_honest` checks. The four remaining operations
  (subscriptions, SharePoint) stay `write_gated` -- no public HTTPS callback
  for subscriptions in this environment (spec 003 D2), no SharePoint decision
  (spec 004 D1). 322 backend tests pass (0 failed, 1 ignored -- the live
  Graph connection check). See `docs/architecture/m10-g1-governed-write-plan.md`.
  **Live write certification (2026-09-07, Azure AD write permissions
  confirmed granted by the user):** `scheduleViaGraph` created a real Teams
  meeting on the `lventur.com` tenant (`POST /users/{organizer}/onlineMeetings`)
  and `cancelViaGraph` deleted it seconds later -- retained evidence in
  `graph_write_attempts` (both rows `succeeded`, with the real
  `graph_resource_id`) and `audit_events` (`GRAPH_WRITE_SCHEDULE_TEAMS_MEETING_SUCCEEDED`,
  `GRAPH_WRITE_CANCEL_ONLINE_MEETING_SUCCEEDED`). Two real bugs surfaced and
  were fixed by this live run, neither catchable by the unit tests: (1) an
  idempotency-ledger retry inserted a duplicate row instead of reusing the
  pending/failed one; (2) `POST /onlineMeetings` requires `organizer` as an
  AAD **GUID** (`400 InvalidArgument: "The userId in request URL is not a
  valid GUID."` when a UPN/email was sent), and creating a Teams meeting this
  way produces an **online-meeting resource, not a calendar event** -- the
  originally-planned `CancelCalendarEvent` (`DELETE /events/{id}`) is the
  wrong endpoint for it; added `WriteOperation::CancelOnlineMeeting`
  (`DELETE /onlineMeetings/{id}`) and `cancel_via_graph` now prefers it.
  `schedule_teams_meeting` is `compiler_contracted`; `cancel_online_meeting`
  and `cancel_calendar_event` both are too (`cancel_calendar_event` itself
  still has no live pass -- nothing scheduled through this stack ever sets
  `graph_event_id`, so exercising it needs the not-yet-built `POST /events`
  scheduling path). Subscriptions and SharePoint remain untouched.
- **M11** — frontend.
  - **11a** (`6915d5f`): generic contract-driven renderer wired to the generated
    `EntityWorkspace`.
  - **11b–11d** (`8e3586d`, fixes `ea41685`): the product SPA. Hand-written
    product-owned layer under `src/lib` + `src/app` + `src/features` (all of
    `src/**` except `src/generated/**` is product-owned per
    `.appfw-ui/ownership.json`). Screens: dashboard, projects (list + detail),
    workspace (gate progression + stage transitions + generic gate form +
    approval decision), team-inbox, intake, notifications, meeting-center
    (list + detail), audit, generic entity browser.
  - The 11c document/workflow archetype is a **generic** gate workspace, not the
    seven bespoke legacy gate forms — deliberate; that archetype has no reference
    anywhere in the framework.
- **M12** — this document + retained evidence + spec status update + stale-doc
  fixes + an optional manually-run PHI/PII source lint
  (`frontend/scripts/check-phi-lint.mjs`).

---

## 3. Generated vs hand-owned (do not hand-edit generated)

| Path | Owner | Policy |
|---|---|---|
| `.appfw/model/**` | product | source of truth — edit here, then regenerate |
| `backend/src/handlers/**` (non-`_impl` bodies), `backend/src/routes/**`, generated GraphQL types, `backend/src/schemas/**` | app_gen | regenerate, do not hand-edit |
| `backend/src/handlers/governance/<entity>.rs` `*_impl` fns, `backend/src/services/**` | product | hand-owned, preserved across regeneration; must stay `cargo fmt`-canonical or `generate --check` fails |
| `frontend/src/generated/**` (`appfw-ui-contract.ts`, `appfw-entity-workspace.tsx`), `frontend/.appfw-ui/scaffold-manifest.json` | app_gen | regenerate only |
| everything else under `frontend/src/**`, `frontend/{package.json,tsconfig.json,vite.config.ts}` | product | product-owned (`.appfw-ui/ownership.json` → `src/**`) |
| `frontend/vendor/*.tgz` | vendored framework build output | replace only from a matching framework build |

---

## 4. Frontend architecture (M11)

```
src/
  generated/            app_gen — do not edit
    appfw-ui-contract.ts        41 entity contracts (24 base + 17 *Audit companions)
    appfw-entity-workspace.tsx  framework-owned presentational list component
  lib/
    appfwClient.ts       GraphQL client for schema `governance`: queryList (connection),
                         findRecord, saveRecord (create/update), invoke() for the
                         custom-method mutations. Error → auth | policy_denied |
                         validation | not_found | provider | network | unknown.
    authContext.ts       sessionStorage-only local session; 14-role UserRole vocab,
                         lowercase to match Rego literals. NOT a security boundary.
    tenantContext.ts     single-tenant; defaults to the generator-baked 180000.
    entities.ts          contract lookups by typeName / routeSegment.
  app/
    providers.tsx        AppProviders + useAsync / useAction hooks.
    AppShell.tsx         react-router shell; command palette navigates via onSelect;
                         local-session dialog (paste bearer + pick role).
    App.tsx              AppRoot route table (BrowserRouter).
    ErrorBoundary.tsx    render-time guard only.
  components/ui.tsx      AsyncSection (renders FeedbackState; fails closed on
                         policy_denied), EnumBadge, DefinitionList, formatters.
  features/
    dashboard/ projects/ workspace/ team-inbox/ intake/ notifications/
    meeting-center/ audit/ entities/ shared/
  main.tsx               bootstraps the router; keeps <ScaffoldReference> at
                         /scaffold so `appfw:check`'s PDS-wiring assertions pass.
```

- **Endpoint:** POST `/governance` (the runtime mounts the async-graphql schema
  there — `backend/src/routes/governance.rs`). Override with `VITE_BACKEND_URL`.
  Dev: the Vite proxy forwards `/governance`, `/system`, `/admin` to `:8080`.
- **Auth:** bearer + `x-tenant-id` headers, from `sessionStorage` only. The
  backend is the authority on policy; the UI role only pre-gates/hides actions.
- **Design system:** `@appfw/pds-health-components` from the vendored `.tgz`
  (carries `dist/*.d.ts`, covered by `skipLibCheck`). Token-only CSS — no raw
  hex. No SSR.
- **Known cost:** the production JS bundle is ~925 KB (~153 KB gzip); the PDS
  barrel import dominates. Route-level code-splitting is a deferred polish.
- **No live backend was available in this environment**, so no screen has been
  exercised against real data. Every screen degrades to the error / empty /
  policy_denied states when the endpoint is unreachable.

---

## 5. How to run the gates

### Frontend (no framework needed — vendored components + local scripts)

```bash
cd frontend
npm install
npm run typecheck      # tsc --noEmit
npm run build           # tsc --noEmit && vite build → ../backend/product_dist
npm run appfw:check     # node scripts/check-scaffold.mjs
node scripts/check-phi-lint.mjs   # M12 addition — PHI/PII source lint (manual)
```

Docker one-liner used for the retained evidence:

```bash
docker run --rm -v "$PWD/frontend":/fe -w /fe node:20 bash -c \
  'npm ci && npm run typecheck && npm run build && npm run appfw:check'
```

### Backend (framework dependency removed — see §6, updated 2026-09-07)

**This section is historical.** As of backend framework replacement phase 7
(`docs/architecture/self-owned-backend-plan.md`), the framework is gone
entirely -- not just deleted from disk, but removed as a dependency
(`backend/Cargo.toml`, `.cargo/config.toml`'s private-registry stanza). There
is nothing left to restore, and `scripts/appfw` no longer exists as something
this repo depends on. The self-owned replacements run directly with `cargo`,
no Docker/Linux workaround needed, no framework checkout required:

```bash
cd product_gen
cargo run --bin product_cli -- generate --check --json   # was: scripts/appfw product generate --check
cargo run --bin product_cli -- boundary-check --json      # was: scripts/appfw product boundary-check
cargo run --bin product_cli -- validate --json            # was: scripts/appfw product validate
cargo run --bin product_cli -- generate                   # was: scripts/appfw product generate
cargo test --manifest-path ../rego_test/Cargo.toml         # was: scripts/appfw product policy-test
cd ..
cargo check --workspace --all-targets                      # was: cargo build, needing the framework path dep
cargo test -p backend --bin backend                         # full backend suite, no framework needed
```

The old Windows/Docker workaround notes (`app_gen` rejecting `\\?\`-canonicalized
paths, `appfw-cli` exec failures, missing `python3`) no longer apply --
`product_cli` is a normal Rust binary in this repo, builds and runs natively
on Windows.

---

## 6. The framework is not in the tree (and, as of phase 7, not needed at all)

`../app-framework/` (the client's App Framework source, ~2.9 GB) was originally
**deleted** at the owner's instruction — it is client IP and must not be
retained by the AI harness. This section used to describe that as a *temporary*
blocker requiring the zip to be re-extracted to resume backend work. That is no
longer true: backend framework replacement phase 7
(`docs/architecture/self-owned-backend-plan.md`) removed `appfw_runtime` as a
dependency entirely, slice by slice, ending with a final cutover that deleted
the `backend/Cargo.toml` path dependency, the `.cargo/config.toml` private-
registry stanza, and (2026-09-07) the local reference copy of the framework
itself. `cargo check --workspace --all-targets` and the full backend test
suite (311 tests) both pass with the framework genuinely absent from disk —
not just unreferenced in a lockfile.

Current state, for anyone picking this up:
- `backend/Cargo.toml`, `api_tests/Cargo.toml`, `rego_test/Cargo.toml`,
  `product_gen/Cargo.toml` — **none** of them reference `app-framework`/`appfw`
  any more. `cargo build`/`cargo check`/`cargo test` on this workspace need
  nothing beyond crates.io.
- `scripts/appfw` (the framework's own CLI dispatcher) is gone along with the
  framework checkout; `product_cli` (`product_gen/src/bin/product_cli.rs`) is
  its self-owned, in-repo replacement (`generate`/`generate --check`/
  `boundary-check`/`validate`/`feature-check`) — see §5's updated commands
  above.
- `frontend/vite.config.ts`'s `../app-framework/` mention in `server.fs.allow`
  is dead config (a dev-convenience path that was never load-bearing) — safe
  to remove whenever someone next touches that file, not urgent.
- `../appfw-env.sh` (sibling to this repo, not tracked here) is now fully
  dead — every env var it exports (`APPFW_FRAMEWORK_ROOT`, the private
  registry index) has no consumer left in this repo.

There is nothing to restore. A future session that wants to reference the
original framework source for historical comparison will need to re-obtain it
from wherever it was originally sourced — the local copy and the zip it was
extracted from (see `Governance-Restructure/M2-CHECKPOINT.md`) are both gone
from this machine as of 2026-09-07.

---

## 7. Evidence & freshness (`docs/evidence/`)

All `target/` output is `.gitignore`d, so retained copies live here:

| File | What | Produced at |
|---|---|---|
| `frontend-gates-f506819.txt` | typecheck + build + appfw:check + phi:check console output, all exit 0 | `f506819` (frontend `src`/config unchanged since) |
| `frontend-scaffold-check-f506819.json` | `appfw:check` machine evidence, `ok: true` | `f506819` |
| `backend-m9/validation.json` | `product validate` — `valid: true`, 0 errors / 0 warnings | M9 `937dfbd` |
| `backend-m9/boundary_check.json` | `boundary-check` — `ok: true`, 62 files checked | M9 |
| `backend-m9/config_contract.md` | generated config contract | M9 |
| `backend-m9/app_topology.json`, `artifact_provenance.json` | topology + provenance | M9 |

The M9 backend artifacts predate M11 but no backend input changed since; treat
them as “last confirmed green at `937dfbd`”, not “green at HEAD”.

---

## 8. Open decisions — need human sign-off (`.appfw/specs/000-INDEX.md`)

The four specs are marked **`accepted-pending-decisions`**, not `accepted`. These
five are unresolved and each can change generated output or service behaviour:

1. **P5** — the Excel gate matrix is not in the repo; the 19-node stage-definition
   seed DAG is reconstructed from `governance_workflow_design.md`, not the
   authoritative source. Full state-machine fidelity is blocked on it.
2. **Q7** — enum casing: the model uses SCREAMING_SNAKE enum members with
   lowercase Rego role literals. Confirm this is the intended contract.
3. **A** — whether the actor id (not just role) belongs in the Rego input for
   single-row ownership filters.
4. **Q5** — audit scope: which entities carry the `audited` facet vs rely on the
   append-only `AuditEvent` entity.
5. **Q3** — drop pgvector / RAG knowledge base, or keep it as a net-new service.

---

## 9. Deferred / not done

- **M10 subscriptions / SharePoint** — the two Meeting-scheduling writes are
  built AND live-certified (see §2 M10 above, 2026-09-07). Subscription
  management (`create/renew/delete_subscription`) and SharePoint upload
  remain fully `write_gated` -- no public HTTPS callback in this environment
  for subscriptions (spec 003 D2), no SharePoint decision (spec 004 D1).
  `cancel_calendar_event` (the `DELETE /events/{id}` path, as opposed to the
  live-certified `cancel_online_meeting`) also has no live pass -- nothing
  in this build ever sets `graph_event_id`.
- **Spec 004 AI-egress boundary** — the pre-egress PHI classification gate + the
  single OpenAI egress point. `meeting_agent.process_transcript` stops at
  “transcript captured, ai_status: pending”.
- **Live provider certification (reads)** — one Graph read
  (`search_directory_users`) has made a retained live call (2026-09-07,
  against the `lventur.com` tenant, connection/auth evidence only per ADR
  0018 -- 6 directory users returned); the other 4 registered reads have not.
  All 5 stay `compiler_contracted` until each has its own retained run.
- **`product api-test` / `product policy-test`** — not exercised in this rebuild.
- **Bespoke gate forms** — the seven legacy per-role review forms
  (BTA/EAC/EPMO/Finance/PIC) are replaced by one generic gate form.
- **Frontend**: real-backend integration testing; route-level code-splitting;
  an E2E/a11y harness (`test:frontend` does not exist).
- **`frontend/scripts/check-phi-lint.mjs`** is a first pass, not wired to CI
  (there is no CI here) and not hardened: e.g. the `us-phone` rule flags
  `555`-exchange placeholder numbers, and the rule set is regex-shape-only. A
  clean run is not proof of no PHI/PII — treat it as a tripwire, and tighten the
  rules + allow-list before relying on it.
- **`OneToOne` relationships** (02 §3 `[TBD]`), **`soft-deleted` filtering**
  semantics (02 §10 `[ASSUMPTION]`), **missing-RBAC-file lint** (02 §5
  `[ASSUMPTION]`), **`ui:` manifest block shape** (02 §8) — all unconfirmed.

---

## 10. Independent review still owed

The plan’s M12 requires a **separate reviewer** for:

- the full 11-section comprehensive review (rulebook file 07 §7.4 shape), and
- the rulebook file-12 verification pass.

Neither can be self-run. Recommended: `/code-review ultra` on this branch
(user-triggered and billed; it cannot be launched from inside a session). It
needs a git repo (this is one) and bundles the local branch without a remote.

Priorities for that reviewer, in order:

1. M9 Graph provider — no SaaS provider in this framework has ever reached
   `live_certified`; this is new engineering. Verify the write-gate cannot be
   bypassed and the capability tiers are honest.
2. M8 workflow engine — the `route → handler → _impl → service → DataAccess`
   boundary, the service-layer ownership checks Rego can’t express, and the
   `generate --check` handler-hash stability.
3. M11c workspace — the document/workflow archetype has no reference; confirm the
   generic gate model is acceptable vs the legacy per-role forms.
4. The five open decisions in §8.

---

## 11. Framework conformance audit (App Framework `893829ad0e30`)

An end-to-end audit against the framework rulebook was run. **Machine gates all
pass** against this framework build at the audited HEAD:

| Gate | Result |
|---|---|
| `product validate` | ok — 0 errors / 0 warnings |
| `product generate --check` | ok — no drift, hand-owned files preserved |
| `product boundary-check` | ok — 0 violations, 62 files |
| `product feature-check` | ok — 14/14 runtime + product feature compiles |
| `product policy-test` | ok |
| `product harness-check` | **was failing** (no `.appfw/agent-profile.yaml`) — **fixed** |
| `cargo check -p backend --all-targets` | ok (pre-existing dead-code warnings only) |
| frontend `typecheck` / `test` / `build` / `appfw:check` / `phi:check` | ok |

Ten deviations were found and remediated (A–I from the static audit, K from the
first live run — see below); M and L (enum casing, `InputProject` required
fields) and N (a framework write-path defect, not fixable here) follow in the
live-run section:

| # | Deviation | Fix |
|---|---|---|
| A | MS Graph integration hand-writes vendor HTTP instead of using the framework SaaS SDK (`saas-connectors.md` §1). | `backend/src/services/graph` now depends on **`appfw_saas_core`** for redaction, retry-after parsing, and secret handling (`SecretString`). A full `appfw_provider_msgraph` crate + `FrameworkProvider` registration + `provider-test` is a *framework* change and remains out of scope (spec 003 §"A new provider crate" already rejected it); recorded in `.appfw/agent-profile.yaml` risk-acceptance. |
| B | `.appfw/manifest.yaml` had no `ui:` block (`product-frontend.md` §Production Serving). | Added `ui.product_spa` / `ui.admin_ui`. |
| C | No shell auth/role route guards (ADR 0009 / 0010). | Added `src/app/RequireAuth.tsx` + `src/features/auth/SignInScreen.tsx`; every route except `/sign-in` is behind the guard, workspace / team-inbox are role-gated, denials render an explicit `ForbiddenState`. |
| D | No frontend test backbone / `test` script (ADR 0011). | Added **vitest** + `@testing-library/react`; `src/**/*.test.tsx` (15 tests incl. the `RequireAuth` permission-state test); `npm run test` + `npm run test:frontend`. Playwright E2E/a11y still deferred. |
| E | Zero `tracing` instrumentation in services (`service-layer.md`). | `#[tracing::instrument]` + `info!`/`warn!` on the Graph read, every workflow transition/decision, `save_stage`, `process_transcript`, and `audit::record`. |
| F | No API-test scenarios for the custom methods (`custom-methods-and-routines.md`). | **Not fixable via the framework tooling** — the generated-API-scenario template requires `graphql.select` and assumes object-returning operations, so JSON-scalar custom methods can't be expressed (CRM has the same gap). Covered instead by `vtt_to_text` service unit tests + the frontend `AppfwClientError` classification tests. |
| G | Frontend client sent only `x-request-id` outbound. | Now sends `x-request-id` + `x-correlation-id` + `x-timezone`; `graphql()` returns the documented `AppfwResult<TData>` (with `correlationId` / `responseMs`). |
| H | Typed-client shapes drifted from `product-frontend.md` §Typed API Pattern. | Added `AppfwRequestContext` / `AppfwResult<TData>` exports; kept the additive `not_found` / `network` categories. |
| I | `product harness-check` failed — no `.appfw/agent-profile.yaml`. | Added the least-privilege product agent profile (modeled on the CRM / nexus references). |
| K | The generated `product-intake` `backend/Cargo.toml` **omits the `provider-postgres` feature** that `backend/src/routes/mod.rs` gates the Postgres runtime registration on — so the backend fails at startup with *"provider factory is not registered for postgres"*. Present since the M2 scaffold; never triggered because `product serve` / `api-test` had never run. | Made `appfw_provider_postgres` `optional`, added `provider-postgres = ["dep:appfw_provider_postgres"]` and put it in `default` (matches the CRM example). |

**Still deferred after this pass** (documented, not silent): Playwright E2E / a11y
evidence; contract-drift automation in CI (there is no CI); a full
`appfw_provider_msgraph` provider crate.

### Live run — `product migrate` / `serve`

The app was brought up end to end for the first time (postgres 16 + the generated
backend serving the API at `/governance` and the SPA at `/`). One further issue
surfaced that the static gates do not catch:

> **J — the seed-SQL generator cannot emit `jsonb` array literals.**
> `pg_seed_literal` renders any array-valued seed field as a PostgreSQL
> `ARRAY[...]` literal. Inserting that into a `jsonb` column fails with
> *"column … is of type jsonb but expression is of type text[]"*. Governance hits
> this on `workflow_stage_definitions.assigned_roles` and `checklist_template`
> (both `property-json`, both seeded as arrays). Object-valued json fields
> (`prerequisites`, `conditions`) generate correctly.
>
> Worked around for the local run by patching the generated `seed.pg.sql`
> (`ARRAY['admin']` → `'["admin"]'::jsonb`). A durable fix is a framework
> `pg_seed_literal` change; the product cannot fix it without either modelling
> those fields as non-arrays (semantically wrong — `gate_eligibility` and the UI
> treat them as lists) or a post-generate SQL patch (which would fail
> `generate --check`). Flagged, not silently patched.

Two backend-startup blockers, cleared to get a first boot at all:

> **Missing `OKTA_ISSUER`.** `appfw_runtime::auth_config` calls `require_env("OKTA_ISSUER")`
> unconditionally at app-state init — `ENV_NAME=local`'s per-request auth bypass
> doesn't skip constructing the Okta verifier. Local runs need dummy
> `OKTA_ISSUER` / `OKTA_AUDIENCE` / `OKTA_CLIENT_ID` env vars; nothing reads
> real Okta since local dev never verifies the token.

> **K — the generated `backend/Cargo.toml` omits the `provider-postgres` feature.**
> `backend/src/routes/mod.rs` registers the Postgres runtime client behind
> `#[cfg(feature = "provider-postgres")]`, but the M2 `product-intake` scaffold
> never defined that feature (the CRM example does: dep `optional`, feature
> `provider-postgres = ["dep:appfw_provider_postgres"]`, in `default`). Backend
> failed at startup with *"provider factory is not registered for postgres"* —
> present since M2, only surfaced because `product serve` had never run before.
> Fixed in `backend/Cargo.toml` (commit `6abfb43`).

Run mechanics (Docker): a `postgres:16` container on a user network; `tables.pg.sql`
+ the patched `seed.pg.sql` applied with `psql`; the backend run with
`ENV_NAME=local` (auto-admin, no token needed) and the `local` data-source
`db_host` pointed at the `postgres` network alias for the container. The
frontend SPA is built into `backend/product_dist` and served at `/`.

### Read and write paths verified live (write path needed a framework patch — see N)

With K fixed the backend serves real data: `queryUsers` returns the 7 seeded
users, `queryWorkflowStageDefinitions` returns the 19 seeded rows with
`assigned_roles` as a genuine jsonb array, the SPA loads at `/` with the right
`<title>`. Findings **M** (enum casing) and **L** (`InputProject` required
fields) were fixed against this live schema and re-verified (commit `a164c65`).

**N — `create_item` (INSERT) fails for any entity beyond the simplest shape.**
`createWorkflowDefinition` (5 columns, no jsonb, no FK) succeeds. `createProject`
and `createWorkflowStageDefinition` (both jsonb columns + a FK + a double-digit
column count) fail every time with `PostgreSQL insert failed: error serializing
parameter N` from `tokio-postgres`, reported by
`backend/src/data/clients/postgres/postgres_client.rs`'s `create_item_json` →
`build_insert` → the framework's `appfw_provider_postgres::provider_mutation_insert_statement`.
The failure is **content-independent**: the reported parameter index and total
param count stay fixed regardless of which field values are supplied (tested
with fields omitted, explicit booleans, explicit map-shaped JSON) — ruling out
a UUID-string or JSON-shape bug in any one field and pointing at the
INSERT-statement / parameter-list construction itself, inside the framework
provider crate.

This was never caught by any static gate (`generate --check` doesn't run SQL;
`product api-test` — the gate that would have caught it — has never run against
a live backend in this rebuild) and is not something introduced by M8/M9/M11:
`WorkflowDefinition` is generated by the same pipeline and works. **It is not
fixable from this product repo** — the failing code is inside
`appfw_provider_postgres`, a framework crate.

**Root cause found and confirmed.** `appfw_provider_postgres/src/param.rs`,
`type_param()`:

```rust
(RuntimeDataType::Object | RuntimeDataType::Json, Value::Null) => {
    Box::new(try_null::<String>(is_nullable, prop_name)?)   // wrong
}
```

Any `jsonb` column with a **null** value is bound as `Option<String>`. But its
placeholder is generated as `$N::jsonb` (`prop_param_ref`), so the server tells
the driver the parameter is jsonb-typed while the client presents a
`String`-typed value; `String::to_sql`'s `accepts()` rejects the jsonb OID,
producing exactly `tokio-postgres`'s generic "error serializing parameter N".
The non-null arm two lines above already does this correctly
(`Box::new(Json(v.clone()))`); the fix is the same wrapper on the null path:

```rust
(RuntimeDataType::Object | RuntimeDataType::Json, Value::Null) => {
    Box::new(try_null::<Json<Value>>(is_nullable, prop_name)?)
}
```

**Applied as a local, session-only patch** to the extracted framework copy and
verified: `createWorkflowStageDefinition` and `createProject` both succeed now
with jsonb columns left unset, `findProject`/`queryProjects` read the new rows
back, and `cancel` (a custom method that goes through `update_item`) applies
correctly. This patch is **not part of the product repo** — it lives only in
the temporary `app-framework/` extraction used for this session's testing, is
never committed here, and is deleted with that tree at session end (§6). It is
reported here so it can be relayed to whoever owns the App Framework; the
product cannot carry a durable fix for framework-crate source.

Practical effect once the framework carries this fix (or once someone applies
it): every create/update on a jsonb-bearing entity — Project, the gate
workspace, meetings — starts working; until then, a fresh (unpatched) framework
extraction reproduces finding N exactly as described above.

### P — `filter`/`sort` GraphQL arguments need SCREAMING_SNAKE enum values, not the PascalCase wire casing

Discovered live while re-testing after N: `queryProjects(filter:{status:{_eq:"Draft"}})`
(the wire casing that mutation inputs and read projections use) matches
**nothing**, even for a row whose `status` reads back as `"Draft"`.
`filter:{status:{_eq:"DRAFT"}}` matches. Same for `assigned_role` /
`role` (`UserRole`): `_eq:"ADMIN"` matches, `_eq:"Admin"` does not. The
`filter`/`sort` arguments are untyped `JSON` scalars — they bypass the
schema's enum type entirely and compare the **raw stored text**, which is the
model's original SCREAMING_SNAKE, not the PascalCase GraphQL applies on the
way in/out through a typed enum position. So the same enum has two casings
depending on where it's used:

| Context | Casing | Example |
|---|---|---|
| Mutation input (`InputProject.status`) | PascalCase | `Draft` |
| Query output (`Project.status`) | PascalCase | `Draft` |
| `filter`/`sort` argument | SCREAMING_SNAKE | `DRAFT` |

Fixed: `components/ui.tsx` exports `toEnumFilterValue` (= the existing
`canonicalEnumKey` normalizer) for building filter clauses;
`ProjectListScreen`'s status filter runs the SelectField's PascalCase value
through it. `DashboardScreen` and `TeamInboxScreen`'s `assigned_role` /
`status` filter literals reverted to SCREAMING_SNAKE (their brief detour
through `roleToEnumValue` — added for finding M, correct for a mutation-input
position, wrong for a filter position — is documented in
`authContext.ts`'s doc comment so it isn't reintroduced at a filter call
site). Verified live: `queryProjects(filter:{status:{_eq:"DRAFT"}})` and
`queryUsers(filter:{role:{_in:["ADMIN","EPMO"]}})` both match now.

### Q — Rego's deny-by-default blocks the product's own service-layer writes, not just client mutations

Chased down after N/P were fixed: `cancel(...)` on a fresh project returned
`{"status": "CANCELLED", ...}` (the Project update succeeded) but the overall
GraphQL response carried `error_category: "access_denied"`. Root cause:
`backend/src/services/audit.rs::record` — called by every governed
transition (`cancel`, `submit_decision`, `decide`, `start`/`submit`/`skip`,
`save_stage`, `process_transcript`) after its own write — appends an
`AuditEvent` through `DataAccess::create_item`, the **same** call path and
therefore the **same Rego policy check** a generated client mutation goes
through. There is no "this is an internal service write" bypass. Three
policies had no `create` (or, for `GateSubmission`, `create`/`update`) rule
at all — Rego's deny-by-default (file 05 principle: "an entity with no allow
rule is inaccessible, not wide open") then blocks the service call itself:

- **`audit_event.rego`** — no rule covered `create` at all (not even
  admin's usual blanket rule, because this file had no blanket-admin rule
  either); every call to `audit::record` failed. **Confirmed live.**
- **`notification.rego`** — `notify_user`/`notify_role` (called by
  `submit_decision` after a decision) had no dedicated create rule; the
  existing blanket admin rule happened to cover admin, but any other actor
  would have been denied. Fixed proactively — not yet exercised live (no
  `ProjectApproval` rows exist to drive `submit_decision` in this session).
- **`gate_submission.rego`** — `save_stage`'s create/update had no allow
  path for a non-admin actor either, same shape. Fixed proactively.

Each got an added `create` (or `create`/`update`) rule scoped to "any
authenticated actor" — matching what the calling service already enforces
before reaching the write (every caller of `audit::record` /
`notify_user`/`notify_role` / `save_stage` has already passed `require_user`,
and the role-gated transitions already checked role before getting there), so
this does not widen *who can act* — it only lets the append/update that
already-authorized action produces actually persist. Published into
`backend/config/generated/schemas/governance/{audit_event,notification,gate_submission}.rego`
by hand-splicing the new rule into the generator's standard wrapper (verified
against an untouched sibling file) rather than a full `product generate`
rebuild; `product generate --check` was re-run afterward to confirm it
reproduces byte-identical output from the `.appfw/model` source.

**Not audited**: the 17 `*_audit.rego` companion-history policies (the
`audited` facet's per-entity change-log tables) show the same "no blanket
create rule" shape under a naive grep, but they are written by the generated
`audited` facet machinery, not by a product service through `create_item` the
way `AuditEvent`/`Notification`/`GateSubmission` are — there is no direct
evidence they are broken, and guessing wrong there risks opening write access
that should stay closed. Left alone; flagged for the independent reviewer
(§10) to check with framework-level knowledge of how the `audited` facet
actually writes its companion rows.

Verified live end to end after the fix: `cancel(projectId, reason)` now
returns `{"ok": true, ...}` with no error, and
`queryAuditEvents(filter:{project_id:{_eq:...}})` returns the
`PROJECT_CANCELLED` row.
