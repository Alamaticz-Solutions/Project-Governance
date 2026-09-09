# 1. Core concepts

Everything in this chapter is background you need before the rest of the guide
makes sense. If you already know a section, skip it. Nothing here is specific to
our code yet — chapter 2 onward is.

---

## 1.1 Git, commits, branches, and "SHA"

**Git** is the version-control system that stores the history of the code. A
project tracked by Git is a **repository** (repo). This guide involves two repos:
`project-governance` (this one) and `app-framework` (the framework).

- A **commit** is one saved snapshot of the whole repo plus a message describing
  the change. History is a chain of commits.
- Every commit has a unique ID that looks like
  `dba6845087a498c43fc40560016a2cc8b5971b0d`. That 40-character hexadecimal
  string is a **SHA-1 hash** (usually just called "the SHA" or "the commit
  hash"). It is computed from the commit's contents, so it is effectively a
  fingerprint: if even one byte of the snapshot differs, the SHA is completely
  different. You often see it shortened to the first 7–12 characters
  (`dba6845`).
- **"Pinning" to a SHA** means "use exactly this commit, not whatever is newest."
  Our repo pins the framework to a specific SHA (see chapter 3) so that everyone
  builds against the identical framework code.
- A **branch** is a moving label pointing at a commit; as you add commits, the
  branch label moves forward. This repo's current branch is
  `framework-readopt`. The framework's is `main`.
- A **hash** in general is any function that turns arbitrary input into a
  fixed-size string that changes completely if the input changes. Git uses
  SHA-1. The framework lock file (chapter 3) also uses **SHA-256** hashes
  (64 hex characters, written `sha256:...`) to fingerprint configuration and
  templates. Same idea, different algorithm, longer output.

**Why you keep seeing hashes in this project:** the framework and the product are
two separate codebases that must stay compatible. Hashes are how the tooling
proves "the model you have, the generator you have, and the code that was
generated all match" without a human checking file by file.

---

## 1.2 How to *read* Rust (you will not have to write it)

The backend is written in **Rust**. You do not need to learn Rust to understand
this app, but you need to be able to read a function signature and follow the
flow. Here is the minimum.

### Files, modules, and `mod.rs`

Rust code is organised into **modules**. A folder is a module; a file is a
module. Nearly every folder has a file called `mod.rs` — that file is the
folder's "front door." It usually just lists the other files in the folder
(`pub mod project;` means "there is a file `project.rs` in this folder, and it's
public") and sometimes contains shared code.

```rust
// backend/src/services/mod.rs
pub mod approval_state_machine;   // -> services/approval_state_machine.rs
pub mod audit;                    // -> services/audit.rs
```

`pub` means "visible to other modules." Without `pub`, a thing is private to its
own module.

### A function signature, decoded

```rust
pub async fn decide(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    gate_id: String,
    payload: JsonValue,
) -> HandlerResult<JsonValue> {
```

- `pub` — callable from other modules.
- `async` — this function does I/O (database, network) and must be "awaited"
  (see below). Async functions don't run until awaited.
- `fn decide` — the function is named `decide`.
- `data_access: &Arc<DataAccess>` — a parameter named `data_access`, whose type
  is `&Arc<DataAccess>`. Read types right-to-left: a `DataAccess` object, wrapped
  in an `Arc` (a shared, reference-counted pointer — lets many parts of the
  program hold the same object safely), borrowed by reference (`&`, meaning "I'm
  lent this, I don't own it").
- `user: &Option<UserAuth>` — `Option<T>` means "either a `T` or nothing."
  `Option<UserAuth>` is "either an authenticated user, or `None` (anonymous)."
- `gate_id: String` — an owned, growable text string.
- `payload: JsonValue` — an arbitrary JSON value (`serde_json::Value`), used when
  the shape isn't known at compile time.
- `-> HandlerResult<JsonValue>` — the return type. `Result<T, E>` means "either
  success carrying a `T`, or failure carrying an error `E`." `HandlerResult<T>`
  is this project's alias for `Result<T, anyhow::Error>`. So this function
  returns "either a JSON value, or an error."

### `?`, `.await`, `Ok(...)`, `Err(...)`

- `.await` — "run this async operation and wait for its result before
  continuing." You'll see it after every database call.
- `?` — the "try" operator. `let x = something()?;` means "if `something()`
  returned an error, stop this function now and return that error; otherwise
  unwrap the success value into `x`." It's the reason Rust error handling looks
  clean despite every step being fallible.
- `Ok(value)` / `Err(error)` — the two halves of a `Result`. Functions return
  `Ok(...)` on success and `Err(...)` on failure. `anyhow::anyhow!("message")`
  builds an ad-hoc error.
- `Some(value)` / `None` — the two halves of an `Option`.

### `self`, `&self`, traits, `impl`

- A **trait** is like an interface: a named set of methods a type promises to
  provide. `trait SecretProvider { fn get_secret(&self, name: &str) -> ...; }`
  says "anything that is a `SecretProvider` can be asked for a secret by name."
- `impl SomeTrait for SomeType { ... }` — "here is how `SomeType` fulfils
  `SomeTrait`."
- `impl SomeType { ... }` — "here are `SomeType`'s own methods."
- `&self` in a method means "called on an existing instance, borrowed." `self`
  (no `&`) consumes the instance.
- Traits are how the framework stays swappable: `DatabaseClient` is a trait, and
  `PostgresClient` is one implementation. The code talks to "a `DatabaseClient`"
  and doesn't care that it's Postgres.

### Attributes and macros

- Lines starting with `#[...]` are **attributes** — compiler or library
  instructions attached to the next item. `#[derive(Clone)]` auto-generates a
  "make a copy" method. `#[tracing::instrument(...)]` wraps a function in a log
  span. `#[allow(dead_code)]` silences the "this is unused" warning.
- `#[cfg(feature = "http")]` means "only compile this when the `http` feature is
  turned on" (see 1.9 on Cargo features).
- Names ending in `!` are **macros**: `json!({...})` builds a JSON value,
  `println!(...)` prints, `vec![...]` builds a list. Treat them as helpers.

### `//!` vs `//`

- `//` is a normal comment.
- `//!` at the top of a file is a **module doc comment** — documentation for the
  whole file. This codebase has excellent `//!` headers; reading the first 20
  lines of any `.rs` file usually tells you what it's for. This guide quotes many
  of them.

---

## 1.3 Cargo, crates, the workspace, `Cargo.lock`

- **Cargo** is Rust's build tool and package manager (like `npm` for Node or
  `pip` for Python).
- A **crate** is a Rust package. `backend`, `api_tests`, and `rego_test` are
  crates in this repo. `appfw-runtime` and `appfw-provider-postgres` are crates
  in the framework.
- `Cargo.toml` is a crate's manifest: its name, version, and dependencies.
- A **workspace** is a set of crates built together. The root
  [`Cargo.toml`](../../Cargo.toml) declares the workspace members:
  `api_tests`, `backend`, `rego_test`.
- `Cargo.lock` records the *exact* version of every dependency (direct and
  indirect) that was resolved, so the build is reproducible. You don't edit it.
- `cargo build` compiles. `cargo check` type-checks without producing a runnable
  binary (faster — used to catch errors). `cargo test` runs tests. `cargo run -p
  backend` builds and runs the `backend` crate.
- Compiled output goes in `target/`. It is large (see chapter 12) and is never
  committed.

---

## 1.4 What a "backend", an "API", and "GraphQL" are

- The **frontend** is what runs in the browser: HTML, CSS, and JavaScript. It
  draws the screens.
- The **backend** is a program running on a server. It holds the business rules
  and talks to the database. The browser cannot touch the database directly; it
  asks the backend.
- An **API** (Application Programming Interface) is the backend's set of
  request/response endpoints that the frontend calls over HTTP.
- **GraphQL** is a particular *style* of API. Instead of many fixed URLs
  (`/projects`, `/projects/5`, `/projects/5/approvals`), there is **one URL**
  (here, `/governance`) and the caller sends a **query** describing exactly the
  data and shape it wants:

  ```graphql
  query {
    findProject(id: "abc") {
      projectName
      status
      approvals { assignedRole status }
    }
  }
  ```

  The server returns JSON in that exact shape. GraphQL has:
  - **Queries** — read data (no side effects).
  - **Mutations** — change data (create/update/delete, or a custom action like
    `submitDecision`).
  - **Schema** — a strongly-typed description of every type, field, query, and
    mutation available. Our schema is generated from the model.
  - **Introspection** — the ability to ask the server "what's in your schema?".
    Tools like GraphiQL use it. It's enabled in local dev, restricted in prod.

The library we use on the Rust side is `async-graphql`.

---

## 1.5 PostgreSQL, tables, schemas, migrations

- **PostgreSQL** ("Postgres") is the relational database. Data lives in
  **tables** (rows and columns). Our app uses one Postgres database named
  `governance`.
- A Postgres **schema** is a namespace *inside* a database — a folder for tables.
  This app uses two: `governance` (our 24 business tables) and `system` (the
  framework's own metadata tables). Don't confuse this "schema" with the GraphQL
  schema or the `.appfw` model schema — same word, three meanings. This guide
  says "Postgres schema" when it matters.
- **DDL** (Data Definition Language) is SQL that creates/alters tables (`CREATE
  TABLE ...`). The generator emits our DDL into
  `database/_pkg/schemas/governance/tables.pg.sql`.
- A **migration** is a versioned change to the database structure, applied in
  order, so an existing database can be brought up to date without being rebuilt.
- **Seed data** is initial rows inserted after the tables are created — here, one
  demo user per role and the workflow definitions.
- A **foreign key** (FK) is a column in one table holding the primary key of a
  row in another table — that's how rows link (a `Project.manager_id` holds a
  `User.id`).
- **Connection pool**: opening a database connection is slow, so the backend
  keeps a pool of open connections (via `deadpool-postgres`) and borrows one per
  request.

---

## 1.6 "Schema-driven code generation" — the central idea

This is the concept that makes this repo different from a normal app.

In a normal app, a developer writes the database tables, then writes the API code
to read/write them, then writes the access checks, then writes the frontend
types — all by hand, and keeps them in sync manually.

Here, there is a single **model** (`.appfw/model/`) written in **YAML** (a
human-friendly text format for structured data). It describes:

- the entities (tables) and their fields and types,
- the enums (fixed sets of allowed values),
- the relationships between entities,
- which entities are audited, which have optimistic locking, etc.

A program in the framework called **`app_gen`** (the "generator") reads that
model and *writes*:

- the PostgreSQL DDL (`CREATE TABLE ...`),
- the GraphQL schema types (`ProjectProjection`, `InputProject`, ...),
- the API route wiring and handler scaffolds (`backend/src/routes/`,
  `backend/src/handlers/**/generated.rs`),
- the frontend "contract" (`frontend/src/generated/`),
- starter access-policy files.

**Generated files say so at the top** (`// Generated by app_gen.`) and are marked
"do not hand-edit" in the repo README. If you change the model and re-run the
generator, they are overwritten.

**What is *not* generated:** the genuinely custom logic. The workflow engine, the
Microsoft Graph client, the AI extraction, the platform wiring — all hand-written
under `backend/src/services/`, `backend/src/platform/`, and the `_impl` function
bodies in `backend/src/handlers/governance/<entity>.rs`.

**The generator produces a stub, you fill it in.** When the model declares a
*custom method* on an entity (e.g. `Project.submit_decision`), the generator
writes an empty `submit_decision_impl(...)` function once, into the
hand-owned file `backend/src/handlers/governance/project.rs`. Your team then
writes its body — usually a one-line call into `backend/src/services/`.

This split is enforced by a tool: `scripts/appfw product boundary-check` fails if
hand-written changes leak into files that should be generated, or vice versa.

---

## 1.7 RBAC and Rego (access control)

- **RBAC** = Role-Based Access Control. Users have **roles** (`admin`, `epmo`,
  `project_manager`, `finance`, ...). What you're allowed to do depends on your
  role (and sometimes on whether you *own* the specific row).
- **Rego** is a small policy language from the Open Policy Agent project. Each
  business table has one Rego file (e.g.
  `.appfw/model/schemas/governance/rbac/project.rego`) that answers a single
  question: *given this user, this action (create/read/update/delete), and this
  entity, is it allowed — and if it's a read, what row filter should be applied?*
- A Rego rule here returns something like
  `{"allow": true, "filter": {"manager_id": {"_eq": input.user.id}}}` — meaning
  "allowed, but only rows where `manager_id` equals the current user's id."
- The Rust engine that evaluates Rego at runtime is **`regorus`**. The backend
  loads every `.rego` file at startup, and every single GraphQL read/write runs
  through the matching policy before the database is touched
  (`backend/src/config/app_config.rs` → `evaluate_user_access`).
- **Some ownership rules can't be expressed as a one-row filter** (e.g. "only the
  reviewer assigned to *this gate's parent stage* may decide it"). Those are
  enforced in Rust, in the service layer. Chapter 6 covers this split.
- `.rego` files under `.appfw/model/` are hand-written "bodies only"; the
  generator wraps them with boilerplate and copies the result to
  `backend/config/generated/schemas/governance/`.

---

## 1.8 Authentication: JWT, Okta, and the local dev shortcut

- **Authentication** = "who are you?" (vs. authorization = "what may you do?",
  which is 1.7).
- A **JWT** (JSON Web Token, pronounced "jot") is a signed string the browser
  sends on every request in the `Authorization: Bearer <token>` header. It
  carries **claims** — facts about the user (username, roles, tenant, expiry).
  Because it's cryptographically signed, the backend can trust the claims without
  a database lookup.
- **Okta** is an identity provider (a login service). The framework expects Okta
  / OIDC in managed environments. The `.env` has `OKTA_ISSUER`, `OKTA_AUDIENCE`,
  `OKTA_CLIENT_ID`.
- **Local dev shortcut:** setting `APP_ENABLE_LOCAL_TEST_AUTH=true` lets you run
  without a real Okta — the framework accepts a locally-minted test token, and
  the frontend's "local session" dialog lets you paste one. There is also a
  policy-bypass switch for local work (`SecurityConfig::bypass_policies_in_local`)
  — see `app_config.rs`.
- **Open decision:** the legacy app used a simpler hand-signed token (HS256 JWT);
  whether to keep that or move fully to Okta for managed environments is an
  unresolved decision (see [`docs/architecture/open-decisions.md`](../architecture/open-decisions.md)
  and [`docs/architecture/deployment-pds.md`](../architecture/deployment-pds.md)).

---

## 1.9 Cargo "features"

A Cargo **feature** is a compile-time on/off switch. `backend/Cargo.toml`
defines:

- `http` — compile the web server (Axum, hyper, GraphQL-over-HTTP). On by
  default.
- `provider-postgres` — compile and register the Postgres database client.
  **On by default and required** — without it the backend can't reach its own
  database.
- `mcp`, `kafka`, `sync` — deliberately **off**. This product is a single HTTP
  process against one database with no background workers. Code guarded by
  `#[cfg(feature = "mcp")]` etc. is not compiled.

---

## 1.10 Docker and containers

- A **container** is an isolated, pre-packaged Linux environment that runs the
  same everywhere. **Docker** (or Podman) runs containers.
- An **image** is the built template; a **container** is a running instance of an
  image.
- We use containers for two things:
  1. **The database.** `podman-compose.yml` defines a `postgres:14` container so
     you don't have to install Postgres on your machine.
  2. **The framework CLI on Windows.** `scripts/appfw` is a bash script that
     needs a Linux environment and the framework checkout. On Windows you run it
     inside a `rust:1` container (README calls the image `rust-appfw:latest`).
- **`docker compose`** (or `podman-compose`) reads a YAML file describing several
  containers and starts them together. Our file also has an optional
  `observability` profile (Grafana/Loki/Prometheus) that is off unless asked for.
- The production deployment is itself a single container built by
  `backend/Dockerfile` (backend binary + generated config + the built frontend,
  all in one image).

---

## 1.11 The frontend words: SPA, React, Vite, TypeScript

- **SPA** = Single-Page Application. The browser loads one HTML page and one
  JavaScript bundle; navigating between "pages" is done in JavaScript without a
  full reload. Our SPA is served at `/`.
- **React** is the UI library. You build the screen out of **components**
  (functions that return markup). Files end in `.tsx`.
- **TypeScript** is JavaScript with types. `.ts`/`.tsx` files are type-checked
  (`npm run typecheck`) and compiled to plain JavaScript for the browser.
- **Vite** is the frontend build tool and dev server. `npm run dev` starts a hot
  dev server on port 5173 that proxies API calls to the backend on 8080.
  `npm run build` produces the static bundle into `backend/product_dist/`, which
  the backend then serves.
- **`react-router`** maps URLs to screens (`/projects/:projectId` →
  `ProjectDetailScreen`). See `frontend/src/app/App.tsx`.
- **npm** installs frontend dependencies into `frontend/node_modules/` from
  `package.json` / `package-lock.json`.

---

## 1.12 "Tenant" / multi-tenancy

- A **tenant** is a customer/organisation whose data must be isolated from every
  other tenant's. Multi-tenant apps put a `tenant_id` column on shared tables and
  filter every query by it.
- **This app is single-tenant.** The plumbing exists
  (`backend/src/platform/tenant_isolation.rs` adds a `tenant_id` filter to any
  entity that has that column), but no governance entity currently has a
  `tenant_id` column, so in practice the tenant filter never fires. You'll still
  see `tenant_id` in the user's claims and in code comments.

---

## 1.13 Observability: tracing, logs, metrics

- **Tracing / structured logging**: the backend uses the `tracing` crate.
  `#[tracing::instrument]` on a function creates a "span" so logs are grouped by
  request and by operation. `LOG_LEVEL` and `APP_LOG_JSON` in `.env` control
  verbosity and format.
- **Metrics**: the backend exposes Prometheus metrics at `/metrics` and a
  readiness probe at `/health/ready` (see `backend/src/routes/info.rs`).
- The optional Grafana/Loki/Prometheus stack in `podman-compose.yml` is for
  viewing all of that locally; you don't need it to develop.

---

Next: [`02-architecture.md`](02-architecture.md) puts these pieces together into
the shape of the actual system.
