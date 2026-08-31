# Teams Meeting + VTT — Proof of Concept

Branch: `poc/teams-meeting-vtt` (off `V1` — Rust/Axum backend, React/Vite frontend).

## Goal

Prove out, in the V1 stack, an end-to-end flow:

1. **Schedule a Microsoft Teams meeting** from the portal (the Teams analog of the
   existing Google Meet scheduling integration).
2. When the meeting ends, **its `.vtt` transcript is ingested automatically** and
   run through the existing AI extraction pipeline (summary / decisions / action
   items / agenda / optional BPMN), with a manual-ingest fallback.

It is deliberately **self-contained**: a standalone `poc_meetings` table, a
`/teams-poc/*` route group, and one React page (`/teams-poc`). Nothing in the
governance schema is touched. If it graduates, it folds into the real
`meetings` table + Meeting Center.

## What was added

### Backend (`backend/`)
| File | Purpose |
|---|---|
| `migration/src/m20260101_000003_teams_poc.rs` | `poc_meetings` table |
| `src/entities/poc_meetings.rs` | SeaORM entity |
| `src/services/graph_service.rs` | Microsoft Graph: client-credentials token, `create_teams_meeting`, `fetch_transcript_vtt`, `latest_transcript_id`, `create_transcript_subscription` |
| `src/services/poc_meeting_service.rs` | `parse_vtt` + `process_transcript` (reuses `meeting_agent_service`) |
| `src/dto/teams_poc.rs` | request/response DTOs |
| `src/handlers/teams_poc.rs` | route handlers + Graph webhook |
| `src/config.rs` | `GRAPH_*` settings + `graph_configured()` |

### Frontend (`frontend/`)
| File | Purpose |
|---|---|
| `src/lib/teamsPocApi.ts` | typed API client |
| `src/features/teams-poc/TeamsPocPage.tsx` | the POC page |
| `src/app/App.tsx`, `src/components/layout/Sidebar.tsx` | route + nav entry |

## Endpoints (all under `/api/v1`, intentionally unauthenticated for the POC)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/teams-poc/meetings` | Schedule. Graph mode → real Teams meeting; otherwise a local stub with a placeholder join link. |
| `GET` | `/teams-poc/meetings` | List |
| `GET` | `/teams-poc/meetings/:id` | One meeting (frontend polls this while `status = processing`) |
| `POST` | `/teams-poc/meetings/:id/ingest-transcript` | Body `{ "vtt_text": "..." }`. Manual path **and** the endpoint a Power Automate flow would call. |
| `POST` | `/teams-poc/subscriptions/renew` | Create/renew the Graph `getAllTranscripts` change-notification subscription |
| `POST` | `/teams-poc/webhooks/graph/transcripts` | Graph change-notification receiver (validation-token echo + `created` handling) |

`status` lifecycle: `scheduled → processing → completed | failed`.

## Running the POC

### 1. Local-stub mode (no Azure tenant — full pipeline still demoable)

```bash
docker compose up -d postgres
cd backend && cp .env.example .env      # set OPENAI_API_KEY, leave GRAPH_* blank
cargo run
cd ../frontend && npm i && npm run dev
```

Open `http://localhost:5173/teams-poc`:
- **Schedule a meeting** → gets a placeholder `teams.microsoft.com/l/meetup-join/POC-…` link.
- Paste / upload a `.vtt` (a sample is pre-filled) → **Process transcript** →
  summary, decisions, action items, agenda, BPMN status render.

### 2. Graph mode (real Teams scheduling + auto-ingest)

Tenant-admin setup (one time):

1. **Entra app registration** → `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`.
2. **Application permissions** (admin consent): `OnlineMeetings.ReadWrite.All`,
   `OnlineMeetingTranscript.Read.All`.
3. **Teams application access policy** (Teams PowerShell), binding the app id to
   the organizer account(s):
   ```powershell
   New-CsApplicationAccessPolicy   -Identity governance-poc -AppIds "<GRAPH_CLIENT_ID>" -Description "Governance Teams POC"
   Grant-CsApplicationAccessPolicy -PolicyName governance-poc -Identity "<organizer-object-id>"
   ```
   (up to 30 min to take effect)
4. **Teams admin center → Meeting policy → "Transcript API access" = On.**

Then fill in `backend/.env`:

```
GRAPH_TENANT_ID=...
GRAPH_CLIENT_ID=...
GRAPH_CLIENT_SECRET=...
GRAPH_DEFAULT_ORGANIZER_ID=<organizer AAD object id>
GRAPH_DEFAULT_ORGANIZER_EMAIL=<organizer email>
GRAPH_WEBHOOK_CLIENT_STATE=<random secret>
GRAPH_NOTIFICATION_URL=https://<public-host>/api/v1/teams-poc/webhooks/graph/transcripts
```

For local dev the notification URL needs to be publicly reachable — run
`ngrok http 8000` (or a dev tunnel) and use that host.

Flow:
- **Schedule a meeting** in the POC page → a real Teams meeting is created;
  `graph_online_meeting_id` + `join_url` are stored.
- Click **Renew Graph subscription** (POC stand-in for the renewal cron — the
  subscription lives ~1 h).
- Hold the meeting **with transcription on**. ~2–10 min after it ends, Graph
  POSTs the webhook → backend fetches the `.vtt` → pipeline runs → the meeting
  flips to `completed` in the UI.

### Why "only participants can view the transcript" doesn't block this

That restriction is a Teams/Stream front-end ACL. The Graph **app-only** path is
a separate, tenant-admin-sanctioned backend channel: the app acts with the
**organizer's** authority (that's what the application access policy grants), and
the organizer can always read their own meeting's transcript. Three admin-held
gates must all be open (app permission + admin consent, application access
policy, "Transcript API access" tenant toggle); participant visibility is
irrelevant.

## Correlating a transcript back to a governance request

The POC stores `graph_online_meeting_id` at schedule time, so a change
notification maps directly to the right `poc_meetings` row. If a notification
arrives for an unknown meeting, a new `teams_auto` row is created unlinked — in
the real app a human would link it to a `GOV-…` request (same as today's manual
Meeting Center link step).

## Not in the POC (needed before production)

- Auth on the `/teams-poc/*` endpoints (V1 frontend is still on mock auth).
- Subscription **auto-renewal** job + persistence (`poc` uses a manual button).
- Graph webhook JWT `validationTokens` verification (POC checks `clientState` only).
- Async job queue — the POC runs the pipeline inline in the request/webhook.
- Encrypted `includeResourceData` payloads (POC uses `includeResourceData:false`
  and fetches `/content` separately — no certificate needed).
- PHI handling: move OpenAI calls to Azure OpenAI (BAA) before real clinical
  transcripts.

## Power Automate alternative (lower-code pilot)

The `/teams-poc/meetings/:id/ingest-transcript` endpoint is exactly what a
Power Automate flow would call:

`Trigger: transcript available` → `Get transcript content (VTT)` →
`HTTP POST {vtt_text}` to the backend.

This skips the Azure app registration / cert / subscription-renewal work but
still needs the connection account to be the organizer (or covered by the access
policy) and the tenant "Transcript API access" toggle on. Good for a fast pilot;
swap in the Graph subscription later without changing the backend.
