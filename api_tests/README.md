# Project Governance API Tests

Generated API scenario modules belong under `api_tests/src/schemas/governance`.
Create the legacy-modernization entity model first, then run:

```bash
cd product_gen && cargo run --bin product_cli -- generate && cd ..
cargo run -p api_tests   # against a running backend (cargo run -p backend)
```

(Backend framework replacement phase 7, complete 2026-09-07: `scripts/appfw`
and the App Framework checkout it shelled out to are both gone.
`api_tests` was decoupled from the framework's own `appfw_test` harness in
phase 7 slice 7 and no longer depends on it either.)
