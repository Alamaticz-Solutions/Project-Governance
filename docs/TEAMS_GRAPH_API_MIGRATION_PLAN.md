# Teams Meeting / VTT — Power Automate → Microsoft Graph API migration plan

**Status:** proposal, awaiting review. No code written yet.
**Branch:** `poc/teams-meeting-vtt` (PR #2 closed).
**Supersedes:** `TEAMS_POWER_AUTOMATE_SETUP.md`, `power_automate_service.rs`, and the
`POST /api/v1/teams-poc/ingest` `x-api-key` contract.

---

## 1. Goal

Replace the Power Automate flow (scheduling) and the `x-api-key` push endpoint
(transcript ingest) with **direct Microsoft Graph API calls** using **app-only
(client-credentials) auth** against the registered Entra application
`Governance Portal-Team Meeting`.

Two capabilities move in-house:

| Capability | Today (Power Automate) | After (Graph) |
|---|---|---|
| Create a Teams meeting + send invites | POST to flow trigger URL → flow returns `{join_url, meeting_ref}` | `POST /users/{organizer}/events` (calendar-backed, `isOnlineMeeting:true`) |
| Learn a transcript is ready | Flow POSTs VTT to `/teams-poc/ingest` with `x-api-key` | Graph **change notification** subscription on `communications/onlineMeetings/getAllTranscripts` |
| Fetch transcript text | (flow sent it inline) | `GET …/transcripts/{id}/content?$format=text/vtt` |

The AI pipeline downstream (`parse_vtt` → `meeting_agent_service` → summary /
decisions / action items / BPMN) is **unchanged**. The manual VTT paste/upload
path in the UI **stays** — it is the only way to demo without a real transcribed
meeting.

---

## 2. Decisions needed from you before implementation

| # | Decision | Recommendation |
|---|---|---|
| D1 | Delete `power_automate_service.rs` outright, or keep it behind the existing `schedule_via_flow()` switch as a fallback? | **Delete it.** One code path. The flow infra is being decommissioned; a dead fallback rots. |
| D2 | Change-notification style: **plain** (Graph sends resource path, we GET it) vs **rich / `includeResourceData:true`** (Graph sends the encrypted transcript metadata inline, needs an RSA cert we hold the private key for). | **Plain.** No certificate to manage, no JWT `validationTokens` decryption. One extra GET per transcript is nothing. |
| D3 | Meeting-ID correlation: resolve the `onlineMeeting.id` at **schedule time** (`$filter=JoinWebUrl eq`) vs **on notification** (GET by id from the notification, match join URL). | **Both** — resolve at schedule time as primary, fall back to notification-time lookup if the filter misses (join-URL encoding is fussy). Detail in §8. |
| D4 | Organizer mailbox. App-only needs a concrete user whose calendar hosts every event. Today `organizer_email` is optional free text. | Introduce **`GRAPH_ORGANIZER_USER_ID`** (a service/shared mailbox, Entra object id) as required config. The UI `organizer email` field becomes display-only metadata, or is removed. |
| D5 | **Ops blocker to confirm now:** is meeting transcription auto-enabled by Teams meeting policy in tenant `19a8fbac-…`? If transcription is never started, **no transcript is ever produced** and none of this code path fires. | Confirm with the M365 admin that the organizer mailbox's Teams meeting policy has `-AllowTranscription $true` and, ideally, auto-transcription on. |
| D6 | Stable public URL for the webhook. ngrok's free URL changes on every restart; **every change subscription then points at a dead endpoint** and must be recreated. | For dev: accept the re-subscribe step (documented in §11) or use a reserved ngrok domain. For Dev/prod: the deployed Render URL. |

---

## 3. Architecture after migration

```
┌─────────────┐   POST /teams-poc/meetings        ┌──────────────────────┐
│  React UI   │ ────────────────────────────────► │  Rust / Axum backend │
└─────────────┘                                   │                      │
                                                  │  graph_client        │  client-credentials token (cached)
                                                  │  graph_meeting_svc   │ ───────────────► Microsoft Graph
                                                  │                      │   POST /users/{org}/events
                                                  │                      │   GET  /users/{org}/onlineMeetings?$filter=JoinWebUrl eq …
                                                  └──────────┬───────────┘
                                                             │ store: event id, onlineMeeting id, join url
                                                             ▼
                                                     poc_meetings row (status=scheduled)

  ── meeting happens, transcription runs, meeting ends ──

  Microsoft Graph  ──POST──►  /api/v1/teams-poc/graph-notifications   (public HTTPS)
     {value:[{ resource:"users/{org}/onlineMeetings('MSo…')/transcripts('MSM…')", clientState, … }]}
                                                             │
                                    verify clientState, parse meetingId + transcriptId
                                                             ▼
                                    graph_meeting_svc.fetch_transcript()
                                       GET …/transcripts/{id}/content?$format=text/vtt
                                                             ▼
                                    poc_meeting_service.process_transcript(vtt)   ← unchanged pipeline
                                                             ▼
                                    poc_meetings row (status=completed, summary/decisions/…)

  Background task: graph_subscription_svc renews the tenant-wide
  getAllTranscripts subscription before it expires.
```

---

## 4. Tenant / Entra prerequisites (admin work — not code)

### 4.1 Application (client) identity — already created

```
Display name : Governance Portal-Team Meeting
Client ID    : cb2fd374-0701-49fe-aec3-5642617354f7
Object ID    : b9d0d278-26ea-435f-9114-f09b1e561619
Tenant ID    : 19a8fbac-4bc6-4e82-a386-f7a6866a9a1e
Client secret: (provided out-of-band; see §4.5)
```

### 4.2 Microsoft Graph **application** permissions (admin consent required)

| Permission | Why | Used by |
|---|---|---|
| `Calendars.ReadWrite` | Create the calendar event that hosts the Teams meeting and sends invites | schedule |
| `OnlineMeetings.Read.All` | Resolve `onlineMeeting.id` from the event's join URL; GET the meeting by id | correlation |
| `OnlineMeetingTranscript.Read.All` | Subscribe to `getAllTranscripts`; list + read transcript content | ingest |

Grant in **Entra admin center → App registrations → (this app) → API permissions
→ Add permission → Microsoft Graph → Application permissions**, then **Grant admin
consent for {tenant}**. All three are app-only; none work as delegated here.

> `OnlineMeetings.ReadWrite.All` (create standalone meetings) is **deliberately
> not requested** — see §6.1 for why we use calendar events instead.

### 4.3 Two different "application access policies" — do not conflate

App-only permissions above are tenant-wide by default. Two separate scoping
mechanisms, **same phrase, different products**, both are admin PowerShell:

**(a) Teams / cloud-communications — `New-CsApplicationAccessPolicy`**
Gates `OnlineMeetings.Read.All` and `OnlineMeetingTranscript.Read.All`. Without
it, every `/onlineMeetings` and `/transcripts` call returns `403`.

```powershell
# MicrosoftTeams PowerShell module
Connect-MicrosoftTeams
New-CsApplicationAccessPolicy -Identity "GovPortalMeetingPolicy" `
  -AppIds "cb2fd374-0701-49fe-aec3-5642617354f7" `
  -Description "Governance Portal backend - meetings & transcripts"
# Grant to the organizer mailbox (preferred) …
Grant-CsApplicationAccessPolicy -PolicyName "GovPortalMeetingPolicy" `
  -Identity "governance-meetings@abchealth.com"
#   … or tenant-wide:  Grant-CsApplicationAccessPolicy -PolicyName "GovPortalMeetingPolicy" -Global
```
Propagation can take up to 30 minutes.

**(b) Exchange Online — `New-ApplicationAccessPolicy`** (note: no `Cs` prefix)
`Calendars.ReadWrite` app-only grants access to **every mailbox in the tenant**
unless scoped. To restrict the app to just the organizer mailbox:

```powershell
# ExchangeOnlineManagement module
New-DistributionGroup -Name "GovPortalMailboxes" -Type Security `
  -Members "governance-meetings@abchealth.com"
New-ApplicationAccessPolicy -AppId "cb2fd374-0701-49fe-aec3-5642617354f7" `
  -PolicyScopeGroupId "GovPortalMailboxes@abchealth.com" `
  -AccessRight RestrictAccess -Description "Governance Portal backend - calendar"
```

### 4.4 Organizer mailbox + transcription policy

- A licensed user/shared mailbox, e.g. `governance-meetings@abchealth.com`. Its
  **Entra object id** goes in `GRAPH_ORGANIZER_USER_ID`.
- Its Teams meeting policy must allow transcription:
  `Set-CsTeamsMeetingPolicy -Identity <policy> -AllowTranscription $true`
  (and ideally auto-start transcription). **Without this, D5 is a hard blocker.**

### 4.5 Secret hygiene — required, do not skip

- The client secret was delivered as a **screenshot in a chat thread**. Treat it
  as **exposed**: rotate it in Entra before any non-dev use, and generate a fresh
  one for Dev/prod.
- Lives **only** in `backend/.env` (git-ignored) locally and in the **Render
  secret store** for deployed envs. Never in a committed file, never in this repo,
  never echoed in logs.
- Prefer a **certificate credential** over a client secret for production (no
  expiry surprises, not copy-pasteable). Out of scope for the POC but note it.

---

## 5. New environment variables

`backend/.env.example` gains:

```dotenv
# ── Microsoft Graph (Teams meetings + transcripts) ──────────────────────────
GRAPH_TENANT_ID=19a8fbac-4bc6-4e82-a386-f7a6866a9a1e
GRAPH_CLIENT_ID=cb2fd374-0701-49fe-aec3-5642617354f7
GRAPH_CLIENT_SECRET=            # from Entra; secret store only, never committed
GRAPH_ORGANIZER_USER_ID=        # Entra object id of the organizer mailbox
# Public HTTPS base the backend is reachable at, for Graph change notifications.
# Dev: the current ngrok URL. Dev/prod: the Render URL.
GRAPH_NOTIFICATION_BASE_URL=https://<ngrok-or-render-host>
# Shared secret echoed back in every notification; we reject mismatches.
GRAPH_NOTIFICATION_CLIENT_STATE=<random 32+ chars>
# How long each subscription is requested for (<= 4230 min for this resource).
GRAPH_SUBSCRIPTION_MINUTES=4230
```

Retire: `POWER_AUTOMATE_SCHEDULE_URL`, `INGEST_API_KEY`, `INGEST_REJECT_UNKNOWN`.

`AppConfig` (`config.rs`): drop the three `power_automate*` / `ingest*` fields,
add the block above. Add a `graph_enabled()` helper (`true` when tenant/client/
secret/organizer are all non-empty) mirroring the old `schedule_via_flow()`; when
false, keep issuing local-stub join links so the pipeline stays demoable offline.

---

## 6. Graph API calls — exact reference

Base: `https://graph.microsoft.com/v1.0`. All calls carry
`Authorization: Bearer <app-token>` (§7.1).

### 6.1 Create the meeting — calendar event, **not** `/onlineMeetings`

> **Why not `POST /users/{id}/onlineMeetings`?** The Graph docs are explicit:
> that API "creates a standalone meeting that isn't associated with any event on
> the user's calendar" and **"This API doesn't support meetings created using the
> create onlineMeeting API that aren't associated with an event on the user's
> calendar"** appears on *List transcripts*. Standalone meetings also send no
> invites. A calendar event with `isOnlineMeeting:true` fixes both.

```http
POST /users/{GRAPH_ORGANIZER_USER_ID}/events
Content-Type: application/json
Prefer: outlook.timezone="UTC"

{
  "subject": "EAC Architecture Review — Cloud Data Lake",
  "body": { "contentType": "HTML", "content": "Scheduled via Governance Portal." },
  "start": { "dateTime": "2026-09-10T10:00:00", "timeZone": "UTC" },
  "end":   { "dateTime": "2026-09-10T11:00:00", "timeZone": "UTC" },
  "attendees": [
    { "emailAddress": { "address": "jane@abchealth.com" }, "type": "required" },
    { "emailAddress": { "address": "partner@vendor.com" }, "type": "required" }
  ],
  "isOnlineMeeting": true,
  "onlineMeetingProvider": "teamsForBusiness",
  "allowNewTimeProposals": false
}
```

`201` response — fields we keep:

| Field | Store as | Note |
|---|---|---|
| `id` | `graph_event_id` | for later cancel/delete of the event |
| `onlineMeeting.joinUrl` | `join_url` | the Teams join link (also shown in UI) |
| `iCalUId` | (optional) | cross-system correlation |
| `onlineMeeting` | — | does **not** contain the `onlineMeeting.id` we need for transcripts |

Invites are sent automatically to `attendees`.

**Cancel** (`cancel_meeting` handler): `DELETE /users/{org}/events/{graph_event_id}`
(sends cancellations) — replaces the "local row only" behaviour, or keep
local-only and just `PATCH … {"isCancelled":true}`. Decide in review.

### 6.2 Resolve the `onlineMeeting.id` (correlation key)

```http
GET /users/{GRAPH_ORGANIZER_USER_ID}/onlineMeetings?$filter=JoinWebUrl eq '{join_url}'
```
`OnlineMeetings.Read.All` + Teams app-access-policy. Returns a collection;
`value[0].id` is the `MSo…` string that the transcript notification will carry as
`meetingId`. Store as `graph_online_meeting_id`.

Fallback if the filter returns empty (URL-encoding of the `?context=` fragment in
`joinWebUrl` can defeat exact match): defer resolution to notification time — see §8.

### 6.3 Subscribe to transcripts (once, tenant-wide, kept alive)

```http
POST /subscriptions
Content-Type: application/json

{
  "changeType": "created",
  "notificationUrl":          "{GRAPH_NOTIFICATION_BASE_URL}/api/v1/teams-poc/graph-notifications",
  "lifecycleNotificationUrl": "{GRAPH_NOTIFICATION_BASE_URL}/api/v1/teams-poc/graph-lifecycle",
  "resource": "communications/onlineMeetings/getAllTranscripts",
  "includeResourceData": false,
  "expirationDateTime": "{now + GRAPH_SUBSCRIPTION_MINUTES}",
  "clientState": "{GRAPH_NOTIFICATION_CLIENT_STATE}"
}
```

Hard constraints (from the change-notification docs):

- **Permission:** `OnlineMeetingTranscript.Read.All` (application). Delegated not
  supported.
- **`lifecycleNotificationUrl` is mandatory** for any `expirationDateTime` > 1
  hour — the create call fails without it.
- **"The notification is sent only if the subscription exists *before*
  transcription starts."** ⇒ the subscription must be **continuously alive**, not
  created per meeting. One tenant-wide subscription, renewed by a background task.
- Max expiration for this resource ≈ **4230 minutes (~3 days)**; renew well before.
- On creation Graph immediately `POST`s a **validation request** with a
  `?validationToken=…` query param — we must reply `200` with that token as
  `text/plain` **within 10 seconds** (see §7.4).
- If the tenant admin has disabled Graph access to transcripts, create/renew
  returns `403` with `innerError.code = GraphAccessToTranscriptsDisabled`.

Alternative (not recommended): per-meeting subscription to
`communications/onlineMeetings/{id}/transcripts`, created right after §6.2. More
subscriptions to manage, same "before transcription starts" race, and we'd need
the `onlineMeeting.id` resolved synchronously at schedule time.

### 6.4 Notification payload (plain, `includeResourceData:false`)

```jsonc
{
  "value": [
    {
      "subscriptionId": "…",
      "changeType": "created",
      "clientState": "{GRAPH_NOTIFICATION_CLIENT_STATE}",
      "resource": "users/{organizerId}/onlineMeetings('MSo…')/transcripts('MSM…')",
      "resourceData": {
        "@odata.type": "#Microsoft.Graph.callTranscript",
        "id": "MSM…"
      }
    }
  ]
}
```

Parse `organizerId`, `onlineMeeting id` (`MSo…`), `transcriptId` (`MSM…`) out of
the `resource` string (regex). Verify `clientState` equals
`GRAPH_NOTIFICATION_CLIENT_STATE` — drop the notification if not.

### 6.5 Fetch transcript content

```http
GET /users/{organizerId}/onlineMeetings/{onlineMeetingId}/transcripts/{transcriptId}/content?$format=text/vtt
```

- `OnlineMeetingTranscript.Read.All` + Teams app-access-policy.
- Returns `text/vtt` (WebVTT, `<v Speaker>` tags) — feeds `parse_vtt` directly.
- **Fallbacks:**
  - `403 SpeakerAttributionNotAllowed` → retry with header
    `Accept: application/vnd.microsoft.graph.transcript+text` (plain text, no
    speaker tags). `$format` **cannot** select this — header only.
  - `403 GraphAccessToTranscriptsDisabled` → mark the row `failed` with a
    distinct, **non-retryable** message; do not keep polling.
  - `404` right after the notification → brief retry with backoff (content can
    lag the metadata by seconds).

---

## 7. Code changes — file by file

### 7.1 `backend/src/services/graph_client.rs` — NEW

Thin client-credentials token provider + authed request helper. Raw `reqwest`
(matches how `meeting_agent_service` already calls OpenAI — no Graph SDK for five
endpoints).

```rust
pub struct GraphClient {
    http: reqwest::Client,
    tenant_id: String,
    client_id: String,
    client_secret: String,
    token: tokio::sync::RwLock<Option<CachedToken>>, // {value, expires_at}
}

impl GraphClient {
    /// POST login.microsoftonline.com/{tenant}/oauth2/v2.0/token
    ///   grant_type=client_credentials
    ///   scope=https://graph.microsoft.com/.default
    /// Cache until expires_at - 60s. Single-flight refresh behind the write lock.
    async fn token(&self) -> AppResult<String> { … }

    pub async fn get(&self, path: &str) -> AppResult<reqwest::Response> { … }
    pub async fn post_json<B: Serialize>(&self, path: &str, body: &B) -> AppResult<reqwest::Response> { … }
    pub async fn delete(&self, path: &str) -> AppResult<()> { … }
}
```

- Reuses the shared bounded `reqwest::Client` from `AppState` (connect/overall
  timeouts already added).
- Central error mapping: pull `error.code` / `error.innerError.code` from Graph
  error bodies into `AppError` so callers can branch on
  `GraphAccessToTranscriptsDisabled` etc.
- Add to `AppState`: `graph: Option<Arc<GraphClient>>` (None when `graph_enabled()`
  is false).

### 7.2 `backend/src/services/graph_meeting_service.rs` — NEW (replaces `power_automate_service.rs`)

```rust
pub struct ScheduledMeeting {          // same shape the handler already consumes
    pub join_url: Option<String>,
    pub graph_event_id: Option<String>,
    pub graph_online_meeting_id: Option<String>,
    pub error: Option<String>,
}

/// POST /users/{organizer}/events  (§6.1)  then  GET …/onlineMeetings?$filter=JoinWebUrl eq  (§6.2)
pub async fn schedule_meeting_via_graph(
    graph: &GraphClient, organizer_id: &str,
    subject: &str, start: DateTime<FixedOffset>, end: DateTime<FixedOffset>,
    attendees: &[String],
) -> AppResult<ScheduledMeeting> { … }

/// GET …/transcripts/{id}/content  with the §6.5 fallbacks
pub async fn fetch_transcript_vtt(
    graph: &GraphClient, organizer_id: &str, online_meeting_id: &str, transcript_id: &str,
) -> AppResult<String> { … }

/// DELETE /users/{organizer}/events/{eventId}
pub async fn cancel_event(graph: &GraphClient, organizer_id: &str, event_id: &str) -> AppResult<()> { … }
```

Keep the "never `Err` for a remote problem — return `error: Some(..)` so the row
persists and is retryable" contract that `power_automate_service` had. `delete`
this file.

### 7.3 `backend/src/services/graph_subscription_service.rs` — NEW

- `ensure_subscription(graph, cfg, db)` — on startup: look for a live row in
  `graph_subscriptions`; if none or expiring soon, `POST /subscriptions` (§6.3)
  and upsert `{id, resource, expiration, notification_url}`.
- `spawn_subscription_renewer(graph, cfg, db)` — background task, same pattern as
  `spawn_stuck_meeting_reaper`: every ~6h, `PATCH /subscriptions/{id}` with a new
  `expirationDateTime`; recreate on `404`. Log + alert on repeated failure.
- `handle_lifecycle(payload)` — on `reauthorizationRequired` /
  `subscriptionRemoved`, re-authorize or recreate.

### 7.4 `backend/src/handlers/teams_poc.rs` — MODIFY

**`schedule_meeting`:**
- Replace the `schedule_via_flow()` branch with `graph_enabled()` →
  `graph_meeting_service::schedule_meeting_via_graph(...)`.
- Keep the §4 timestamp validation added in the last review pass.
- Persist `graph_event_id`, `graph_online_meeting_id`, `graph_organizer_user_id`;
  `source = "graph_scheduled"`.
- Local-stub branch unchanged.

**New `POST /api/v1/teams-poc/graph-notifications`** (`graph_notifications` handler):
1. If `?validationToken=` present → return `200 text/plain` with the **raw
   decoded token**, nothing else. (Graph's create/renew handshake.)
2. Else parse `{ "value": [ … ] }`. For each entry:
   - reject unless `clientState == GRAPH_NOTIFICATION_CLIENT_STATE`;
   - regex the `resource` string → `organizerId`, `onlineMeetingId`, `transcriptId`;
   - correlate to a `poc_meetings` row (§8);
   - `fetch_transcript_vtt(...)` → `poc_meeting_service::process_transcript(vtt)`
     (unchanged; its atomic claim already makes duplicate notifications safe).
3. **Return `202` within seconds** — do the fetch + pipeline on a spawned task,
   not inline, so Graph doesn't time out and retry-storm.

**New `POST /api/v1/teams-poc/graph-lifecycle`** (`graph_lifecycle` handler):
same validation-token handshake; hand the body to
`graph_subscription_service::handle_lifecycle`.

**Delete:** `check_ingest_key`, the `x-api-key` logic, `ingest_by_ref`
(`POST /teams-poc/ingest`), and its `IngestByRefRequest` DTO. The by-row-id
`ingest_transcript` (manual paste/upload from the UI) **stays** as-is.

**`cancel_meeting`:** call `graph_meeting_service::cancel_event` when
`graph_event_id` is set, before flipping the row to `cancelled`.

### 7.5 Migration `backend/migration/src/m20260101_000007_teams_graph.rs` — NEW

`poc_meetings` — add nullable columns:

| Column | Type | Purpose |
|---|---|---|
| `graph_event_id` | `string null` | calendar event id (cancel/delete) |
| `graph_online_meeting_id` | `string null` | `MSo…` — transcript correlation key |
| `graph_organizer_user_id` | `string null` | which mailbox hosts it |
| `graph_transcript_id` | `string null` | last processed transcript (idempotency aid) |

New table `graph_subscriptions`:

| Column | Type |
|---|---|
| `id` | `uuid pk` |
| `subscription_id` | `string unique` (Graph's id) |
| `resource` | `string` |
| `notification_url` | `string` |
| `expiration_date_time` | `timestamptz` |
| `client_state` | `string` |
| `created_at` / `updated_at` | `timestamptz` |

Register in `migration/src/lib.rs`. Keep the `source` column free-text; add
`"graph_scheduled"` / `"graph_ingest"` as understood values (frontend
`SOURCE_LABEL` map updated to match — §7.7).

> Existing `external_ref` column: repurpose as a human-facing ref or leave it;
> `friendlyMeetingCode(id)` already derives the display code from the row id, so
> nothing breaks if it's null.

### 7.6 `backend/src/entities/poc_meetings.rs` — MODIFY

Add the four `Option<String>` fields. `MeetingResponse` DTO
(`dto/teams_poc.rs`) — expose `graph_online_meeting_id` only if the UI needs it
for debugging; otherwise keep internal.

### 7.7 `backend/src/main.rs` — MODIFY

```rust
let graph = config.graph_enabled().then(|| {
    Arc::new(GraphClient::new(&config, http.clone()))
});
if let Some(g) = &graph {
    graph_subscription_service::ensure_subscription(g, &config, &db).await?;
    graph_subscription_service::spawn_subscription_renewer(g.clone(), config.clone(), db.clone());
}
// AppState { …, graph, … }
```

Keep `spawn_stuck_meeting_reaper` (still relevant — a transcript fetch or
pipeline run can still strand a row).

### 7.8 `backend/src/routes.rs` — MODIFY

- `+ POST /api/v1/teams-poc/graph-notifications`
- `+ POST /api/v1/teams-poc/graph-lifecycle`
- `- POST /api/v1/teams-poc/ingest`
- Both new routes must be **exempt from any auth middleware** (Graph is
  unauthenticated to us; `clientState` + validation token are the checks).

### 7.9 Frontend — MINIMAL

| File | Change |
|---|---|
| `features/meeting-center/shared.ts` | `SOURCE_LABEL`: `flow_scheduled`→`graph_scheduled` ("Scheduled via Teams"), `flow_ingest`→`graph_ingest` ("Auto-captured transcript"). |
| `MeetingCenterPage.tsx` | Copy: "via Power Automate" → "via Microsoft Teams". Organizer-email field: keep as optional metadata or drop per D4. |
| `MeetingDetailPage.tsx` | No functional change; the manual VTT paste box stays for `scheduled`/`failed`. |
| `lib/teamsPocApi.ts` | Drop any `ingest`-by-ref helper if present; `schedule`/`get`/`list`/`cancel`/`remove`/`ingestTranscript` unchanged. |

No new frontend deps. `bpmn-js` etc. untouched.

### 7.10 Docs

- New: this file.
- Update `TEAMS_MEETING_VTT_POC.md` to describe the Graph path.
- Mark `TEAMS_POWER_AUTOMATE_SETUP.md` **deprecated** (leave for history) or delete.
- `TEAMS_GRAPH_API_MICROSOFT_ADMIN_HANDOFF.md` already exists — align it with §4.

---

## 8. Correlation strategy (event → onlineMeeting → transcript)

**Primary (resolve at schedule time):**
1. `POST /events` → get `onlineMeeting.joinUrl`, store `join_url` + `graph_event_id`.
2. `GET …/onlineMeetings?$filter=JoinWebUrl eq '{join_url}'` → store
   `graph_online_meeting_id` (`MSo…`).
3. Transcript notification arrives with `meetingId = MSo…` → match the row on
   `graph_online_meeting_id`. Exact, O(1).

**Fallback (resolve at notification time)** — used when step 2 returned empty:
1. Row has `join_url` but `graph_online_meeting_id` is null.
2. Notification carries `organizerId` + `onlineMeetingId` in the `resource`
   string. `GET /users/{organizerId}/onlineMeetings/{onlineMeetingId}` →
   compare its `joinWebUrl` to stored `join_url` (normalise: strip the
   `?context=` query, compare origin+path+`meetingId` segment).
3. On match, backfill `graph_online_meeting_id` and proceed.

**Last-resort:** no row matches → behave like today's "unknown ref": if a
`REJECT_UNKNOWN`-style flag is set, `202` and drop; else create a
`source="graph_ingest"` row from the transcript metadata and run the pipeline.

---

## 9. What gets removed

| Removed | Replaced by |
|---|---|
| `services/power_automate_service.rs` | `services/graph_meeting_service.rs` |
| `handlers/teams_poc.rs::ingest_by_ref`, `check_ingest_key` | `graph_notifications` handler |
| `dto::teams_poc::IngestByRefRequest` | notification payload structs |
| env `POWER_AUTOMATE_SCHEDULE_URL`, `INGEST_API_KEY`, `INGEST_REJECT_UNKNOWN` | env in §5 |
| `POST /api/v1/teams-poc/ingest` route | `POST /api/v1/teams-poc/graph-notifications`, `…/graph-lifecycle` |
| `TEAMS_POWER_AUTOMATE_SETUP.md` (active) | this file + admin handoff |

Unchanged: `parse_vtt`, `meeting_agent_service`, `poc_meeting_service`
(`process_transcript`, reaper), the by-id `ingest_transcript` manual path, the
whole React Meeting Center UI, `poc_meetings` core columns.

---

## 10. Testing plan

**Local prerequisites:** `.env` filled (§5), ngrok up
(`GRAPH_NOTIFICATION_BASE_URL` = the ngrok https URL), admin work in §4 done,
organizer mailbox transcription-enabled.

1. **Token** — unit-hit `GraphClient::token()`; assert a bearer is cached and
   reused, refreshed after expiry.
2. **Subscription handshake** — start backend; confirm `ensure_subscription`
   creates a `getAllTranscripts` subscription and the validation-token `200`
   round-trip succeeds (watch backend logs + `GET /subscriptions`).
3. **Schedule** — `POST /teams-poc/meetings` with 2 attendees (1 external);
   assert calendar invite emails arrive, row has `join_url` +
   `graph_online_meeting_id`, meeting shows in Teams/Outlook.
4. **Transcript E2E** — join the meeting from two accounts, **start transcription**,
   talk, end the meeting. Within a few minutes the notification hits
   `graph-notifications`; assert the row goes `scheduled → processing → completed`
   with summary/decisions populated. (Subscription **must** have existed before
   transcription started — restart-order matters in dev.)
5. **Fallbacks** — simulate `403 GraphAccessToTranscriptsDisabled` (temporarily
   revoke, or mock) → row `failed`, non-retryable message, no poll loop.
6. **Duplicate notification** — replay the same notification body → second run
   no-ops (atomic claim in `process_transcript`).
7. **Manual path regression** — paste VTT on a `scheduled` meeting → still works.
8. **Renewal** — force `expiration_date_time` near-past in `graph_subscriptions`;
   confirm the renewer PATCHes / recreates.

---

## 11. Rollout sequence

1. **Admin (blocking):** §4.2 permissions + consent, §4.3 both access policies,
   §4.4 organizer mailbox + transcription policy, fresh client secret. Confirm D5.
2. **Branch:** implement §7 on `poc/teams-meeting-vtt`. Behind `graph_enabled()`
   so an unconfigured env still boots (local-stub).
3. **Dev verify:** run the §10 plan against the real tenant with ngrok.
4. **Deploy to Dev (Render):** set env in the secret store,
   `GRAPH_NOTIFICATION_BASE_URL` = Render URL; `ensure_subscription` re-points the
   subscription at the stable URL. Re-run §10 steps 3–4.
5. **PR** `poc/teams-meeting-vtt → Dev` with this doc + the code review checklist.
6. **Decommission** the Power Automate flow only after Dev E2E passes.

---

## 12. Open risks / watch-items

| Risk | Mitigation |
|---|---|
| Transcription not policy-enabled in tenant (D5) → no transcript ever | Confirm with admin **before** coding; blocks the whole ingest half. |
| `$filter=JoinWebUrl eq` misses due to URL encoding | Notification-time fallback (§8); normalise URLs. |
| ngrok URL rotates → dead subscription | Reserved ngrok domain, or re-run `ensure_subscription` on each restart (it already will). Prod uses the stable Render URL. |
| "Subscription before transcription starts" | Tenant-wide, always-on subscription + renewer; never per-meeting-on-demand. |
| `Calendars.ReadWrite` app-only = every mailbox | Exchange `New-ApplicationAccessPolicy` scoping (§4.3b). |
| Client secret expiry (01/09/2027 shown) | Calendar reminder; move to certificate credential for prod. |
| Graph notification retry storm if handler slow | Return `202` immediately, process async (§7.4). |
| Tenant admin disables Graph transcript access later | Branch on `innerError.code`, surface a clear non-retryable row error. |
| National-cloud / GCC differences | Tenant is commercial cloud — N/A, but don't hard-code `graph.microsoft.com` in more than one place. |

---

## 13. Rough effort

| Area | Size |
|---|---|
| `graph_client.rs` (token cache + error mapping) | S–M |
| `graph_meeting_service.rs` (schedule + transcript fetch + cancel) | M |
| `graph_subscription_service.rs` + renewer | M |
| `teams_poc.rs` handler rewrite (2 webhooks, drop x-api-key path) | M |
| migration + entity + config + routes + main wiring | S |
| frontend copy/label | XS |
| E2E test + admin coordination | M (gated on §4) |

No new crates. Net: ~4 new files, ~5 modified, 1 migration, 1 deletion.
