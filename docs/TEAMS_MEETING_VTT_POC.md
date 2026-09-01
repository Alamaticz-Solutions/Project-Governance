# Teams Meeting + VTT — Proof of Concept

Branch: `poc/teams-meeting-vtt` (off `V1` — Rust/Axum backend, React/Vite frontend).

## Goal

Prove out, in the V1 stack, an end-to-end flow:

1. **Schedule a Microsoft Teams meeting** from the portal.
2. When the meeting ends, **its `.vtt` transcript is ingested** and run through
   the existing AI extraction pipeline (summary / decisions / action items /
   agenda / optional BPMN), with a manual-ingest fallback.

**Integration route: Power Automate** (chosen). No Microsoft Graph, no Entra app
registration, no client secret, no admin consent. The portal makes/receives
plain HTTPS calls; two Power Automate flows do the Teams work.
See **`TEAMS_POWER_AUTOMATE_SETUP.md`** for the full setup + the "personal vs.
dedicated account" and "only our meetings?" answers. The Graph alternative
(`TEAMS_GRAPH_API_MICROSOFT_ADMIN_HANDOFF.md`) is retained but its backend code
was removed.

It is deliberately **self-contained**: a standalone `poc_meetings` table, a
`/teams-poc/*` route group, and one React page (`/teams-poc`). Nothing in the
governance schema is touched.

## What was added

### Backend (`backend/`)
| File | Purpose |
|---|---|
| `migration/src/m20260101_000003_teams_poc.rs` | `poc_meetings` table |
| `migration/src/m20260101_000004_teams_poc_flow.rs` | retires the Graph columns → `external_ref` |
| `src/entities/poc_meetings.rs` | SeaORM entity |
| `src/services/power_automate_service.rs` | `schedule_meeting_via_flow` — outbound POST to the Power Automate scheduling flow; never hard-fails a schedule |
| `src/services/poc_meeting_service.rs` | `parse_vtt` + `process_transcript` (reuses `meeting_agent_service`) |
| `src/dto/teams_poc.rs` | request/response DTOs |
| `src/handlers/teams_poc.rs` | route handlers |
| `src/config.rs` | `POWER_AUTOMATE_SCHEDULE_URL`, `INGEST_API_KEY`, `INGEST_REJECT_UNKNOWN` + `schedule_via_flow()` |

### Frontend (`frontend/`)
| File | Purpose |
|---|---|
| `src/lib/teamsPocApi.ts` | typed API client |
| `src/features/teams-poc/TeamsPocPage.tsx` | the POC page |
| `src/app/App.tsx`, `src/components/layout/Sidebar.tsx` | route + nav entry |

## Endpoints (all under `/api/v1`, unauthenticated except where noted)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/teams-poc/meetings` | Schedule. `POWER_AUTOMATE_SCHEDULE_URL` set → POSTs to the flow, stores its `join_url` / `meeting_ref` (`source = flow_scheduled`); a flow error is saved to `error_message`, not raised. Unset → local stub link (`source = local_stub`). |
| `GET` | `/teams-poc/meetings` | List |
| `GET` | `/teams-poc/meetings/:id` | One meeting (frontend polls this while `status = processing`) |
| `POST` | `/teams-poc/meetings/:id/ingest-transcript` | Body `{ "vtt_text": "..." }`. Portal UI paste/upload; also a flow that scheduled via the portal. |
| `POST` | `/teams-poc/ingest` | Body `{ meeting_ref, vtt_text, subject?, start_time?, end_time?, organizer_email? }`. The endpoint a Power Automate transcript flow calls. Correlates by `meeting_ref`, creates a row if new (unless `INGEST_REJECT_UNKNOWN`). **Idempotent** (a ref already `processing`/`completed` is returned unchanged). Guarded by `INGEST_API_KEY` (`x-api-key`) when set. |

`status` lifecycle: `scheduled → processing → completed | failed`.
`source`: `local_stub` | `flow_scheduled` | `flow_ingest` | `manual_ingest`.

## Running the POC

### Local-stub mode (no Microsoft setup — full pipeline still demoable)

```bash
docker compose up -d postgres
cd backend && cp .env.example .env      # set OPENAI_API_KEY; leave the POC keys blank
cargo run
cd ../frontend && npm i && npm run dev
```

Open `http://localhost:5173/teams-poc`:
- **Schedule a meeting** → placeholder `teams.microsoft.com/l/meetup-join/POC-…` link.
- Paste / upload a `.vtt` (a sample is pre-filled) → **Process transcript** →
  summary, decisions, action items, agenda, BPMN status render.

### Flow mode (real Teams scheduling + transcript forwarding)

Set in `backend/.env` and restart:

```
POWER_AUTOMATE_SCHEDULE_URL=https://<power-automate-flow-A-trigger-url>
INGEST_API_KEY=<random secret, also sent by flow B as x-api-key>
INGEST_REJECT_UNKNOWN=false   # true = only portal-scheduled meetings are ingested
```

Then build the two flows per **`TEAMS_POWER_AUTOMATE_SETUP.md`**:
- **Flow A** (HTTP-triggered) — the portal calls it; it runs Teams *Create a
  Teams meeting* and returns `{join_url, meeting_ref}`.
- **Flow B** (transcript trigger or scheduled) — gets the meeting VTT and
  `POST`s `{meeting_ref, vtt_text, …}` to `/teams-poc/ingest` with the
  `x-api-key` header.

The backend must be reachable from Power Automate for Flow B — `ngrok http 8000`
for a pilot, or a real public host.

## Correlating a transcript back to a governance request

`schedule_meeting` stores `external_ref` (the flow's `meeting_ref`), so a later
`/teams-poc/ingest` maps straight to the right `poc_meetings` row. An unknown
`meeting_ref` creates an unlinked `flow_ingest` row (or is rejected `404` when
`INGEST_REJECT_UNKNOWN=true`) — in the real app a human would link it to a
`GOV-…` request.

## Verification status (as built on this branch)

| Check | Result |
|---|---|
| `cargo check --workspace` | ✅ passes (needed the `async-graphql` lockfile pin below) |
| `cargo run` — full binary build | ✅ compiles, **zero errors/warnings from any POC file** |
| All 3 migrations against real Postgres 16 | ✅ applied on a fresh volume after merging `origin/V1` |
| `seed_demo_users` + backend boots & serves | ✅ all 7 demo users seeded, `listening addr=0.0.0.0:8000` |
| `frontend` `npm run build` (`tsc --noEmit` + `vite build`) | ✅ clean (whole project); no dangling import from V1's `workspace.css` deletion |
| Live HTTP smoke test of `/teams-poc/*` | ✅ schedule → ingest-transcript → get/list all 200; VTT parsed and persisted; status machine `scheduled→processing→failed` exercised |
| Live `/auth/login` + `/auth/me` | ✅ 200; `role` returns lowercase (`admin`, `project_manager`) matching `frontend/src/lib/types.ts` |
| Live `POST /projects` + `GET /projects` + `GET /dashboard` | ✅ 200; create accepts lowercase `priority`/`risk_level` (as the frontend sends), response serializes `status:"active"`, `priority:"high"`, `risk_level:"very_high"`, `current_owner_role:"security"` — write + read paths against the real Postgres enum columns |
| LLM extraction step (OpenAI) | ⚠️ returns `status:"failed"` with a captured `error_message` — `backend/.env` has a placeholder `OPENAI_API_KEY`. Set a real key to get summary/decisions/BPMN. Not a code issue; failure path is graceful (still 200). |

**Compiled but never exercised** (V1 code with no callers yet): `services::workflow_engine::EligibilityEngine` and the `workflow_stage_definitions` entity — these show up as dead-code warnings in `cargo check`. SeaORM entity↔schema mismatches are runtime, not compile-time, so V1's new `phase_name` / `prerequisites` / `conditions` columns are unverified (but unreachable).

### Fixes made to unbreak the V1 build (not POC logic)
- **`backend/Cargo.lock`** — `async-graphql` was pinned `=7.0.11` but its
  `-derive/-parser/-value` sub-crates had floated to `7.2.1`, which fails to
  compile (`MetaType::Scalar` field mismatch). Pinned all three to `7.0.11`.
  *(This is why the frontend `AuthContext.tsx` carries the "backend is currently
  down compiling" note.)*
- **`docker-compose.yml`** — image `postgres:16-alpine` → `pgvector/pgvector:pg16`;
  the init migration does `CREATE EXTENSION vector`.

### Pre-existing V1 enum layer — RESOLVED (merge `72333a4`)
`origin/V1`'s `97aa4b3` fixed the `enum_name` half (`userrole` → `user_role`).
Merging it in and finishing the alignment fixed the rest:
- `src/entities/sea_orm_active_enums.rs` — `string_value`, `as_str()`,
  `from_str_opt()` and `#[serde(rename_all)]` are now lowercase `snake_case`,
  matching the `CREATE TYPE … AS ENUM` labels in
  `m20260101_000001_init_schema.rs` and the `UserRole` union in
  `frontend/src/lib/types.ts`. `GateCode` stays uppercase — its Postgres
  labels are `'A'..'S','CAB'`.
- This also fixed an always-false role check in
  `project_service::submit_decision` (`current_owner_role` is stored lowercase,
  but `role.as_str()` used to return `"BTA"` etc.), and made project creation
  from the real frontend work (it sends `priority:"high"`; the entities used to
  deserialize only `"HIGH"`).
- Added the missing `'in_delivery'` label to `CREATE TYPE project_status`
  (commit `4050ab2`) — `ProjectStatus::InDelivery` had no DB label. Latent
  (no caller today) but needed for the alignment to be genuinely complete.
- The DB was recreated on a fresh volume (`docker compose down -v`) so V1's new
  `DROP TYPE … CASCADE` / `CREATE TYPE` block and `workflow_stage_definitions`
  column changes actually applied.

The `/teams-poc/*` endpoints needed no changes — the `poc_meetings` table is
all `VARCHAR`/`JSONB` and touches none of the enum tables.

## Not in the POC (needed before production)

- Auth on `POST /teams-poc/meetings` and `/meetings/:id/ingest-transcript`
  (V1 frontend is still on mock auth). `/teams-poc/ingest` already supports
  `INGEST_API_KEY`.
- Async job queue — `/ingest` and `/meetings/:id/ingest-transcript` run the AI
  pipeline inline. `/ingest` is idempotent so a flow-retry after a slow
  response is safe, but a very long transcript could still exceed a client
  timeout; move to `202 Accepted` + background processing before heavy use.
- Persisting the scheduling-flow's raw response for audit.
- PHI handling: move OpenAI calls to Azure OpenAI (BAA) before real clinical
  transcripts.
- Retry/backoff + alerting when the scheduling flow is unreachable (today the
  row is saved with `error_message` and the user retries from the UI).

## Setup

Power Automate route — the chosen one: **`TEAMS_POWER_AUTOMATE_SETUP.md`**
(covers the two flows, the single tenant-wide admin toggle, personal-vs-service
account, and the "only our meetings?" switch).

Graph route — not used, backend code removed:
**`TEAMS_GRAPH_API_MICROSOFT_ADMIN_HANDOFF.md`** (kept for a possible future
multi-organizer / fully-code-owned pipeline).
