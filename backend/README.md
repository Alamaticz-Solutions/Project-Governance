# Governance Portal Backend (Rust / Axum / SeaORM)

Rewrite of the legacy FastAPI backend. Same Postgres database, same governance
workflow, different stack.

## Layout

```
backend/
  migration/          sea-orm-migration crate — schema DDL, run via `cargo run -p migration -- up`
  src/
    entities/          SeaORM entities, one file per table (+ sea_orm_active_enums.rs for Postgres enum types)
    dto/                request/response structs per domain (auth, projects, gate_review, dashboard, notification, audit)
    services/           business logic — project_service.rs holds the EPMO→BTA→Finance→EAC→PIC→TRC state machine
    handlers/           thin Axum handlers, one file per domain, calling straight into services/
    auth/               JWT (jwt.rs), Argon2 password hashing (password.rs), the CurrentUser extractor + RBAC guard (extractor.rs)
    middleware/         request logging
    config.rs           env-driven AppConfig, loaded once at boot
    state.rs            AppState (db pool, config, http client) threaded through every handler
    error.rs            single AppError -> HTTP status mapping
    routes.rs           Axum Router assembly
    seed.rs             demo user seeding (mirrors the legacy seed.py)
```

## Running locally

```bash
docker compose up -d postgres   # from the repo root
cp .env.example .env            # adjust OPENAI_API_KEY / SMTP if you want those features live
cargo run
```

Migrations run automatically at startup (`Migrator::up`), followed by demo
user seeding. Demo login: any of `admin@abchealth.com`, `epmo@abchealth.com`,
`bta@abchealth.com`, `finance@abchealth.com`, `eac@abchealth.com`,
`pic@abchealth.com`, `pm@abchealth.com` — password `Demo1234!`.

## What changed vs. the legacy Python backend

- **ORM**: SQLAlchemy → SeaORM (async, Postgres-native, same schema).
- **Auth**: bcrypt → Argon2 password hashing; JWT semantics (claims, expiry) unchanged.
- **Security fixes**: `/auth/register` can no longer self-assign a role (always `viewer`; use the admin-only `POST /api/v1/users/` to create BTA/EPMO/Finance/etc. accounts). `PATCH /projects/{id}` and the gate-review decision endpoint now require the project owner/admin/EPMO and the assigned reviewer role, respectively — both had no check at all before.
- **AI extraction**: now calls the real OpenAI API (`OPENAI_API_KEY`) instead of the legacy app's undocumented Groq call.
- **Email queue / Celery+Redis**: dropped. It was fully unused scaffolding in the legacy app (grep found zero call sites) — SMTP send is synchronous, same as it always effectively was.
- **Dead code not ported**: the legacy `workflow.py` endpoints were broken (sync `Session` calls against an async engine) and encoded a conflicting stage order; `submit-decision` in `projects.py` was always the real state machine and is what got ported.
- **One fixed bug**: leaving "Prepare for EAC" now assigns `sequence_order = 5` to the next approval instead of duplicating Finance's `3`.
- Tables for the workflow-definition engine, risk register, attachments, and comments are kept for schema fidelity (nothing in the legacy app used them either) but aren't wired into any service — see `#![allow(dead_code)]` in `entities/mod.rs`.
