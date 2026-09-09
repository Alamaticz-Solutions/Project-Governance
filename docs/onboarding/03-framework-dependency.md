# 3. The framework dependency

This is the chapter your team specifically asked for: how this app is built *on
top of* the PDS App Framework, how it depends on it, and how to change that
dependency safely.

---

## 3.1 What "the framework" is

`../app-framework` is a **separate product** — "PDS App Framework", an
enterprise backend-generation system. Its own README describes it as:

> "Application shape lives in `.appfw/model`; `app_gen` validates that source,
> generates a Rust backend, emits database packages, and creates API test
> scaffolding that can be checked into source control."

It is not specific to governance. Any number of applications could be built on
it. It provides:

| Framework crate (folder in `../app-framework/`) | What it is | Does this app use it? |
|---|---|---|
| `appfw_runtime` | The runtime **library**: HTTP server assembly, GraphQL-over-HTTP routing, auth state, security config, the `DataAccess` contracts, model-metadata types, observability, admin runtime. | **Yes** — the backend's core dependency. |
| `appfw_provider_postgres` | The PostgreSQL **provider**: turns the runtime's query plans into SQL and runs them. | **Yes** — the only provider this app compiles. |
| `appfw_test` | Test helpers for Rego policy contracts. | **Yes** — only by the `rego_test` crate. |
| `app_gen` | The **code generator** (+ its `_templates/`). Reads `.appfw/model/`, writes the backend/db/frontend artifacts. | Yes, at generate time — invoked via the CLI, not linked into the backend. |
| `appfw_cli` | The `appfw` command-line tool that `scripts/appfw` wraps. | Yes, at generate/validate time. |
| `appfw_provider_*` (mongo, mssql, snowflake, salesforce, workday, neo4j, icims, anaplan, servicenow, oracle_financials, ai_search) | Providers for other data stores. | **No** — not compiled. The code has `match` arms for them but this product is Postgres-only. |
| `appfw_saas_core`, `appfw_saas_testkit`, `appfw_ui`, `admin_ui`, `appfw_mssql_auth` | SaaS scaffolding, the framework's own UI kit, admin UI assets, MSSQL auth. | Indirectly / not directly. |

---

## 3.2 How the dependency is wired — Cargo path dependencies

Open [`backend/Cargo.toml`](../../backend/Cargo.toml):

```toml
appfw_runtime = { package = "appfw-runtime", path = "../../app-framework/appfw_runtime", default-features = false }
appfw-provider-postgres = { package = "appfw-provider-postgres", path = "../../app-framework/appfw_provider_postgres" }
```

`path = "../../app-framework/..."` is a **path dependency**: Cargo compiles the
framework crate straight from the sibling folder on disk. There is no download,
no registry. This is why:

- The framework checkout **must** be present at `../app-framework` (two levels up
  from `backend/`, i.e. next to `project-governance/`).
- `rego_test/Cargo.toml` similarly path-depends on `../../app-framework/appfw_test`.
- The two `.cargo/config.toml` files declare a ProGet Cargo registry
  (`pds-app-framework-crates`) but **nothing uses it yet** — that's for the
  future "Mode A" (see 3.7).

If the framework folder is missing, `cargo build` fails immediately with "failed
to read `../../app-framework/appfw_runtime/Cargo.toml`".

---

## 3.3 `appfw.lock` — the provenance record

[`appfw.lock`](../../appfw.lock) at the repo root records **which framework and
which generator produced the committed generated code.** It is written by
`scripts/appfw product lock --write`. Current contents, annotated:

```toml
version = 2
framework_version    = "0.1.1"                                   # framework's own release version
framework_git_sha    = "6ee6985b7d357a54fb9eddb456da50654ce87c3d" # EXACT framework commit to build against
framework_git_branch = "main"
generator_package_version = "0.1.1"

# SHA-256 fingerprints — the tooling compares these to detect drift:
config_contract_hash        = "sha256:f08ce15a…"  # the resolved config contract
config_contract_source_hash = "sha256:12f2b7c8…"  # the config-contract source in the framework
template_set_hash           = "sha256:151847d9…"  # app_gen's _templates/
golden_downstream_template_hash = "sha256:b10cd733…"
workflow_cli_hash           = "sha256:4c0d1ada…"
provider_capability_hash    = "sha256:1433f429…"  # what the Postgres provider supports
artifact_manifest_hash      = "sha256:2316cfde…"
generated_ownership_doc_hash= "sha256:6591aa83…"
last_generated_at = "2026-09-08T12:03:03Z"
```

**What each hash is for:** the framework can evolve in ways that would silently
change generated output (a template edit, a new provider capability, a config
schema change). Rather than trusting "it's probably fine", the tooling
fingerprints each input. When you run `scripts/appfw product generate --check`,
it recomputes these and fails loudly if any differ from `appfw.lock` — telling
you the framework moved underneath you and the generated code needs refreshing.

### Verifying your framework checkout matches the lock

```bash
# from project-governance/
grep framework_git_sha appfw.lock
git -C ../app-framework rev-parse HEAD
```

They should match. **As of this writing they differ by exactly one commit:**

- lock SHA: `6ee6985` — *"fix(provider-postgres): bind Option<Vec<Json<Value>>>
  for null JsonArray/ObjectArray"* (a real code fix, "Patch 1" in `PATCHES.md`)
- framework HEAD: `23f4506` — *"docs: add PATCHES.md"* — **documentation only, no
  code change.**

So the framework you have is, for build purposes, identical to what `appfw.lock`
pins. If you want them to match exactly:
`git -C ../app-framework checkout 6ee6985b7d357a54fb9eddb456da50654ce87c3d`
(this detaches HEAD; `git -C ../app-framework checkout main` returns to the
branch). The generated code in this repo was verified to build against this
framework — `cargo check --workspace` passes today.

---

## 3.4 `app-framework/PATCHES.md` — local changes carried ahead of upstream

This framework checkout is described in `PATCHES.md` as *"an internal mirror of
the Pacific Dental Services (PDS) App Framework"*. Any change made locally
(relative to the upstream PDS baseline) must be listed there and eventually
submitted upstream.

- **Baseline:** `e031d7d` ("Seed mirror from PDS App Framework source archive"),
  tag `pinned/archive-893829ad0e30`.
- **Patch 1** (`6ee6985`, tag `pinned/local-patch-1`): a one-line fix in
  `appfw_provider_postgres/src/param.rs` so a `NULL` value for a `jsonb[]`
  column binds as the right Postgres type. Without it, certain mutations on
  entities with JSON-array columns fail at runtime with *"column is of type
  jsonb[] but expression is of type text[]"*. Marked **MUST UPSTREAM TO PDS**
  before the next framework upgrade.

**Implication:** you cannot simply `git pull` the framework to a newer upstream
version and expect it to work — Patch 1 (and any future patches) must be carried
forward or confirmed merged upstream first.

**More framework bugs, reported to PDS (not patched by us).** A local end-to-end
run on 2026-09-09 ([chapter 13](13-verification-log.md)) found two further
framework defects — **Finding P** (null scalar `jsonb` binding, sibling of
Patch 1) and **Finding Q** (the seed SQL generator emits `ARRAY[…]` for `jsonb`
columns). This team does **not** patch the framework; both are written up for the
PDS framework team in
[`docs/architecture/framework-issues-for-pds.md`](../architecture/framework-issues-for-pds.md)
with repro, root cause, and a proposed fix, and are carried as documented
workarounds until PDS ships a release.

---

## 3.5 What `app_gen` generates (the complete list)

Running `scripts/appfw product generate` writes these back into
`project-governance/`:

| Output | Purpose |
|---|---|
| `backend/src/routes/{mod,governance,system}.rs` | HTTP route assembly, GraphQL schema build, provider registry |
| `backend/src/schemas/{governance,system}.rs` | Rust structs for every entity: `<Entity>Projection` (read shape), `Input<Entity>` (write shape), `<Entity>QueryResult` (paginated list), plus every enum |
| `backend/src/handlers/**/generated.rs` | The default CRUD implementations: `find_impl`, `get_impl`, `query_impl`, `create_impl`, `update_impl`, `delete_impl`, `aggregate` per entity |
| `backend/src/handlers/**/mod.rs`, `handlers/selections.rs` | GraphQL `Query`/`Mutation` object wiring; the selection-set parser |
| `backend/src/handlers/governance/<entity>.rs` | Created **once** per entity that has custom methods — with empty `<name>_impl` stubs your team then fills. Re-running the generator does **not** overwrite an existing one. |
| `backend/src/operations/generated.rs` | Custom-method operation dispatch table |
| `backend/config/generated/**` | Runtime config the backend reads at startup: `data_sources.yaml`, per-schema `schema.yaml` + `entity_types.yaml` + wrapped `*.rego` policies, `sync_workers.yaml` |
| `database/_pkg/**` | `tables.pg.sql` (+ `.mssql`, `.snowflake`, `.mongo` dialects), `seed.pg.sql`, migrations, `data_sources.yaml`, `schema.yaml` |
| `frontend/src/generated/{appfw-ui-contract.ts,appfw-entity-workspace.tsx}` | The typed "contract" the SPA imports: entity list, field metadata, route segments |
| `podman-compose.yml` | The local dev container stack |
| `appfw.lock` | Provenance hashes (3.3) |
| `.appfw/target/appfw/*.json` | Diagnostic artifacts (see 3.6) |
| `backend/product_dist/` (via a separate `npm run build`) | not from `app_gen` — the built SPA |

---

## 3.6 `.appfw/target/appfw/` — the generation diagnostics

These JSON files are written by the generator and the check commands. They are
**outputs, not inputs** — safe to delete, regenerated each run. Useful for
debugging "why did generation do X":

| File | Contents |
|---|---|
| `validation.json` | model validation results |
| `generator_ir.json` | the intermediate representation `app_gen` built from the model before templating |
| `normalized_config.json` | the model after defaults/fragments/facets are expanded |
| `artifacts.json` / `artifact_provenance.json` | every file written, with input hashes (`config_sha256`, `templates_sha256`, `generator_source_sha256`) |
| `boundary_check.json` | the hand-written / generated ownership audit |
| `config_contract.json` / `.md` | the resolved config contract (also see `.appfw/model/_specs/CONFIG_CONTRACT.md`) |
| `app_topology.json` | the resolved topology (data sources, schemas, ingress) |
| `harness-check.json` | API-test-harness conformance |
| `performance_recommendations.json` / `.md` | generator's perf hints (indexes, prepared statements) |
| `dev_infra.json`, `sync_descriptors.json`, `sync_worker_plan.json` | dev-infra + (disabled) sync-worker planning |

`.appfw/target/` and `database/target/` and `frontend/target/` are all
generator/tool scratch — not the Rust `target/`.

---

## 3.7 Running the generator (and why Windows needs a container)

`scripts/appfw` is a **bash** script. It:

1. finds the framework root (`APPFW_FRAMEWORK_ROOT`, or `.appfw/local.env`, or
   `../app-framework`),
2. requires `../app-framework/Cargo.lock` to exist (run `cargo generate-lockfile`
   in the framework once if missing),
3. runs `cargo run --locked --manifest-path ../app-framework/Cargo.toml -p
   appfw-cli -- --app-root <here> --framework-root <framework> <your args>`.

On **Linux/macOS** you can run it directly. On **Windows** the bash wrapper +
`rsync` dependency mean you run it inside a Linux container:

```bash
docker run --rm \
  -v C:/Users/ManojRajakumar/Governance-Restructure:/work \
  -w /work/project-governance \
  rust-appfw:latest ./scripts/appfw product validate --json
```

where `rust-appfw:latest` is `rust:1` plus `rustfmt` and `rsync`. Build it once —
save this as `rust-appfw.Dockerfile` anywhere:

```dockerfile
FROM rust:1
RUN rustup component add rustfmt \
 && apt-get update \
 && apt-get install -y --no-install-recommends rsync \
 && rm -rf /var/lib/apt/lists/*
```

```bash
docker build -f rust-appfw.Dockerfile -t rust-appfw:latest .
```

The `-v` in the `docker run` above mounts the **parent** directory so both repos
are visible inside the container. The container also needs to reach the database
on the host — add `--network host` (Linux) or use `host.docker.internal` as the
DB host, and pass `-e ENV_NAME=local -e PG_SERVICE_ACCOUNT_NAME=postgres -e
PG_SERVICE_ACCOUNT_PASS=postgres` for `product migrate`.

Common subcommands:

| Command | What it does |
|---|---|
| `scripts/appfw product validate --json` | validate the model |
| `scripts/appfw product generate` | (re)write all generated artifacts |
| `scripts/appfw product generate --check --json` | regenerate to a temp area and fail if it differs from what's committed (drift check) |
| `scripts/appfw product boundary-check --json` | fail if hand-written code leaked into generated files or vice versa |
| `scripts/appfw product policy-test --json` | run the Rego policy contract tests |
| `scripts/appfw product test --fast` | the fast verification path |
| `scripts/appfw product lock --write` | refresh `appfw.lock` |

`.appfw/agent-profile.yaml` lists the exact subset of these that automated agents
are allowed to run.

---

## 3.8 How to update the framework version safely

You will need this when PDS ships a new framework release, or when you need a fix
that's only in a newer framework commit.

1. **Read `app-framework/CHANGELOG.md`** and
   `app-framework/docs/release/versioning-and-compatibility.md` for breaking
   changes between your `framework_version` (`0.1.1`) and the target.
2. **Confirm the local patches are handled.** Check `app-framework/PATCHES.md`.
   If Patch 1 is now merged upstream, good. If not, you must re-apply it on top
   of the new framework commit (cherry-pick `6ee6985`).
3. **Move the framework checkout:** `git -C ../app-framework fetch && git -C
   ../app-framework checkout <new-sha>` (re-applying patches as needed).
4. **Regenerate:** `scripts/appfw product generate` (in the container on
   Windows). This rewrites the generated code and `appfw.lock`.
5. **Review the diff.** `git diff` — expect changes in `backend/src/routes/`,
   `backend/src/schemas/`, `backend/src/handlers/**/generated.rs`,
   `backend/config/generated/**`, `database/_pkg/**`, `frontend/src/generated/`.
   Your hand-written files should **not** change.
6. **Build and test:**
   ```bash
   cargo check --workspace --all-targets
   cargo test --workspace
   cd frontend && npm run typecheck && npm run test && npm run build
   scripts/appfw product generate --check --json   # must pass
   scripts/appfw product boundary-check --json       # must pass
   ```
7. **If a generated-code change breaks a hand-written `_impl`** (e.g. a
   projection field was renamed), fix the `_impl` / service to match. This is the
   normal cost of a framework bump.
8. Commit the framework checkout move note, the regenerated files, and the new
   `appfw.lock` together.

### The future: "Mode A" (ProGet registry instead of a path dep)

[`docs/architecture/deployment-pds.md`](../architecture/deployment-pds.md)
describes the target state for PDS CI: the framework crates published to the
`proget.pdsconnect.com` Cargo registry (feed `pds-app-framework-crates`, already
declared in `.cargo/config.toml`), so `backend/Cargo.toml` points at
`registry = "pds-app-framework-crates"` at the pinned `framework_version` instead
of a sibling path. That makes container builds hermetic (no sibling checkout
needed). It requires the framework to actually be published to ProGet first —
which, per that doc, has not happened yet.

---

Next: [`04-getting-started.md`](04-getting-started.md).
