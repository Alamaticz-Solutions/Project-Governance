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
| `.appfw/model` (config source of truth) | 24 entity_types, 9 enum types, 4 relationship files, 41 governance RBAC policies, 3 seeds, 2 model tests | `937dfbd` (M9) |
| Backend generate / validate / boundary-check / generate --check / product test | all green in Docker (framework mounted) | `937dfbd` (M9) |
| Backend hand-owned services (M8 workflow engine, M9 Graph provider) | compile, boundary-clean, unit tests pass | `937dfbd` (M9) |
| Frontend `typecheck` / `vite build` / `appfw:check` | all green | `ea41685` (HEAD) |
| Frontend `product frontend-test` | N/A — scaffold ships no `test:frontend`; manifest does not require one | — |
| Independent 11-section review + file-12 verification pass | **not done** — must be a separate reviewer | — |

**Every change between `937dfbd` and HEAD (`ea41685`) is under `frontend/`.** No
`.appfw/model`, backend, or spec file changed, so the M9 backend gate results
remain logically valid at HEAD — but they were **not re-executed at HEAD** because
the framework CLI was removed (see §6).

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
- **M10** — deferred. The G1 governed-write stack is not built; all Graph writes
  fail closed.
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

### Backend (REQUIRES the framework — see §6)

With the framework tree restored at `../app-framework` and `../appfw-env.sh`
sourced, in a Linux container with `/app` (this repo) and `/app-framework`
mounted, `rustfmt` + `rsync` installed, and `/app/.cargo/config.toml` present:

```bash
scripts/appfw product validate --json
scripts/appfw product generate
scripts/appfw product generate --check --json
scripts/appfw product boundary-check --json
scripts/appfw product test --fast
scripts/appfw product api-test        # not yet exercised in this rebuild
scripts/appfw product policy-test     # not yet exercised in this rebuild
scripts/appfw product handoff --json
scripts/appfw product review-brief --auto-depth --json
```

Windows notes that blocked earlier attempts and forced Docker Linux:
`app_gen` rejects `\\?\`-canonicalized paths and reparse-point ancestors
(OneDrive); `appfw-cli` can’t exec the bash dispatcher (os error 193);
`python3` is missing. Run everything in a `rust:1` Linux container.

---

## 6. The framework is not in the tree

`../app-framework/` (the client’s App Framework source, ~2.9 GB) was **deleted**
at the owner’s instruction — it is client IP and must not be retained by the AI
harness. Consequences:

- **Anything that shells through `scripts/appfw` cannot run** until the framework
  zip is re-supplied and extracted at `../app-framework/`. That is every backend
  gate in §5, plus `product handoff` and `product review-brief`.
- `backend/Cargo.toml`, `.cargo/config.toml`, `api_tests/Cargo.toml`,
  `rego_test/Cargo.toml` carry `path = "../../app-framework/..."` deps — a
  `cargo build` of the backend also needs it.
- `frontend/vite.config.ts` references `../app-framework/` only in
  `server.fs.allow` (dev convenience); the frontend build does **not** need it.
- `../appfw-env.sh` still exports a now-dead `APPFW_FRAMEWORK_ROOT`.

To resume backend work: restore the framework at `../app-framework/`, then run
the §5 backend gates in Docker to reconfirm green at HEAD before making changes.

---

## 7. Evidence & freshness (`docs/evidence/`)

All `target/` output is `.gitignore`d, so retained copies live here:

| File | What | Produced at |
|---|---|---|
| `frontend-gates-m12.txt` | typecheck + build + appfw:check + phi:check console output, all exit 0 | HEAD `ea41685` + the M12 lint additions |
| `frontend-scaffold-check-ea41685.json` | `appfw:check` machine evidence, `ok: true` | HEAD |
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

- **M10** — G1 governed-write stack for Microsoft Graph. All writes fail closed
  until it exists.
- **Spec 004 AI-egress boundary** — the pre-egress PHI classification gate + the
  single OpenAI egress point. `meeting_agent.process_transcript` stops at
  “transcript captured, ai_status: pending”.
- **Live provider certification** — no Graph read has made a retained live call;
  tier stays `compiler_contracted`.
- **`product api-test` / `product policy-test`** — not exercised in this rebuild.
- **Bespoke gate forms** — the seven legacy per-role review forms
  (BTA/EAC/EPMO/Finance/PIC) are replaced by one generic gate form.
- **Frontend**: real-backend integration testing; route-level code-splitting;
  an E2E/a11y harness (`test:frontend` does not exist); wiring the PHI/PII lint
  into CI (there is no CI here).
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
