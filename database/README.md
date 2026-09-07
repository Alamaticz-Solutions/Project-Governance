# Project Governance Database Package

This directory is the product-owned generated database package surface.

The selected provider is `PostgreSQL` through data source `pg_primary`.
Generated package artifacts and product migrations belong under:

```text
database/_pkg/
```

Schema/seed DDL generation (`database/_pkg/schemas/**/{tables,seed}.pg.sql`) is
self-owned as of backend framework replacement phase 6
(`product_gen::ddl`) and runs via:

```bash
cd product_gen && cargo run --bin product_cli -- generate
```

**Not ported / no self-owned replacement exists yet:** the interactive
`migrate doctor`/`migrate plan`/`migrate lint`/`migrate rollback-guide`
commands shown here previously ran through `scripts/appfw`, which shelled out
to the App Framework checkout -- that checkout is gone (backend framework
replacement phase 7, complete 2026-09-07), and `product_cli` does not
currently implement equivalents for these four. If this workflow is needed
again, it needs to be scoped and built into `product_gen`/`product_cli`
first, the same way `generate`/`boundary-check`/`validate` were.
