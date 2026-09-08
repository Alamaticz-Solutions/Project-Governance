# Live Smoke Test

This directory contains the end-to-end live smoke test verifying the backend's GraphQL API and its cryptographic audit hash-chain integrity against PostgreSQL.

## Prerequisites

1. **PostgreSQL Database:**
   Running container `governance-postgres` with database `governance` and user `governance_svc`.
   ```bash
   # If not already running:
   podman-compose up -d postgres
   # or docker compose
   ```

2. **Backend Server:**
   Running on port 8080.
   ```bash
   cargo run -p backend --bin backend
   ```

3. **Python 3:**
   Standard library only (`urllib`, `json`, `subprocess`, `sys`). No external pip dependencies required.

## Running the Smoke Test

```bash
python scripts/smoke/smoke_test.py
```

## What It Verifies

1. **GraphQL Mutation `createComment`:** Creates a new record in `governance.comments` and returns the new comment ID.
2. **PostgreSQL Audit Insertion:** Queries `governance.comments_audit` directly via `docker exec governance-postgres psql` to confirm that an audit record with `action = 'INSERT'`, `prev_hash`, and a non-empty `event_hash` was recorded.
3. **GraphQL Mutation `updateComment`:** Updates the newly created comment via GraphQL.
4. **Audit Hash Chain Continuity:** Queries `governance.comments_audit` to verify:
   - Exactly 2 audit rows exist for this `record_id`.
   - The second row's `prev_hash` **identically matches** the first row's `event_hash`.
   - The second row's `event_hash` is cryptographically distinct.
