# Project Governance — Database Package

Product-owned generated database package for the `governance` schema on the
`pg_primary` PostgreSQL data source.

Generated DDL and seed SQL live under `database/_pkg/schemas/**/{tables,seed}.pg.sql`
and product migrations under `database/_pkg/migrations/`.

## Regenerate

```bash
# from the repository root; on Windows use the rust-appfw container (see root README)
scripts/appfw product generate
scripts/appfw product generate --check --json
```

## Apply locally

```bash
docker compose -f ../podman-compose.yml up -d postgres
scripts/appfw product migrate
```
