# Microsoft Graph meeting integration — state and remaining work

Diagnosis of the reported meeting bugs (meeting not on the organizer's calendar,
attendees not invited, transcript never auto-processed) and the plan to close
them.

## Root causes

| Symptom | Cause |
|---|---|
| Meeting not on the organizer's calendar | `schedule_via_graph` called `POST /users/{organizer}/onlineMeetings` — a join link only, no calendar entry. |
| Attendees got no invite | Same call. `/onlineMeetings` `participants` only pre-authorises join; only a calendar `/events` with `attendees[]` emails invites. Attendees were also never persisted. |
| Meeting shows "live" past its end time | `/onlineMeetings` links have no hard end; `endDateTime` is metadata. Teams keeps the room joinable. The real fix is auto-processing the transcript when the meeting actually ends, not forcing the room shut. |
| Transcript never auto-processed | No trigger exists. `process_transcript` is only reachable via the manual `processTranscript` GraphQL mutation. There is no tenant-wide Graph subscription, no `/graph-notifications` webhook, and no renewer task: `graph_subscriptions` is empty, there is no `tokio::spawn` anywhere, and `graph/auth.rs` records that "webhook ingress isn't built". |

## Current behaviour — calendar-backed scheduling

`WriteOperation::ScheduleCalendarEvent` → `POST /users/{organizer}/events`
(`isOnlineMeeting: true`, `onlineMeetingProvider: "teamsForBusiness"`,
`attendees[]` as `{emailAddress:{address}, type:"required"}`). `schedule_via_graph`
persists `graph_event_id`, resolves + persists `graph_online_meeting_id` from the
join URL, persists `attendees` / `graph_organizer_user_id` / start+end. Cancel
prefers `CancelCalendarEvent` (`DELETE /events/{id}` → sends cancellations) when
`graph_event_id` is set.

Live-verified against a real tenant: calendar event created, online-meeting id
resolved, self-invite attendee persisted, cancel sent.

## Current behaviour — directory search

`User.search_directory` → `services::directory` → `ReadOperation::SearchDirectoryUsers`
(`GET /users?$search`). Live-verified: returns real org-directory users.

## Remaining work — organizer availability (getSchedule)

`ReadOperation::CheckOrganizerAvailability` already exists (`#[allow(dead_code)]`,
`POST /users/{organizer}/calendar/getSchedule`). To wire it:

1. `.appfw/model/schemas/governance/entity_types/meeting.yaml` — add a
   `check_availability` custom method (args: `start_time`, `end_time`,
   `organizer?`; `return_type: serde_json::Value`).
2. Regenerate (`scripts/appfw product generate` in the rust-appfw container).
3. `backend/src/handlers/governance/meeting.rs` — `check_availability_impl` →
   `services::meeting_scheduling::check_availability(...)`.
4. New `meeting_scheduling::check_availability` — `GraphClient::read(
   ReadOperation::CheckOrganizerAvailability { organizer, schedules:
   [organizer_email], start_iso, end_iso })`, map `scheduleItems` where
   `status != "free"` to a `conflicts[]` list. Advisory only — never blocks.
5. Remove the `#[allow(dead_code)]` from the enum variant.

Frontend: call it from the schedule dialog and show a soft "organizer is busy
then" warning.

## Remaining work — automatic transcript processing on meeting end

The trigger: a **tenant-wide** Graph change-notification subscription on
`communications/onlineMeetings/getAllTranscripts`, kept alive by a renewer, with
a public webhook receiver that fetches the VTT and runs the existing
`meeting_transcript::process_transcript`.

### Config (already in `backend/.env`)

```
GRAPH_NOTIFICATION_BASE_URL=https://pdsgovernance.onrender.com
GRAPH_NOTIFICATION_CLIENT_STATE=<redacted — rotate and store as a deployment secret>
GRAPH_SUBSCRIPTION_MINUTES=4230
```

For Graph to validate the subscription callback, the backend must be deployed at
`GRAPH_NOTIFICATION_BASE_URL` — Graph POSTs `?validationToken=…` to
`{BASE}/internal/graph/notifications` and needs a 200 echo within 10s at
subscription-creation time. `backend/Dockerfile` exists; the deploy is a
separate step.

### Work

1. **`services/graph/subscription.rs`** (new):
   - `notification_url(cfg)` = `{BASE}/internal/graph/notifications`,
     `lifecycle_url(cfg)` = `{BASE}/internal/graph/lifecycle`.
   - `ensure_subscription(data_access)` — read the one `GraphSubscription` row;
     if missing / expiring < 6h / URL changed, `DELETE /subscriptions/{id}` then
     `WriteOperation::CreateSubscription { resource:
     "communications/onlineMeetings/getAllTranscripts", notification_url,
     client_state, expiration_iso }` via `writes::execute` with a **system**
     `WriteContext` (new: `WriteContext::system()` — subscription mgmt is not a
     user action; policy action `manage_subscription`). Persist the row
     (`InputGraphSubscription`).
   - `renew_once` — `RenewSubscription` (`PATCH`) when < 12h to expiry;
     recreate on 404.
   - `spawn_renewer(data_access)` — `tokio::spawn` a `tokio::time::interval(6h)`
     loop.
   - `CreateSubscription`/`RenewSubscription`/`DeleteSubscription` already exist
     in `writes.rs` — remove their `#[allow(dead_code)]`, add the
     `changeType`/`lifecycleNotificationUrl` this resource needs (currently
     `"created,updated"`; getAllTranscripts wants `"created"` +
     `lifecycleNotificationUrl` mandatory for > 1h expiry).

2. **`services/graph/webhook.rs`** (new) — a plain `axum::Router` (no auth,
   verified by `clientState`):
   - `POST /internal/graph/notifications`:
     - if `?validationToken=…` present → return `200 text/plain` with the
       decoded token (within 10s), do nothing else.
     - else parse `{ value: [ { clientState, resource, … } ] }`; drop any whose
       `clientState != GRAPH_NOTIFICATION_CLIENT_STATE`; for each transcript
       resource, `parse_transcript_resource` → `{organizer, online_meeting_id,
       transcript_id}` (lenient: pull `onlineMeetings(...)` / `transcripts(...)`
       from anywhere; fall back to `GRAPH_DEFAULT_ORGANIZER_ID`).
     - correlate to a `meetings` row by `graph_online_meeting_id`; if miss,
       backfill: `GET /users/{org}/onlineMeetings/{id}` → `joinWebUrl` → match a
       `graph_scheduled` row → set its `graph_online_meeting_id`.
     - only ingest rows whose status is `graph_scheduled` / `failed`.
     - fetch VTT via `ReadOperation::GetOnlineMeetingTranscript` (already exists;
       retry 404/429/5xx with linear backoff — the `/content` body lags the
       notification by minutes).
     - call `meeting_transcript::process_transcript` with the VTT as the payload
       (`{ transcript_vtt: <text> }` — check its payload contract); on success
       persist `graph_transcript_id`; on fetch failure mark the row `failed`
       with the reason (re-ingestable via the manual paste path).
     - always return `202`.
   - `POST /internal/graph/lifecycle` — `reauthorizationRequired` →
     `ensure_subscription`; `subscriptionRemoved` → recreate. Echo
     `validationToken` the same way.

3. **`main.rs`** (product-owned — the injection point, since `routes/mod.rs` is
   generated):
   ```rust
   let routes = get_routes(...).await?;
   let routes = routes.merge(services::graph::webhook::routes(governance_data_access.clone()));
   // after config init, before serve_http_router:
   if let Some(da) = /* governance data access */ {
       services::graph::subscription::spawn_renewer(da.clone());
       tokio::spawn(async move { let _ = services::graph::subscription::ensure_subscription(&da).await; });
   }
   ```
   `get_routes` currently owns the data-access handles internally — either
   return one from it, or build a second handle in `main.rs` the same way
   `create_data_access_for_schema` does.

4. **`meeting_transcript::process_transcript`** — confirm it accepts a
   webhook-supplied VTT (not only a Graph read or a paste). Its step 1 is
   "obtain the transcript — a governed Graph READ … OR a manually pasted VTT".
   The webhook path passes the already-fetched text; make sure that shape is
   accepted and it still runs the PHI gate + extraction.

5. **`GraphSubscription` entity** — `handlers/governance/graph_subscription.rs`
   is a bare stub. The subscription row is written by the service, not a user
   mutation, so no custom method is needed — but confirm `InputGraphSubscription`
   has `subscription_id`, `resource`, `notification_url`, `client_state`,
   `expiration_date_time`.

### Testing

- **Webhook ingest path (local):** POST a synthetic notification body to
  `http://127.0.0.1:8080/internal/graph/notifications` with a real
  `online_meeting_id` from a scheduled meeting and a real `transcript_id` (grab
  one from a meeting that actually ran + was transcribed), verify the row goes
  `graph_scheduled → transcript_captured` with `summary`/`decisions` populated.
- **Subscription creation:** requires the backend deployed at
  `GRAPH_NOTIFICATION_BASE_URL`. After deploy, hit an admin/startup path that
  calls `ensure_subscription`, confirm a `graph_subscriptions` row and a live
  subscription (`GET /subscriptions`).
- **Full E2E:** schedule a meeting, run it in Teams with transcription on, end
  it, wait for the notification, confirm the transcript is processed with no
  manual step.

## Intentionally not ported

The following legacy meeting-adjacent features are intentionally out of scope
for the rebuild: the Power Automate path, `mock_docs`, the 5 bespoke gate-review
forms, committee panels, the BPMN viewer, and the blockchain-audit widget.
