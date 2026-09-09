# 4. Getting started from scratch (Windows)

This chapter takes a clean Windows machine to a running app you can log into.
Every step says *what it does* and *how to tell it worked*.

Your repo is at `C:\Users\ManojRajakumar\Governance-Restructure\project-governance`
and the framework at `...\Governance-Restructure\app-framework`. This guide uses
`<root>` for `C:\Users\ManojRajakumar\Governance-Restructure`.

---

## 4.0 What you're about to build, and the honest state of it

- `cargo check --workspace` **passes today** — the code compiles.
- The framework checkout is effectively in sync with `appfw.lock` (chapter 3.3).
- **The database is not set up for you.** You will create it and load the schema.
- **There is no password login.** In local dev, sending no auth token makes you
  an `admin` automatically; to act as another role you pass a small
  `appfw-local:...` string (4.10). The seeded demo users are data references, not
  login accounts.
- Microsoft Graph and OpenAI are **optional** and off unless you add credentials.
  Everything except meeting scheduling and AI extraction works without them.

---

## 4.1 Install the tools

| Tool | Version seen on this machine | Install | Verifies with |
|------|------|---------|---------------|
| **Rust** (via rustup) | 1.98.0 | <https://rustup.rs> | `cargo --version` |
| **Node.js** | 26.5.0 (any ≥ 20 is fine; Dockerfile uses 22) | <https://nodejs.org> (LTS) | `node --version` |
| **Docker Desktop** | 29.7.2 | <https://www.docker.com/products/docker-desktop> | `docker --version` |
| **Git** | any recent | <https://git-scm.com> | `git --version` |
| **Git Bash** | ships with Git for Windows | — | needed to run `scripts/appfw` and bash snippets |

You do **not** need to install PostgreSQL — it runs in a container.

Approximate download/disk cost of the toolchain itself: Rust ~1.5 GB (toolchain +
registry cache after first build), Node ~150 MB, Docker Desktop ~1.5 GB, the
`postgres:14` image ~150 MB, the `rust:1` image (for the framework CLI) ~1.5 GB.

---

## 4.2 Get both repositories in place

They must be **siblings**:

```
<root>\
├── app-framework\
└── project-governance\
```

If you only have `project-governance`, clone the framework next to it and check
out the pinned commit:

```bash
cd <root>
git clone <app-framework repo URL> app-framework
cd app-framework
git checkout 6ee6985b7d357a54fb9eddb456da50654ce87c3d   # the appfw.lock framework_git_sha
cargo generate-lockfile                                  # only if Cargo.lock is missing
```

**Verify:**

```bash
grep framework_git_sha <root>/project-governance/appfw.lock
git -C <root>/app-framework rev-parse HEAD
```

The framework SHA in `appfw.lock` should match (or, as noted in 3.3, be one
doc-only commit behind HEAD — that's fine).

---

## 4.3 Build the backend (first time)

```bash
cd <root>/project-governance/backend
cargo check --workspace
```

`cargo check` type-checks everything without producing a runnable binary — it's
the fastest way to confirm the tree is healthy.

**Timing (measured on this machine):**

| Build | Time |
|-------|------|
| `cargo check --workspace`, incremental (most deps already compiled) | ~36 s |
| `cargo check --workspace`, **cold** (nothing compiled — first ever run, or after `cargo clean`) | **expect 8–20 minutes.** The workspace pulls in ~500 crates plus the whole framework; a laptop CPU near the low end of that range. |
| `cargo build -p backend` (produces the runnable debug binary) | add ~1–3 min on top of a warm `check` |
| `cargo build --release -p backend` (optimised, for Docker) | 10–25 min cold |

**Disk (measured):** a fully-built `project-governance/target/` is **~12 GB**.
This is normal for a Rust workspace this size (debug info is large — the debug
`backend.pdb` alone is ~575 MB). Budget **15 GB free** for a comfortable dev
setup. `cargo clean` reclaims it all but the next build is cold again.

**Verify:** `cargo check` ends with `Finished \`dev\` profile ... target(s)`.

---

## 4.4 Install and check the frontend

```bash
cd <root>/project-governance/frontend
npm install          # populates node_modules/  (~113 MB, ~1–2 min)
npm run typecheck    # ~10 s — must print nothing and exit 0
npm run test         # vitest unit tests
npm run appfw:check  # scaffold-contract check (node scripts/check-scaffold.mjs)
npm run phi:check    # PHI/PII source lint (node scripts/check-phi-lint.mjs)
```

`npm run test:frontend` runs all of those in sequence.

**Verify:** `npm run typecheck` exits 0 with no errors.

---

## 4.5 Start PostgreSQL

```bash
cd <root>/project-governance
docker compose -f podman-compose.yml up -d postgres
```

This starts one container, `governance-postgres`, from image `postgres:14`, with:

- database `governance`, superuser `postgres` / password `postgres`
- port `5432` published to your machine
- a named volume `postgres-data` so data survives restarts

**Verify:**

```bash
docker ps                       # governance-postgres, status "healthy" after ~15 s
docker exec governance-postgres pg_isready -U postgres   # "accepting connections"
```

The optional monitoring stack (Grafana etc.) is **not** started — it's behind the
`observability` compose profile (`--profile observability`). You don't need it.

---

> ⚠️ **The generated `seed.pg.sql` is invalid Postgres** — the framework's
> `app_gen` emits `ARRAY['admin']` for `jsonb` columns and `product migrate` (or
> a hand `psql -f`) fails on the `workflow_stage_definitions` rows. This is a
> **PDS framework bug** ([chapter 13.2](13-verification-log.md); reported in
> [`docs/architecture/framework-issues-for-pds.md`](../architecture/framework-issues-for-pds.md)),
> not fixed here. **Apply this after every `scripts/appfw product generate`, and
> don't commit the result:**
>
> ```bash
> sed -i "s/ARRAY\[\]::varchar\[\]/'[]'::jsonb/g; s/ARRAY\['admin'\]/'[\"admin\"]'::jsonb/g" \
>     database/_pkg/schemas/governance/seed.pg.sql
> ```

## 4.6 Create the schema and load seed data

The backend does **not** create its own tables. **Option A is enough for local
development** — the only Postgres schema with tables is `governance`
(`database/_pkg/schemas/` contains only `governance/`; the framework's `system`
GraphQL schema is served from the in-memory config metadata, not DB rows). Use
Option B when you want the framework tool to own the process or you're setting up
a managed environment.

### Option A — pipe the generated SQL in (no framework CLI needed)

```bash
cd <root>/project-governance
docker exec -i governance-postgres psql -U postgres -d governance \
  -c "CREATE SCHEMA IF NOT EXISTS governance; CREATE SCHEMA IF NOT EXISTS system;"

docker exec -i governance-postgres psql -U postgres -d governance \
  < database/_pkg/schemas/governance/tables.pg.sql

docker exec -i governance-postgres psql -U postgres -d governance \
  < database/_pkg/schemas/governance/seed.pg.sql
```

`tables.pg.sql` (~3,800 lines) creates every `governance.*` table, its enums, its
`*_audit` companion, indexes, and the audit hash-chain triggers. It is written to
be re-runnable (`ADD COLUMN IF NOT EXISTS`, `CREATE ... IF NOT EXISTS`).
`seed.pg.sql` (~920 lines) inserts the demo users and the workflow definitions.

That's all the running `governance` app needs. (The `CREATE SCHEMA ... system`
above is harmless belt-and-braces; nothing writes tables into it.)

### Option B — the framework migrate command

Runs in the `rust-appfw` Linux container (see 3.7 for the image build). It applies
the DDL + seeds via the framework tool against the `local` (host
`localhost:5432`) or `compose` (host `postgres`) environment from
`database/_pkg/data_sources.yaml`:

```bash
docker run --rm --network host \
  -v <root>:/work -w /work/project-governance \
  -e ENV_NAME=local -e PG_SERVICE_ACCOUNT_NAME=postgres -e PG_SERVICE_ACCOUNT_PASS=postgres \
  rust-appfw:latest ./scripts/appfw product migrate
```

**Verify (either option):**

```bash
docker exec governance-postgres psql -U postgres -d governance -c "\dt governance.*" | head
docker exec governance-postgres psql -U postgres -d governance -c "SELECT username, role FROM governance.users;"
```

You should see ~45 tables (24 entities + `*_audit` companions + junctions) and 7
demo users.

---

## 4.7 Configure the backend environment

`backend/.env` already exists and is git-ignored. Its non-secret values are:

```
ENV_NAME=local
API_HOST=127.0.0.1
API_PORT=8080
LOG_LEVEL=info
APP_LOG_JSON=false
BACKEND_WORKER_STACK_MIB=128
APP_CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
APP_GRAPHQL_INTROSPECTION_ENABLED=true
APP_GRAPHQL_INTROSPECTION_REQUIRED_ROLES=admin
APP_ENABLE_LOCAL_TEST_AUTH=true            # ← lets you log in without real Okta
OKTA_ISSUER=https://example.okta.com/oauth2/default   # placeholder; satisfies the config parser
PG_SERVICE_ACCOUNT_NAME=...                # set to `postgres` for the compose DB
PG_SERVICE_ACCOUNT_PASS=...                # set to `postgres` for the compose DB
```

**Make sure `PG_SERVICE_ACCOUNT_NAME=postgres` and
`PG_SERVICE_ACCOUNT_PASS=postgres`** to match the compose database (the smoke
test README notes the compose image only creates the `postgres` superuser).

`BACKEND_WORKER_STACK_MIB=128` is deliberate — the read path recurses deeply
enough to blow the default 2 MB thread stack (see the comment in
`backend/src/main.rs`). Leave it.

The `GRAPH_*` and `OPENAI_*` lines in `.env` are **real secrets** per
[`docs/architecture/deployment-pds.md`](../architecture/deployment-pds.md). Do
not paste them anywhere, do not commit them, and note `GRAPH_NOTIFICATION_CLIENT_STATE`
is flagged for rotation. If you don't need Graph/AI, you can leave them or blank
them — the code degrades gracefully when Graph/OpenAI are unconfigured.

---

## 4.8 Run the backend

> **Verified 2026-09-09 — see [chapter 13](13-verification-log.md) for the full
> run, corrections, and the defects it found.** Two things this section
> originally got wrong: you must `cd backend` first (config is resolved relative
> to the working directory), and you must set `APP_PRODUCT_UI_ENABLED=true` or
> `/` returns 404.

```bash
cd <root>/project-governance/backend      # NOT the repo root — config/generated is resolved from here
APP_PRODUCT_UI_ENABLED=true cargo run -p backend --bin backend
```

On WSL2 (the recommended Windows path — see 13.7): `set -a && . .env && set +a`
first, then `cargo run -p backend --bin backend`.

On success the log shows tracing init, `"Okta configuration loaded"`, config
load counts (`data_sources`, `schemas`, `entity_types`, `access_policies`), and
the server binding `127.0.0.1:8080`.

**Verify:**

```bash
curl http://127.0.0.1:8080/health/ready
# expect JSON with "status":"pass" and a provider:governance check that passed
curl http://127.0.0.1:8080/health/live
```

If `/health/ready` reports the provider check failed, the DB isn't reachable —
recheck 4.5–4.7 (`PG_SERVICE_ACCOUNT_*`, container running, schema loaded).

Open <http://127.0.0.1:8080/governance> in a browser for the GraphiQL explorer
(introspection is on in local dev).

---

## 4.9 Run the frontend

In a second terminal:

```bash
cd <root>/project-governance/frontend
npm run dev
```

Vite serves on <http://127.0.0.1:5173> and proxies `/governance`, `/system`,
`/admin` to the backend on 8080. Open the URL — you'll land on the sign-in
screen.

---

## 4.10 Log in

### The local path — no password, no real login service

With `ENV_NAME=local` (which you have), the framework's auth layer
(`app-framework/appfw_runtime/src/auth.rs`, `RuntimeJwtExtractor::new`) does this:

- **No `Authorization` header at all → you are an `admin`.** It builds a
  `local-dev` user, tenant `local`, roles `["admin"]`. So the SPA "just works"
  once you're past the sign-in screen — open the local-session dialog in the
  shell (`frontend/src/app/AppShell.tsx`) and submit with an empty / any value,
  or hit the GraphQL endpoint directly with no auth header.

- **To act as a specific user or role**, send a token in this exact shape
  (it is *not* a JWT — it's a plain string the local path parses):

  ```
  Authorization: Bearer appfw-local:user=<name>;tenant=<id>;roles=<r1,r2>[;scopes=<s1,s2>]
  ```

  Examples:
  ```
  Bearer appfw-local:user=pm_user;tenant=180000;roles=project_manager
  Bearer appfw-local:user=epmo_user;tenant=180000;roles=epmo,admin
  ```
  `user`, `tenant`, and `roles` are all **required** in an explicit token;
  unknown keys are rejected. Roles are the lowercase Rego literals
  (`admin`, `epmo`, `project_manager`, `bta`, `finance`, `eac`, `cab`, `pic`,
  `trc`, `security`, `analysis_team`, `viewer`). Paste this whole
  `appfw-local:...` string into the SPA's local-session dialog, or set it as the
  `Authorization` header in GraphiQL / curl.

`APP_ENABLE_LOCAL_TEST_AUTH=true` in `.env` is what lets the same explicit token
work when `ENV_NAME` is `compose` (CI); with `ENV_NAME=local` the empty-header
admin shortcut is already on regardless.

If you also enable the policy bypass (`bypass_policies_in_local` via the
framework `SecurityConfig`), the Rego layer is skipped entirely —
`backend/src/config/app_config.rs` logs a warning each time.

### The demo-user path

There is **no password-login mutation in this app** (the `Login` DTOs in
`backend/src/schemas/common.rs` are unused placeholders). The 7 seeded users
exist so their `users` rows can be referenced (as `manager_id`, `decision_by_id`,
etc.) and for a future real login path. If a later change adds password login,
the seeded rows (`admin@abchealth.com` … `finance@abchealth.com`, intended
password `Demo1234!`) ship with a **placeholder** Argon2 hash you'd replace
`$argon2id$...REPLACE_WITH_REAL_HASH_OF_DEMO1234$REPLACE` in the `users` rows
with a real Argon2id hash of `Demo1234!`:

```bash
# generate a hash (one option: the `argon2` CLI, `cargo install argon2` or apt)
echo -n 'Demo1234!' | argon2 "$(head -c16 /dev/urandom | base64)" -id -t 2 -m 16 -p 1 -e
# then UPDATE governance.users SET hashed_password = '<hash>';
```

The seed comment says this must be done out of band before `product migrate`, or
by a post-seed hook — it is intentionally never a plaintext literal in config.

---

## 4.11 First things to try once you're in

- **Dashboard** — portfolio summary.
- **Intake** (`/intake`) — create a project. This exercises a generated Create
  mutation plus the hand-written `project_number` generation.
- **Projects** → open one → **Workspace** — the gate workspace; this calls the
  hand-written `Project.workspace` custom method which assembles project + gate
  submissions + approvals + recent audit + eligibility in one payload.
- **Team Inbox** — pending approvals routed to your role.
- **Audit** (`/audit`) — the append-only `AuditEvent` trail.
- **GraphiQL** at `/governance` — run `query { getUsers { username role } }`.

---

## 4.12 The live smoke test

`scripts/smoke/smoke_test.py` is an end-to-end check: it creates a comment via
GraphQL, then queries `governance.comments_audit` directly to confirm the
cryptographic audit **hash chain** recorded the insert and update with linked
`prev_hash`/`event_hash`. Run it with the backend up on 8080 and the DB
reachable as role `governance_svc` (or edit it to use `postgres`):

```bash
python scripts/smoke/smoke_test.py
```

---

## 4.13 Storage & time summary

| Thing | Size / time (measured or estimated) |
|-------|------|
| Source checkout (`project-governance`, no `target`/`node_modules`/`.git`) | ~6 MB |
| `app-framework` source | ~96 MB |
| `frontend/node_modules/` | ~113 MB |
| `project-governance/target/` fully built | **~12 GB** |
| Docker images (`postgres:14` + `rust:1` for CLI) | ~1.7 GB |
| Rust toolchain + cargo registry cache | ~1.5–2 GB |
| **Total working footprint** | **~16 GB** |
| Cold `cargo check --workspace` | 8–20 min (est.) |
| Warm `cargo check --workspace` | ~36 s (measured) |
| Cold `cargo build --release -p backend` | 10–25 min (est.) |
| `npm install` | 1–2 min |
| `npm run typecheck` | ~10 s (measured) |
| `npm run build` (SPA) | ~20–60 s (est.) |
| Backend cold start (after build) | 1–3 s |
| DB container first healthy | ~15 s |

---

## 4.14 Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `failed to read ../../app-framework/.../Cargo.toml` | framework checkout missing or not a sibling — see 4.2 |
| `cargo` errors about `appfw-provider-postgres` types | framework SHA doesn't match `appfw.lock`; check out the pinned SHA (3.3) |
| backend exits: `unsafe security configuration` | `SecurityConfig::from_env` rejected the env — usually a prod-only flag set in local, or introspection open without a role. Check `.env`. |
| `/health/ready` provider check fails | DB not running, wrong `PG_SERVICE_ACCOUNT_*`, or schema not loaded (4.5–4.7) |
| backend panics `tokio-rt-worker has overflowed its stack` | `BACKEND_WORKER_STACK_MIB` unset — put it back to `128` |
| mutation fails `column ... is of type jsonb[] but expression is of type text[]` | framework Patch 1 not present — check out framework SHA `6ee6985` or newer with the patch (3.4) |
| can't get past the sign-in screen | there is no password login — submit the local-session dialog with an empty value (you become `admin`) or paste an `appfw-local:user=…;tenant=…;roles=…` string (4.10) |
| GraphQL says "not authorized" with `ENV_NAME=local` | you sent a malformed `appfw-local:` token (missing `user`/`tenant`/`roles`, or an unknown key). Send **no** auth header to get the admin shortcut, or fix the token shape (4.10) |
| a project won't create ("project number is required") | the Intake screen generates `project_number` client-side; if you call `createProject` directly you must supply it — the column has no DB default (see 7.3) |
| `scripts/appfw` "command not found" / bash errors on Windows | run it in the `rust-appfw` container (3.7) |
| CORS errors in the browser console | frontend not on `:5173`, or `APP_CORS_ALLOWED_ORIGINS` doesn't list your origin |
| `npm run phi:check` fails | you committed something that looks like real PII (SSN/email/phone-shaped literal) into `frontend/src/**` — use obvious placeholders |
| `column "assigned_roles" is of type jsonb but expression is of type text[]` during seed | PDS framework bug ([13.2](13-verification-log.md)) — apply the `sed` on `seed.pg.sql` shown in §4.6 |
| gate workspace / eligibility errors; `sort must be a JSON object ... got array` or `pagination limit 500 exceeds maximum page size 250` | product-side, **fixed** on `framework-readopt` ([13.3](13-verification-log.md)); pull latest and rebuild |
| `createProject` → `data store operation failed` / `error serializing parameter N` | PDS framework bug ([13.4](13-verification-log.md)) — send `{}` for `ai_extracted_data` (and any nullable `jsonb` field). The SPA intake form already does |
| GraphQL enum input rejected (`does not contain the value "MEDIUM"`) | use the **PascalCase** wire value (`Medium`, `Draft`) in mutation inputs; `SCREAMING_SNAKE` only in `filter` JSON ([13.5](13-verification-log.md#135-refinement-graphql-enum-casing-is-pascalcase-in-both-directions)) |

---

Next: [`05-data-model.md`](05-data-model.md).
