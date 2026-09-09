# Project Governance — Local Setup & Run Guide

**Audience:** co-developers and the client team who need to check out the code,
build it, migrate the database, and run the full application locally.

**Branch this guide targets:** `develop` — the team integration branch
(`framework-readopt` is its frozen baseline). The backend consumes the
**PDS App Framework** as a sibling checkout — see §2.

**Verified on:** Windows 11 + WSL2 Ubuntu 26.04, 2026-09-09.
Backend framework pinned at `app-framework@6ee6985b7d357a54fb9eddb456da50654ce87c3d`
(the value of `framework_git_sha` in [`appfw.lock`](../appfw.lock)).

---

## 0. TL;DR — the command sequence

Once the prerequisites (§1–§4) are in place:

```bash
# 1. database
docker compose -f podman-compose.yml up -d postgres     # or a local postgres, see §5

# 2. migrate  (creates the schema, 42 tables, seed data)
set -a && . backend/.env && set +a
bash scripts/appfw product migrate

# 3. backend  (http://localhost:8090 — GraphQL at /governance, SPA at /)
cd backend && set -a && . .env && set +a && cargo run -p backend --bin backend

# 4. frontend bundle  (one-time, or after any UI change) — in a second terminal
cd frontend && npm install && npm run build
```

Then open **http://localhost:8090**.

> The file you actually "run" is the **backend binary** (`cargo run -p backend`).
> The frontend is not a running process in this setup — `npm run build` compiles
> it into `backend/product_dist/`, which the backend serves at `/`.

---

## 1. Why WSL2 (Windows users)

The backend is Rust and the framework tooling (`scripts/appfw`) is a Bash script.
On native Windows you would need the multi-GB Visual Studio C++ Build Tools **and**
a Linux container just to run `scripts/appfw`. **WSL2 Ubuntu avoids both** — the
Linux linker is a ~200 MB `apt` install and `scripts/appfw` runs natively.

Linux/macOS users: skip to §3, everything else is the same.

### Install WSL2 + Ubuntu

In an **Administrator PowerShell**:

```powershell
wsl --install -d Ubuntu
```

Reboot if prompted. Launch **Ubuntu** from the Start menu once and create your
UNIX username + password when asked.

> Optional but recommended: enable **Docker Desktop → Settings → Resources → WSL
> Integration → Ubuntu** so `docker` works inside Ubuntu (used for Postgres in §5).

---

## 2. Repository layout — the sibling checkout

`backend/Cargo.toml` depends on the framework by **relative path**
(`../../app-framework/...`). Both repos must sit **side by side** in the same
parent folder:

```
~/projects/
├── app-framework/          # Alamaticz-Solutions/app-framework  (pinned commit)
└── project-governance/     # this repository  (branch: develop)
```

> **Do not** put `app-framework` inside `project-governance`. It must be a sibling.
> **Do not** work out of a OneDrive / Dropbox folder — the Rust `target/` directory
> is many GB of constantly-rewritten files and cloud sync will corrupt builds.
> Use a plain path like `~/projects` (inside the WSL filesystem, **not** `/mnt/c/...`).

### Clone both repos

```bash
mkdir -p ~/projects && cd ~/projects

git clone https://github.com/Alamaticz-Solutions/app-framework.git
git clone https://github.com/Alamaticz-Solutions/Project-Governance.git project-governance

# pin the framework to the commit recorded in appfw.lock
cd ~/projects/app-framework
git checkout 6ee6985b7d357a54fb9eddb456da50654ce87c3d

# product on the integration branch
cd ~/projects/project-governance
git checkout develop
```

> **Git credentials in WSL:** to reuse the sign-in from Windows, run once:
> ```bash
> git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"
> ```

### Make the framework CLI wrapper executable

Both `scripts/appfw` files are committed without the execute bit. Either run them
as `bash scripts/appfw ...` (used throughout this guide) or:

```bash
chmod +x ~/projects/project-governance/scripts/appfw ~/projects/app-framework/scripts/appfw
```

---

## 3. Toolchain

Inside Ubuntu:

```bash
sudo apt update
sudo apt install -y build-essential pkg-config libssl-dev git curl ca-certificates postgresql-client

# Rust (stable) — verified with 1.98.1
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"

# Node 20 — verified with 20.20.2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
rustc --version   # 1.98.x
node --version    # v20.x
```

### Compile check (optional but recommended)

```bash
cd ~/projects/project-governance/backend
cargo check --workspace --all-targets
```

First run compiles the whole framework (~10 min). It must finish clean before
continuing.

---

## 4. Backend environment file

Create **`backend/.env`** (git-ignored — never commit it):

```ini
ENV_NAME=local
API_HOST=127.0.0.1
API_PORT=8090

# PostgreSQL service account (matches the compose Postgres below)
PG_SERVICE_ACCOUNT_NAME=postgres
PG_SERVICE_ACCOUNT_PASS=postgres
PG_SERVICE_ACCOUNT_PASSWORD=postgres

# Okta is not contacted in local mode, but the config loader requires these to be set
OKTA_ISSUER=https://dummy.local/oauth2/default
OKTA_AUDIENCE=api://dummy
OKTA_CLIENT_ID=dummy-client-id

# ENV_NAME=local + this flag => the backend auto-authenticates every request
# (no real token needed). NEVER set this outside local/compose.
APP_ENABLE_LOCAL_TEST_AUTH=true

# serve the built SPA at /
APP_PRODUCT_UI_ENABLED=true

RUST_LOG=backend=info,tower_http=info
```

> `API_PORT=8090` is used here because `8080` was already taken on the test
> machine. If `8080` is free for you, you can use it (the frontend dev-proxy and
> the smoke test both default to `8080`).

---

## 5. PostgreSQL

The backend's `local` environment (in
`backend/config/generated/data_sources.yaml`) expects **`localhost:5432`, database
`governance`, user/password `postgres`/`postgres`, TLS disabled**.

### Option A — Docker (matches the repo, recommended)

```bash
docker compose -f podman-compose.yml up -d postgres
```

This starts `postgres:14` on `5432` with database `governance` already created.

### Option B — PostgreSQL installed in WSL

```bash
sudo apt install -y postgresql
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres createdb governance
```

### If port 5432 is already in use

Another Postgres (Windows service, another project's container, …) may hold
`5432`. Either stop it, or point this project at a different port by editing the
`local` block of `backend/config/generated/data_sources.yaml`:

```yaml
  - name: local
    db_host: localhost
    db_port: "5433"      # whatever your Postgres actually listens on
```

(That file is generated; a local edit for dev is fine — just don't commit it.)

---

## 6. Database migration

**The application does NOT create its own tables.** `cargo run` only connects to
an already-migrated database. Schema creation is a separate framework step:

```bash
cd ~/projects/project-governance
set -a && . backend/.env && set +a      # migrate reads ENV_NAME + PG_SERVICE_ACCOUNT_*
bash scripts/appfw product migrate
```

(First run compiles the framework CLI — a few minutes.) This:
1. ensures the `governance` database exists,
2. creates the `governance` schema,
3. executes `database/_pkg/schemas/governance/tables.pg.sql` → **42 tables**,
4. executes `database/_pkg/schemas/governance/seed.pg.sql` → **7 users + 19 workflow-stage definitions**.

### ⚠ Known issue — seed patch required

The generator currently emits PostgreSQL `ARRAY[...]` literals for two **`jsonb`**
columns (`workflow_stage_definitions.assigned_roles` and `.checklist_template`),
which Postgres rejects on insert:

```
ERROR: column "assigned_roles" is of type jsonb but expression is of type text[]
```

Until the framework's `pg_seed_literal` is fixed, patch the generated seed file
locally (do **not** commit — it will be overwritten by the next `product generate`):

```bash
cd ~/projects/project-governance
sed -i "s/ARRAY\[\]::varchar\[\]/'[]'::jsonb/g; s/ARRAY\['admin'\]/'[\"admin\"]'::jsonb/g" \
  database/_pkg/schemas/governance/seed.pg.sql
```

Then re-run the seed:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 5432 -U postgres -d governance \
  -v ON_ERROR_STOP=1 -f database/_pkg/schemas/governance/seed.pg.sql
```

### Verify the database

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 5432 -U postgres -d governance -c \
  "select (select count(*) from governance.users) as users,
          (select count(*) from governance.workflow_stage_definitions) as stages;"
```

Expected: `users = 7`, `stages = 19`.

---

## 7. Build the frontend

```bash
cd ~/projects/project-governance/frontend
npm install
npm run build
```

Output goes to **`backend/product_dist/`** (`index.html` + `assets/`), which the
backend serves at `/`. Re-run `npm run build` after any change under
`frontend/src/`.

---

## 8. Run the application

```bash
cd ~/projects/project-governance/backend
set -a && . .env && set +a
cargo run -p backend --bin backend
```

Healthy startup log ends with lines like:

```
loaded backend configuration data_sources=1 schemas=2 entity_types=65 access_policies=43
Okta configuration loaded auth_configured=true
PostgreSQL connection pool configured host=localhost database=governance
```

Endpoints:

| URL | What |
|---|---|
| `http://localhost:8090/` | Frontend SPA |
| `http://localhost:8090/governance` | Product GraphQL API |
| `http://localhost:8090/system` | Framework metadata GraphQL |

### Sign in

The SPA opens a **local session** form. In `ENV_NAME=local` the backend ignores
the token, so:

- **Bearer token:** any non-empty string (e.g. `local-dev-token`)
- **User name (email):** `admin@abchealth.com`
- **Primary role:** `Administrator`

Seeded users (all `@abchealth.com`, password not used in local mode):
`admin`, `pm`, `bta`, `epmo`, `eac`, `pic`, `finance`.

### Quick API check (no browser)

```bash
curl -s -X POST http://localhost:8090/governance \
  -H 'content-type: application/json' \
  -d '{"query":"{ queryUsers(limit:10){ items { email role full_name } } }"}'
```

Should return the 7 seeded users.

---

## 9. Regenerating after a model change

Only when you edit `.appfw/model/**`:

```bash
bash scripts/appfw product validate --json
bash scripts/appfw product generate
bash scripts/appfw product generate --check --json
cargo check --workspace --all-targets && cargo test --workspace
```

Then re-apply the §6 seed patch and re-migrate.

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `error: linker 'link.exe' not found` | You're building on native Windows. Use WSL2 (§1). |
| `failed to run scripts/appfw compatibility wrapper: Permission denied` | `chmod +x` **both** `scripts/appfw` files, or call `bash scripts/appfw …` (§2). |
| `Could not find app-framework; set APPFW_FRAMEWORK_ROOT` | The two repos aren't siblings, or the folder isn't named exactly `app-framework` (§2). |
| `failed to bind listener at 127.0.0.1:8080: Address already in use` | Another process holds the port. Change `API_PORT` in `backend/.env`. |
| `schema "governance" does not exist` when applying SQL by hand | Run `scripts/appfw product migrate` instead — it creates the schema first (§6). |
| `column "assigned_roles" is of type jsonb but expression is of type text[]` | Apply the seed patch in §6. |
| `MissingConfiguredEnvironment` / `MissingEnvVar` at startup | `backend/.env` isn't sourced, or a key from §4 is missing. Run `set -a && . .env && set +a` first. |
| SPA loads but every screen shows an error state | Backend not reachable, or DB not migrated. Check the backend log and §6. |
| First `cargo` build is extremely slow | Expected — it compiles the entire framework once (~10 min). Subsequent builds are incremental. |

---

## 11. What is committed vs. local-only

| Item | Status |
|---|---|
| `backend/.env` | **Local only** — git-ignored, create per §4 |
| `database/_pkg/schemas/governance/seed.pg.sql` patch | **Local only** — do not commit (§6) |
| `backend/config/generated/data_sources.yaml` port edit (if used) | **Local only** — do not commit (§5) |
| `backend/product_dist/` | Build output — not committed |
| `~/projects/app-framework` checkout | Separate repo, pinned commit — not part of this repo |
