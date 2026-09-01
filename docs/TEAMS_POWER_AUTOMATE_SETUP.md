# Teams Meeting + VTT — Power Automate Setup

This is the **chosen route**. No Microsoft Graph, no Entra app registration, no
client secret, no admin consent, no `New-CsApplicationAccessPolicy`. Two Power
Automate flows do the work; the portal only makes/receives plain HTTPS calls.

> The Graph alternative is kept for reference in
> `TEAMS_GRAPH_API_MICROSOFT_ADMIN_HANDOFF.md` but is **not** what we're using.

---

## TL;DR — your three questions

**Q. Does this need a dedicated Teams account to act as organizer, or can it be my personal account?**
**Your personal account is fine.** A Power Automate flow's Teams connection runs
as whoever signed it in (you). The *Create a Teams meeting* action makes **you**
the organizer; the transcript trigger fires for meetings **you** organized. No
service account, no `GRAPH_DEFAULT_ORGANIZER_ID`, no access policy.
Trade-offs if you *later* want a dedicated account: the flows break if your
account is disabled, every portal-scheduled meeting lands in your personal
calendar, and only you can edit the connection. For a pilot, personal is correct.

**Q. Are VTT files processed only from meetings scheduled from our app?**
That is **entirely controlled by the flow you build**, plus one backend switch:

| `INGEST_REJECT_UNKNOWN` in `backend/.env` | `POST /teams-poc/ingest` behaviour |
|---|---|
| `false` (default) | Any transcript the flow sends is processed. If `meeting_ref` is new, a row is created (`source = flow_ingest`). |
| `true` | A transcript whose `meeting_ref` doesn't match a meeting **scheduled through the portal** is rejected `404`. Only our meetings get processed. |

So: set `INGEST_REJECT_UNKNOWN=true` for "portal meetings only", or build the
transcript flow to only forward the meetings you care about (filter by subject
prefix, category, a SharePoint allow-list, etc.).

**Q. Can we both schedule a meeting and process the VTT?**
Yes — two independent flows (below). Scheduling needs Flow A; VTT processing
needs Flow B. You can run either alone.

---

## What the code now does

| Endpoint | Who calls it | Purpose |
|---|---|---|
| `POST /api/v1/teams-poc/meetings` `{subject,start_time,end_time,organizer_email?}` | Portal UI | If `POWER_AUTOMATE_SCHEDULE_URL` is set → the portal POSTs those fields to **Flow A** and stores the `join_url` / `meeting_ref` it returns (`source = flow_scheduled`). If unset → a local-stub join link (`source = local_stub`). A flow error never fails the request — the row is saved with `error_message` so you can retry. |
| `POST /api/v1/teams-poc/meetings/{id}/ingest-transcript` `{vtt_text}` | Portal UI (paste/upload); a flow that scheduled via the portal | Runs the AI pipeline on that row. |
| `POST /api/v1/teams-poc/ingest` `{meeting_ref, vtt_text, subject?, start_time?, end_time?, organizer_email?}` | **Flow B** | Correlates to a row by `meeting_ref`; creates one if new (unless `INGEST_REJECT_UNKNOWN`). **Idempotent** — a `meeting_ref` already `processing`/`completed` is returned unchanged, so a flow retry after a slow response won't double-process or double-bill OpenAI. Guarded by `INGEST_API_KEY` (`x-api-key` header) when set. |

`.env` keys (all optional; blank = local-stub / open):

```dotenv
POWER_AUTOMATE_SCHEDULE_URL=      # Flow A trigger URL
INGEST_API_KEY=                   # shared secret for POST /teams-poc/ingest
INGEST_REJECT_UNKNOWN=false       # true = portal-scheduled meetings only
```

---

## Step 0 — the one admin action

Send your Microsoft 365 / Teams admin this:

> Please enable **Teams admin center → Meetings → Meeting settings → Transcript
> API access → Microsoft Graph access = On**, and under **Configure** set
> **Include speaker attribution = On**.
> PowerShell equivalent:
> `Set-CsTeamsMeetingConfiguration -Identity Global -EnableGraphTranscriptAccess $true -EnableAttributedTranscripts $true`
> This is a tenant-wide setting. It gates *all* programmatic transcript access —
> a Power Automate flow can't read meeting transcripts until it's on. Also
> please confirm I have a **Power Automate Premium** license (the HTTP action is
> a premium connector).

Verify (admin): `Get-CsTeamsMeetingConfiguration -Identity Global | Select EnableGraphTranscriptAccess, EnableAttributedTranscripts` → both `True`. Propagation can take a few hours.

Nothing else from the admin. It applies to meetings held **after** it's enabled.

**Detailed admin GUI steps:**
1. admin.teams.microsoft.com → **Meetings → Meeting settings**.
2. **Transcript API access** section → **Microsoft Graph access** → **On**.
3. Click **Configure** → **Include speaker attribution** → **On**. (The VTT is
   far less useful without `Speaker: text` lines — the pipeline's summary and
   quote extraction rely on them.)
4. The "allow/block specific apps" link in that panel → leave default (not
   needed for the delegated Power Automate route).
5. **Save.**

---

## Step 1 — make the backend reachable from Power Automate

Power Automate runs in Microsoft's cloud and **cannot** reach `localhost`.

- **Pilot:** `ngrok http 8000` → gives `https://<id>.ngrok-free.app`. Free-tier URL changes on restart.
- **Proper:** deploy the backend behind a stable public HTTPS hostname.

Call this `BACKEND` below. Only **Flow B** needs it (Flow A is called *by* the
portal, not the other way round).

Because `/teams-poc/ingest` will be internet-reachable, set a strong
`INGEST_API_KEY` in `backend/.env` and restart. Flow B will send it as a header.
(The portal UI never calls `/ingest`, so it needs no key.)

---

## Step 2 — Flow A: schedule a Teams meeting

**Trigger:** *When a HTTP request is received* (Request connector).
- Request body JSON schema:
  ```json
  { "type": "object",
    "properties": {
      "subject": { "type": "string" },
      "start_time": { "type": "string" },
      "end_time": { "type": "string" },
      "organizer_email": { "type": "string" } } }
  ```
- Save the flow once to generate the **HTTP POST URL** → put it in
  `backend/.env` as `POWER_AUTOMATE_SCHEDULE_URL`, restart the backend.

**Action:** *Create a Teams meeting* (Microsoft Teams connector; sign the
connection in as yourself).
- Subject = `triggerBody()?['subject']`
- Start time = `triggerBody()?['start_time']`
- End time = `triggerBody()?['end_time']`

**Action:** *Response* (Request connector).
- Status = `200`
- Body:
  ```json
  { "join_url": "@{outputs('Create_a_Teams_meeting')?['body/joinWebUrl']}",
    "meeting_ref": "@{outputs('Create_a_Teams_meeting')?['body/onlineMeetingId']}" }
  ```
  (`meeting_ref` — use whatever stable id the action returns; `onlineMeetingId`,
  the meeting `id`, or the join URL itself. It just has to match what Flow B
  will send.)

Test: in the portal `/teams-poc` page, **Schedule a meeting**. The row should
show `source: flow_scheduled` and a real **Join link**. If it shows an
`error_message`, open the flow run history — the message is the flow's response
verbatim.

---

## Step 3 — Flow B: forward the transcript

**Trigger — pick one:**

- **3a. Event:** *When a transcript is available for a meeting I organized*
  (Teams connector). Simple, but Microsoft's native trigger has historically
  been flaky.
- **3b. Scheduled (recommended):** *Recurrence* every 15–30 min →
  *List my recent online meetings* → for each, list transcripts → skip ones
  already sent (track processed transcript IDs in a small SharePoint list or
  Dataverse table, or call `GET {BACKEND}/api/v1/teams-poc/meetings` and skip
  refs already present).

**Action — get the VTT content:**
- If the Teams connector exposes *Get meeting transcript* → choose **VTT** /
  text output.
- Otherwise add the **HTTP with Microsoft Entra ID (preauthorized)** connector
  (delegated — signs in as *you*, still no app registration) and call:
  `GET https://graph.microsoft.com/v1.0/me/onlineMeetings/{meetingId}/transcripts/{transcriptId}/content?$format=text/vtt`

**Action — HTTP POST to the backend:**
- Method `POST`
- URI `{BACKEND}/api/v1/teams-poc/ingest`
- Headers:
  ```
  Content-Type: application/json
  x-api-key: <the INGEST_API_KEY you set>
  ```
- Body:
  ```json
  { "meeting_ref": "<same id Flow A returned for this meeting>",
    "subject": "<meeting subject>",
    "start_time": "<meeting start ISO8601>",
    "end_time": "<meeting end ISO8601>",
    "vtt_text": "<the VTT string from the previous step>" }
  ```
  Pass `vtt_text` through the expression editor so newlines/quotes are escaped
  as valid JSON.
- This call is **synchronous** and can take 10–60 s (OpenAI). Power Automate's
  default 120 s HTTP timeout covers it. The endpoint is idempotent, so if a
  timeout does trigger a retry, the second call returns the row as-is.

**Action (optional):** on non-2xx, or if the response `status` field is
`"failed"`, post yourself a Teams message with the response `error_message`.

---

## Step 4 — behaviour per meeting

- **You must be the organizer** (automatic for meetings you schedule / that
  Flow A creates as you).
- **Transcription must actually run** — click *Start transcription* in the call,
  or set it to auto-start via meeting options / your meeting template.
- Transcript is available ~2–10 min after the meeting ends.
- Only meetings held **after** the Step 0 toggle is on will work.

---

## Step 5 — end-to-end test

1. `curl {BACKEND}/api/v1/teams-poc/meetings` from outside your network → 200.
2. Portal → **Schedule a meeting** → real join link appears (`flow_scheduled`).
3. Join that meeting, **Start transcription**, say two decisions and an action
   item aloud, end the meeting.
4. Wait for Flow B (or run the scheduled flow).
5. Portal → the meeting flips `scheduled → processing → completed` with a
   summary, decisions, action items. (`OPENAI_API_KEY` is already set, so the
   AI step produces real output.)

---

## Your checklist

- [ ] Admin: enable Transcript API access + speaker attribution (Step 0)
- [ ] Admin: confirm Power Automate **Premium** license
- [ ] Expose the backend publicly; set `INGEST_API_KEY`; restart (Step 1)
- [ ] Build **Flow A**; put its URL in `POWER_AUTOMATE_SCHEDULE_URL`; restart (Step 2)
- [ ] Build **Flow B** with the `x-api-key` header (Step 3)
- [ ] Decide scope: `INGEST_REJECT_UNKNOWN=true` for portal-only, or filter in Flow B
- [ ] Turn on transcription in your meetings (Step 4)
- [ ] Run the end-to-end test (Step 5)
