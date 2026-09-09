# 13. End-to-end verification log (2026-09-09)

This chapter records an **actual run** of the whole stack against the live
database on this machine, what passed, and the defects it surfaced. It also
reconciles this guide with the teammate's
`Project-Governance-Local-Setup-Guide.pdf`.

> **Read chapters 6 and 7 with this chapter open.** This run found three defects.
> **Fixing framework bugs is not this team's job** — the two framework-side ones
> (13.2, 13.4) are written up for the PDS framework team in
> [`docs/architecture/framework-issues-for-pds.md`](../architecture/framework-issues-for-pds.md)
> and are **not fixed in our code**. The one genuinely product-side item (13.3 —
> our service layer tracking a framework contract change) **is** fixed here.

## 13.0 Status

| # | Defect | Owner | What we did |
|---|--------|-------|-------------|
| 13.2 | Generated `seed.pg.sql` emits `ARRAY[…]` for `jsonb` columns → `product migrate` fails | **PDS framework** (`app_gen` seed generator) | Reported to PDS (Finding Q). **Not fixed by us.** Local workaround: a `sed` on `seed.pg.sql` after generate (see 13.2 / the setup guide). |
| 13.3 | Workflow custom methods pass a stale array `sort` + an over-limit page size (`500` > cap `250`) | **Product** — our `backend/src/services/**` tracking the framework's query-IR contract | **Fixed & verified live.** 5 sort sites + 3 page-size sites in `approval_state_machine.rs` / `gate_eligibility.rs` / `workspace.rs`. |
| 13.4 | Null value for a scalar `jsonb` column fails to serialize (`error serializing parameter N`) | **PDS framework** (`appfw_provider_postgres/src/param.rs`, sibling of the known Finding N) | Reported to PDS (Finding P). **Not fixed by us.** Workaround: send `{}` for nullable `jsonb` fields; the SPA intake path already does. |

The PDS write-up (repro, root cause, proposed fix, workaround for each) is
[`docs/architecture/framework-issues-for-pds.md`](../architecture/framework-issues-for-pds.md).
It also carries **C1**, a compatibility note on the `sort` / page-size contract
changes that PDS should put in the framework release notes.

---

## 13.1 What was verified to work

Environment on the test machine: `governance-postgres` = **`postgres:16-alpine`**
(user `governance_svc` / pass `local-dev-password`, db `governance`, port 5432),
`backend/.env` with `ENV_NAME=local`, `API_PORT=8080`,
`PG_SERVICE_ACCOUNT_NAME=governance_svc`. Note this is **not** the committed
`podman-compose.yml` (`postgres:14`, user `postgres`) — someone set up a custom
container matched to `.env`. Both work; just be consistent.

| Check | Result |
|-------|--------|
| DB already migrated | **42 tables**, 7 users, 1 workflow definition, 19 stage definitions, `governance` schema only (no `system` tables — confirms the `system` GraphQL schema is served from config metadata, not DB rows) |
| `workflow_stage_definitions` jsonb columns | correctly stored (`assigned_roles = ["admin"]`, `prerequisites = {"gates":["INTAKE_BTA"]}`) — **but see the seed bug in 13.2** |
| `cargo run -p backend` (from `backend/`) | builds in ~38 s incremental, starts clean: `data_sources=1 schemas=2 entity_types=65 access_policies=43`, pool configured, `listening addr=127.0.0.1:8080` |
| `GET /health/ready` | `status: ready`, all 4 checks pass, **provider probe against Postgres passed** (~260 ms) |
| `GET /health/live` | `status: live` |
| `GET /` (with `APP_PRODUCT_UI_ENABLED=true`) | `200` — the SPA bundle is served |
| `POST /governance` with **no `Authorization` header** | works — the `ENV_NAME=local` "no token = admin" path is real (chapter 4.10) |
| `{ queryUsers { items { email role } } }` | returns the 7 seeded users; **`role` comes back PascalCase** (`Admin`, `ProjectManager`, `Bta`, `Epmo`) — confirms chapter 5.3 / 10.2 |
| `{ queryProjects { items } }` | returns the one pre-existing row ("Test Governance Project") |
| `{ queryWorkflowStageDefinitions { items { stage_code prerequisites } } }` | works; `sort` accepted as `{ "<column>": "asc"|"desc" }` |
| RBAC | policy runs on every read (`access_allowed=true` in the logs); as a non-privileged role the owner-filter branch of `project.rego` is applied |
| `createProject` with a **complete** input | **works** — row created, id + `project_number` returned |

**Bottom line:** the infrastructure is sound — build, DB, connection pool,
GraphQL, auth, RBAC, SPA serving, and generated CRUD reads/writes all work
end to end.

---

## 13.2 Defect (PDS framework — reported, not fixed here): the generated seed SQL is invalid Postgres

`database/_pkg/schemas/governance/seed.pg.sql` contains, for the two `jsonb`
columns on `workflow_stage_definitions`:

```sql
  ARRAY['admin'],            -- assigned_roles  (column type: jsonb)
  ARRAY[]::varchar[]         -- checklist_template (column type: jsonb)
```

Postgres rejects this on insert:

```
ERROR: column "assigned_roles" is of type jsonb but expression is of type text[]
```

**Root cause (verified in framework source):**
`app-framework/app_gen/src/utils/filters.rs` → `array_literal()` always emits
`ARRAY[...]` for a Postgres seed value that is a JSON array, regardless of
whether the target column is `jsonb` or a real SQL array. A JSON-array value bound
to a `jsonb` column needs `'["admin"]'::jsonb`, not `ARRAY['admin']`.

**Impact:** a fresh `scripts/appfw product migrate` (or a hand `psql -f
seed.pg.sql`) fails on the first `workflow_stage_definitions` insert — you get
0 or partial stage definitions, and the gate DAG is empty.

**Workaround (do not commit — `product generate` overwrites `seed.pg.sql`):**

```bash
cd <root>/project-governance
sed -i "s/ARRAY\[\]::varchar\[\]/'[]'::jsonb/g; s/ARRAY\['admin'\]/'[\"admin\"]'::jsonb/g" \
    database/_pkg/schemas/governance/seed.pg.sql

PGPASSWORD=<pass> psql -h 127.0.0.1 -p 5432 -U <user> -d governance \
    -v ON_ERROR_STOP=1 -f database/_pkg/schemas/governance/seed.pg.sql
```

Then verify: `select count(*) from governance.workflow_stage_definitions;` → 19.

**Status: reported to PDS as Finding Q, not fixed in our repos.** The proposed
framework fix (make the seed literal filters column-type aware) is written up in
[`framework-issues-for-pds.md`](../architecture/framework-issues-for-pds.md#finding-q--seed-sql-generator-emits-array-for-jsonb-columns).

**Local workaround** (already in the team setup guide; run after every
`scripts/appfw product generate`, do **not** commit the result — it would diverge
from `generate --check`):

```bash
cd <root>/project-governance
sed -i "s/ARRAY\[\]::varchar\[\]/'[]'::jsonb/g; s/ARRAY\['admin'\]/'[\"admin\"]'::jsonb/g" \
    database/_pkg/schemas/governance/seed.pg.sql
```

or `APPFW_MIGRATE_SKIP_SEED=1 scripts/appfw product migrate`, then
`psql -f` the patched seed by hand. Verified: after the `sed`, a fresh
`governance` DB loads `tables.pg.sql` + `seed.pg.sql` with `ON_ERROR_STOP=1` —
7 users, 19 stage definitions, `assigned_roles` typed `jsonb`.

*(On this machine the DB was already seeded correctly — someone applied this
workaround previously.)*

---

## 13.3 Defect (FIXED): the workflow-engine custom methods fail at runtime (stale sort format + over-limit page size)

Calling these GraphQL operations returns an error, **not** a result:

| Operation | Error |
|-----------|-------|
| `eligibleGates(projectId:)` | `validation error: sort must be a JSON object or a JSON-encoded object string, got array` |
| `workspace(projectId:)` | same |
| `pendingApprovals(projectId:)` | same |
| `submitDecision`, `fastTrackComplete` | same (they call `load_approvals` first) |

**Root cause:** the framework's query-IR now requires the `sort` argument to be a
JSON **object** (`{ "created_at": "desc" }` — verified working on
`queryProjects`). The hand-written services still pass the **old** array shape:

```
backend/src/services/approval_state_machine.rs:63   Some(json!([{ "field": "sequence_order", "direction": "asc" }]))
backend/src/services/gate_eligibility.rs:70          Some(json!([{ "field": "sequence_order", "direction": "asc" }]))
backend/src/services/workspace.rs:74, 100, 125       Some(json!([{ "field": "...", "direction": "..." }]))
```

This is **framework-adoption drift** — the services were written against an older
`appfw_runtime` sort contract and never updated when the framework was re-adopted
on the `framework-readopt` branch.

**Impact:** the **gate workspace screen and the eligibility view are
non-functional** right now — `ProjectWorkspaceScreen.tsx` calls `workspace`, the
dashboards/inbox call `pendingApprovals` / `queryProjectApprovals`. The portfolio
list, project detail, intake, notifications, and Meeting Center do **not** use
these methods and work fine.

**Fix applied (product-side):** two stale query-IR contract points, both in
`backend/src/services/{approval_state_machine,gate_eligibility,workspace}.rs`:

1. **Sort shape** — 5 sites: `json!([{ "field": "X", "direction": "asc" }])` →
   `json!({ "X": "asc" })` (the framework's `parse_sort_specs` →
   `normalize_object_input` wants `{ "<column>": "asc"|"desc" }`).
2. **Page size** — 3 sites passed `500`; the framework caps at
   `APP_QUERY_MAX_PAGE_SIZE` (default **250**) → `pagination limit 500 exceeds
   maximum page size 250`. Changed to `250` (these are bounded per-project
   queries — an approval chain / the 19 seeded stages).

Verified live: `eligibleGates` → `{ eligible_count: 2, gates: [19] }`;
`workspace` → `{ project, gate_submissions, approvals, recent_audit, eligibility }`;
`pendingApprovals` → `{ count: 0 }`; `submitDecision` now reaches the domain check
(`"no pending approval addressed to your role"`), not a framework error.
`cargo test --workspace` green.

---

## 13.4 Defect (PDS framework — reported, not fixed here): `createProject` fails when a nullable `jsonb` field is omitted

```graphql
mutation { createProject(input: { project_number:"X", project_name:"Y", business_unit:"IT",
  manager_id:"<uuid>", priority:"Medium", status:"Draft", created_at:"..." }) { id } }
```

→ `data store operation failed`; backend log:
`PostgreSQL insert failed error=error serializing parameter 37`.

Adding `ai_extracted_data: {}` (an empty object for the nullable `jsonb` column)
makes the same mutation **succeed**. So a `NULL` value for a plain `jsonb` column
still can't be serialised by the provider.

This is the **same family as `app-framework/PATCHES.md` Patch 1 (Finding N)** —
which fixed `NULL` binding for `jsonb[]` (`JsonArray` / `ObjectArray`) but **not**
for plain `jsonb` (`Json` / `Object`).

**Status: reported to PDS as Finding P, not fixed in our repos.** The proposed
one-line fix in `appfw_provider_postgres/src/param.rs`
(`try_null::<String>` → `try_null::<Json<Value>>` on the
`(Object | Json, Value::Null)` arm) is in
[`framework-issues-for-pds.md`](../architecture/framework-issues-for-pds.md#finding-p--null-scalar-jsonb-parameter-binding).

**Local workaround:** always send `{}` (or a real value) for a nullable `jsonb`
column. The frontend Intake form sends `ai_extracted_data`, so the SPA create
path is unaffected; direct API callers and integration tests must include it.
Affected columns: `Project.ai_extracted_data`, `GateSubmission.data`,
`WorkflowStageDefinition.conditions`, `AuditEvent.old_values` / `new_values`,
several `Meeting.*`.

---

## 13.5 Refinement: GraphQL enum casing is PascalCase in *both* directions

Chapter 5.3 said reads return PascalCase. Confirmed, and **input is the same**:

```
createProject(input: { priority: "MEDIUM" })   →  ERROR: enumeration type "ProjectPriority"
                                                    does not contain the value "MEDIUM"
createProject(input: { priority: "Medium" })    →  OK
```

So: **GraphQL enum wire value = PascalCase** (`Medium`, `Draft`, `Admin`) for
both query results and mutation inputs. **`filter` arguments** (raw JSON) still
compare the stored `SCREAMING_SNAKE` text. Rego literals are lowercase.

---

## 13.6 Corrections to chapter 4 (this guide) from the run

| Chapter 4 said | Reality |
|----------------|---------|
| `cd <root>/project-governance` then `cargo run -p backend` | **must be `cd <root>/project-governance/backend`** first — `config/loader.rs` resolves `config/generated/` relative to the current directory. From the repo root it fails with `failed to read .../project-governance/config/generated/data_sources.yaml`. |
| serve the SPA — implied | you must set **`APP_PRODUCT_UI_ENABLED=true`** (env or `.env`) or `/` 404s. The teammate's `.env` sets it; the on-disk `.env` here does not. |
| `PG_SERVICE_ACCOUNT_NAME=postgres` (from the compose file) | the on-disk `.env` uses **`governance_svc` / `local-dev-password`**, matched to a custom `postgres:16-alpine` container. Pick one pairing and make `.env` + the container agree. |
| Option A pipes `seed.pg.sql` in as-is | `seed.pg.sql` is **invalid** — apply the 13.2 `sed` patch first. |

---

## 13.7 Reconciliation with the teammate's PDF (`Project-Governance-Local-Setup-Guide.pdf`)

The teammate's guide is **accurate and was verified on WSL2 Ubuntu**. It is the
better *setup* reference for the mechanical steps; this guide is the better
*understanding* reference. Differences and gaps:

### The teammate's PDF has, that this guide should adopt

| Item | Where in the PDF |
|------|------------------|
| **WSL2 is the recommended Windows path** — `scripts/appfw` (bash) runs natively; the Linux linker is a ~200 MB apt install vs. multi-GB VS Build Tools + a container. `wsl --install -d Ubuntu`. | §1 |
| Work inside the **WSL filesystem** (`~/projects`), **not** `/mnt/c/...` and **not** OneDrive/Dropbox — cloud sync corrupts the multi-GB `target/`. | §2 |
| The clone URLs: `github.com/Alamaticz-Solutions/app-framework` and `.../Project-Governance` (clone as `project-governance`). | §2 |
| `chmod +x scripts/appfw` (both repos) — committed without the execute bit; or call `bash scripts/appfw ...`. | §2 |
| `set -a && . backend/.env && set +a` before `scripts/appfw product migrate` — migrate reads `ENV_NAME` + `PG_SERVICE_ACCOUNT_*` from the environment, and `dotenv` only auto-loads for `cargo run`. | §0, §6 |
| apt packages: `build-essential pkg-config libssl-dev postgresql-client`. | §3 |
| The **seed ARRAY[] patch** (this guide now has it too, 13.2). | §6 |
| Data-source **port override** for a busy 5432: edit the `local` block of `backend/config/generated/data_sources.yaml` (generated; local edit OK, don't commit). | §5 |
| Startup log to expect: `entity_types=65 access_policies=43`, `PostgreSQL connection pool configured`. | §8 |
| The `queryUsers` curl smoke check. | §8 |
| "What is committed vs. local-only" table. | §11 |

### This guide has, that the teammate's PDF lacks

- **Why** any of it works — the framework relationship, code generation, the
  request pipeline, the workflow engine, RBAC/Rego, every file (chapters 1–12).
- The exact **local auth token format**
  (`appfw-local:user=…;tenant=…;roles=…`) and the no-token-= -admin shortcut.
  The PDF's "Bearer token: any non-empty string" is right that the backend
  ignores it — but note it also means the User name / Primary role you type into
  the SPA form **do not change your backend identity** (you're always the
  `local-dev` admin unless you send a real `appfw-local:` token).
- The **runtime defects in 13.3 and 13.4** — the PDF's smoke check
  (`queryUsers`) passes without ever exercising them.
- The framework-provenance / hash / `PATCHES.md` picture (chapter 3).
- The known-gaps and open-decisions register (chapter 12.4).

### Where the two disagree — believe the PDF (it was run)

| Topic | PDF | This guide (original) | Correct |
|-------|-----|----------------------|---------|
| Run directory | `cd backend` then `cargo run` | `cd project-governance` | **PDF** — fixed here in 13.6 |
| Port | 8090 (8080 was taken) | 8080 | either — it's `API_PORT` |
| `APP_PRODUCT_UI_ENABLED` | set in `.env` | mentioned only in passing | **PDF** — required, 13.6 |
| Node version | 20.x verified | "26" (this machine's) | 20 is the tested baseline; ≥20 works |
| Migration | `scripts/appfw product migrate` runs `tables.pg.sql` + `seed.pg.sql`, seed needs the patch | Option A said pipe both in directly | **PDF** |
| Table count | 42 | "~45" | **42** (verified) |

---

## 13.8 "Did we cover everything?" — the checklist

| Area | This guide | Teammate PDF | Verified live | Gap to close |
|------|-----------|--------------|---------------|--------------|
| Concepts / Rust literacy / GraphQL / RBAC | ✅ ch 1 | — | — | — |
| Framework dependency + hashes + upgrade | ✅ ch 3 | partial (§2) | SHA checked | — |
| WSL2 setup path | ⚠️ container only | ✅ §1 | not re-run (no WSL here) | **add WSL2 as the primary Windows path to ch 4** |
| Toolchain versions | ✅ (measured) | ✅ (verified) | ✅ | reconcile Node 20 vs 26 |
| `backend/.env` contents | ✅ ch 4.7 | ✅ §4 | ✅ (differs: `governance_svc`) | note the two valid pairings |
| Start Postgres | ✅ ch 4.5 | ✅ §5 | ✅ (`postgres:16-alpine` here) | note compose vs custom container |
| Migrate DB | ✅ ch 4.6 | ✅ §6 | ✅ (42 tables) | **seed ARRAY[] patch — now in 13.2** |
| Build frontend | ✅ ch 4.4 | ✅ §7 | ✅ (`product_dist` present) | — |
| Run backend | ⚠️ wrong cwd | ✅ §8 | ✅ (from `backend/`) | **fixed in 13.6** |
| Run frontend (dev) | ✅ ch 4.9 | serves built bundle only | not run | — |
| Log in | ✅ ch 4.10 (token format) | ✅ §8 (looser) | ✅ (no-token admin) | — |
| Health + smoke | ✅ ch 4.8/4.12 | ✅ §8 | ✅ all pass | — |
| Regenerate after model change | ✅ ch 2.4 / 3.7 | ✅ §9 | not run | — |
| Request flows (login/read/create/gate/approve) | ✅ ch 7 | — | ✅ reads/create; ❌ gate/approve (13.3) | **add the 13.3 status callout to ch 6 & 7** |
| Troubleshooting | ✅ ch 4.14 | ✅ §10 | + 3 new runtime bugs | **add 13.3–13.5 to ch 4.14 / 12.4** |
| Known gaps / open decisions | ✅ ch 12.4 | — | + 3 framework-drift bugs | **add 13.2–13.4 to the register** |
| PDS deployment | ✅ ch 12.4 + `deployment-pds.md` | — | not in scope | — |

**Verdict:** the *setup* is covered between the two guides once this guide adopts
the WSL2 path, the `cd backend` fix, `APP_PRODUCT_UI_ENABLED`, and the seed
workaround (all now recorded here). The *newly discovered* issue is that **three
re-adoption defects** sit between "the app starts" and "the workflow actually
works" — neither guide's smoke check caught them because they only exercised
users/health:

- **13.3** (`sort` / page-size contract drift) is **product-side and fixed** on
  `framework-readopt`.
- **13.2** (seed `ARRAY[…]`) and **13.4** (null scalar `jsonb`) are **PDS
  framework bugs**. Fixing the framework is not this team's job — they are
  written up for PDS in
  [`docs/architecture/framework-issues-for-pds.md`](../architecture/framework-issues-for-pds.md)
  and carried locally as documented workarounds until PDS ships a fix.

## 13.9 Hand-off to PDS

[`docs/architecture/framework-issues-for-pds.md`](../architecture/framework-issues-for-pds.md)
is a standalone bug report for the PDS App Framework team — Finding P (null scalar
`jsonb`), Finding Q (seed `ARRAY[…]`), and C1 (the `sort` / page-size
compatibility note), each with a minimal repro, the root cause we traced, a
proposed fix, and our local workaround. Give them that file. It also references
the already-known Finding N (`pinned/local-patch-1` on the mirror), which still
needs upstreaming.
