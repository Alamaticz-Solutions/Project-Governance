# Project Governance Backend

This backend crate is product-owned, including its runtime -- as of backend
framework replacement phase 7 (`docs/architecture/self-owned-backend-plan.md`),
it has no dependency on the App Framework (`appfw_runtime`) at all. It starts
with the selected provider and ingress feature flags from
`.appfw/poc-intake.yaml`.

Generated route, schema, handler, operation, and data-access files should be
created only after the legacy-modernization evidence entity model is written under
`.appfw/model/schemas/governance`.

Run from the product root after the model exists:

```bash
cd product_gen && cargo run --bin product_cli -- generate && cd ..
cargo run -p backend
```
