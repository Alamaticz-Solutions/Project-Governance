# PDS App Framework — issues found downstream

**For:** the PDS App Framework team.
**From:** the Project Governance product team (`project-governance`, branch
`framework-readopt`).
**Framework build under test:** `appfw.lock` `framework_version = 0.1.1`,
`framework_git_sha = 6ee6985b7d357a54fb9eddb456da50654ce87c3d`
(the internal mirror `Alamaticz-Solutions/app-framework`; upstream baseline
`pacificdental-app-framework-893829ad0e30`).
**Date:** 2026-09-09. Found during a full local end-to-end run
(PostgreSQL 16, `scripts/appfw product migrate` + `cargo run -p backend` + live
GraphQL).

We are **not** patching the framework ourselves. This document is the hand-off so
the framework team can reproduce, fix, and release. Each item lists a minimal
repro, the root cause we traced, a proposed fix, and the local workaround we are
carrying meanwhile.

---

## Summary

| ID | Component | Severity | One-line |
|----|-----------|----------|----------|
| N | `appfw-provider-postgres` | — | **Already known** — `jsonb[]` null binding. Patched on the mirror (`pinned/local-patch-1`, commit `6ee6985`). Listed here only because P is its sibling. Still needs upstreaming. |
| P | `appfw-provider-postgres` (`src/param.rs`) | High | Null value for a **scalar `jsonb`** column fails to serialize (`error serializing parameter N`). Any create/update that omits a nullable `jsonb` field fails. |
| Q | `appfw-codegen` (`app_gen` seed SQL generator) | High | Generated `seed.pg.sql` emits `ARRAY[…]` for `jsonb` columns → `scripts/appfw product migrate` fails on the first affected insert. |
| C1 | `appfw-runtime` query-IR | Compat note | `sort` argument shape changed (array → object) and a hard page-size cap was added, relative to the baseline downstream products were written against. Not a bug — a contract change that needs a release note / migration entry. |

---

## Finding P — null scalar `jsonb` parameter binding

Sibling of Finding N. Finding N fixed the `jsonb[]` (`RuntimeDataType::JsonArray`
/ `ObjectArray`) arm; the scalar `jsonb` (`RuntimeDataType::Json` / `Object`) arm
was left with the same defect.

### Repro

Any entity with a **nullable `jsonb` column**, e.g. `Project.ai_extracted_data`.
GraphQL mutation that omits it:

```graphql
mutation {
  createProject(input: {
    project_number: "X", project_name: "Y", business_unit: "IT",
    manager_id: "<uuid>", priority: "Medium", status: "Draft",
    created_at: "2026-09-09T00:00:00Z"
    # ai_extracted_data omitted -> bound as Value::Null
  }) { id }
}
```

Response: `data store operation failed`. Backend log:

```
ERROR backend::data::clients::postgres::postgres_client: PostgreSQL insert failed
      error=error serializing parameter 37
```

Adding `ai_extracted_data: {}` makes the identical mutation succeed.

### Root cause

`appfw_provider_postgres/src/param.rs`:

- `prop_param_ref` renders the placeholder for a `Json`/`Object` column as
  **`$N::jsonb`**.
- `type_param`'s null arm binds the wrong Rust type:

```rust
(RuntimeDataType::Object | RuntimeDataType::Json, Value::Null) => {
    Box::new(try_null::<String>(is_nullable, prop_name)?)   // <-- Option<String>::None
}
```

`Option<String>::None` serializes with the `text` OID; `tokio-postgres`'
`to_sql_checked` then rejects it against the `jsonb`-typed placeholder →
"error serializing parameter N". Exactly the Finding N failure mode, one arm over.

### Proposed fix

```rust
(RuntimeDataType::Object | RuntimeDataType::Json, Value::Null) => {
    Box::new(try_null::<Json<Value>>(is_nullable, prop_name)?)
}
```

`Option<postgres_types::Json<Value>>::None` serializes with the JSONB OID and
matches `$N::jsonb`. (This is the same shape Finding N used for the `jsonb[]`
arm: `try_null::<Vec<Json<Value>>>`.)

Suggested regression test (mirrors the Finding N test): assert the bound param
for `(Json, Value::Null)` accepts `postgres_types::Type::JSONB`.

### Local workaround

Callers must send `{}` (or a real value) for every nullable `jsonb` column.
The product SPA's intake form already sends `ai_extracted_data`, so the UI path
is unaffected; direct API callers and integration tests are.

Affected nullable `jsonb`/`Object` columns in this product: `Project.ai_extracted_data`,
`GateSubmission.data`, `WorkflowStageDefinition.conditions`,
`AuditEvent.old_values` / `new_values`, several `Meeting.*`.

---

## Finding Q — seed SQL generator emits `ARRAY[…]` for `jsonb` columns

### Repro

Model a `jsonb` column (`DataType::Json`) whose seed value is a JSON array or
`[]`. In this product, `.appfw/model/schemas/governance/seeds/03_workflow_stage_definitions.yaml`:

```yaml
assigned_roles: [admin]        # column type: jsonb
checklist_template: []         # column type: jsonb
```

`scripts/appfw product generate` produces, in
`database/_pkg/schemas/governance/seed.pg.sql`:

```sql
INSERT INTO governance.workflow_stage_definitions (... assigned_roles ... checklist_template ...)
VALUES (
  ...
  ARRAY['admin'],          -- should be '["admin"]'::jsonb
  ...
  ARRAY[]::varchar[]       -- should be '[]'::jsonb
);
```

`scripts/appfw product migrate` (which runs `seed.pg.sql` via
`database/src/postgres.rs` → `batch_execute`) then fails:

```
ERROR: column "assigned_roles" is of type jsonb but expression is of type text[]
```

Object-valued seeds for `jsonb` columns (e.g. `prerequisites: {gates: [...]}`)
are **not** affected — they already route through `json_literal` → `::jsonb`.
Only the array/`[]` case is broken.

### Root cause

`app_gen/src/utils/filters.rs`:

- `seed_literal` dispatches on the JSON value shape: `Value::Object` →
  `json_literal` (correct, emits `'…'::jsonb`); `Value::Array` → `array_literal`.
- `array_literal` for `SqlSeedDialect::Postgres` **always** emits `ARRAY[…]` /
  `ARRAY[]::varchar[]`, regardless of the target column type.

The value shape alone cannot disambiguate: a JSON array seed value legitimately
targets a `jsonb` column **or** a real SQL-array column (`StringArray`,
`EnumArray`, `Int*Array`, `UuidArray` → `varchar[]` / `smallint[]` / …). The
generator needs the column's model `DataType` to choose.

The seed-SQL generation context (`app_gen/src/utils/database.rs::gen_seed_sql`)
does not currently load `entity_types` (unlike `gen_tables_sql`, which inserts
`ddl` + `ENTITY_TYPES`).

### Proposed fix

Make the seed literal filters column-type aware:

1. `gen_seed_sql` reads the schema's `entity_types.yaml` and inserts a context
   map, e.g. `seed_column_types = { "<Pascal>": { "<col>": "<DataType>" } }`.
2. The seed templates pass the column's type to the literal filter, e.g.
   `record[col] | pg_seed_literal(column=col, entity=seed.entity_type, types=seed_column_types)`.
3. `pg_seed_literal` (and `mssql`/`snowflake` for parity): for a `Json` / `Object`
   column, emit `json_literal` for any non-null value; otherwise fall through to
   the existing value-shape path so real SQL-array columns keep `ARRAY[…]`.
   (`JsonArray` / `ObjectArray` → `jsonb[]` seeds are a further case —
   `ARRAY['{…}'::jsonb, …]` — not exercised by any in-tree seed today.)

We prototyped exactly this and it works; happy to send the diff if useful.

### Local workaround

Applied by hand after each `product generate`, per the team's setup guide:

```bash
sed -i "s/ARRAY\[\]::varchar\[\]/'[]'::jsonb/g; s/ARRAY\['admin'\]/'[\"admin\"]'::jsonb/g" \
    database/_pkg/schemas/governance/seed.pg.sql
```

or `APPFW_MIGRATE_SKIP_SEED=1 scripts/appfw product migrate` followed by a
hand-patched `psql -f seed.pg.sql`. We are **not** committing the patched file —
it would diverge from `generate --check`.

---

## C1 — query-IR contract changes (compatibility note, not a bug)

Relative to the baseline this product's hand-written service layer was authored
against, the current framework's `appfw_runtime` query-IR:

1. **`sort` shape.** `parse_sort_specs` → `normalize_object_input` now requires a
   JSON **object** `{ "<column>": "asc"|"desc" }` and rejects the previous
   `[{ "field": "...", "direction": "..." }]` array with
   `validation error: sort must be a JSON object or a JSON-encoded object string, got array`.
2. **Hard page-size cap.** `limit` above `APP_QUERY_MAX_PAGE_SIZE` (default
   **250**) is now rejected (`pagination limit 500 exceeds maximum page size
   250`) rather than clamped.

Both are reasonable hardening. The ask is only that they land in the framework
**release notes / upgrade guide** so downstream products know to sweep their
direct `DataAccess` / query-IR call sites when re-pinning. We have already
updated ours (`backend/src/services/{approval_state_machine,gate_eligibility,workspace}.rs`).

---

## Verification environment

- OS: Windows 11 + Docker Desktop; PostgreSQL `postgres:16-alpine`.
- `cargo 1.98`, `node 20`.
- Product DB: 42 tables, 7 seeded users, 19 workflow-stage definitions.
- All findings reproduced against a running `backend` binary on
  `127.0.0.1:8080`, GraphQL at `/governance`.
