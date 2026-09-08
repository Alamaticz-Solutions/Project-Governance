# Project Governance — API Tests

Live-server GraphQL scenario tests. Scenario modules live under
`api_tests/src/schemas/governance` (generated from `.appfw/model/**`).

```bash
# regenerate scenarios after a model change (root; Windows: rust-appfw container)
scripts/appfw product generate

# run against a running backend
cargo run -p backend           # in one shell
cargo run -p api_tests         # in another
```
