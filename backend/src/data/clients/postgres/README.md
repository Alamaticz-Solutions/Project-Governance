# PostgreSQL client adapters

Thin product-side adapters over `appfw-provider-postgres`. The framework crate
owns SQL generation, parameter binding, connection pooling, execution, and error
normalisation; the files here adapt the product's query/filter/policy types onto
that provider surface.

| File | Purpose |
|---|---|
| `postgres_client.rs` | Product `DatabaseClient` implementation delegating to the framework provider. |
| `cte.rs` | Product-side relationship / many-to-many CTE assembly. |
| `filter.rs` | Maps the product filter AST onto the provider's filter model, preserving access-control filters. |
| `mod.rs` | Module wiring. |

Verified through `cargo test --workspace` and the live smoke test
(`scripts/smoke/smoke_test.py`).
