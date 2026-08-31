# Project Governance

Enterprise project governance workflow: intake → EPMO check-in → BTA review →
Finance review → EAC review → PIC review → TRC/Gate review.

**Branch `V1`** is a full rewrite of the app onto a new stack:

- `backend/` — Rust + Axum + SeaORM (was: Python/FastAPI + SQLAlchemy)
- `frontend/` — React 19 + TypeScript + Vite + Tailwind (was: Angular 19)
- Same Postgres database and governance business rules throughout.

The original Python/Angular implementation is preserved for reference in
`backend_legacy_fastapi/` and `frontend_legacy_angular/`.

## Running it

```bash
docker compose up -d postgres
cd backend && cp .env.example .env && cargo run
```

```bash
cd frontend && npm install && npm run dev
```

See [backend/README.md](backend/README.md) for what changed in the port and
demo login credentials.
