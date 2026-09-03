# Project Governance

This product workspace was created by `scripts/appfw product new --profile product-intake`.

It is an intake scaffold for legacy application modernization, not a generated application yet.
The next step is for the AI harness and product developer to analyze the legacy codebase, data source, stored procedures, jobs, auth, integrations, and UI evidence; produce the modernization slice and stored procedure disposition; then write `.appfw/model` source.

Review `.appfw/poc-intake.yaml` and complete `.appfw/legacy-modernization.yaml` before generation.

## Selected Topology

- Product schema: `governance`
- Backend provider: `PostgreSQL`
- MCP server: `false`
- Kafka client: `false`
- Product UI mode: `scaffold`

## Next Commands

```bash
scripts/appfw doctor
scripts/appfw product analyze --summary --json
scripts/appfw product propose-model --summary --json
scripts/appfw product model-status --json
# Review .appfw/model-proposal.yaml before writing .appfw/model.
# scripts/appfw product validate --json is useful as topology sanity before modeling,
# but it is not product-readiness evidence until entity model source exists.
scripts/appfw product validate --json
cargo generate-lockfile
scripts/appfw product generate
scripts/appfw product generate --check --json
scripts/appfw product test --fast
```

Run the generation and test commands after the product entity model has been
created from the source evidence. The repository shell is intentionally
product-owned: backend, database, API tests, policy tests, local compose, and
frontend files use this product's app/schema/provider choices.
