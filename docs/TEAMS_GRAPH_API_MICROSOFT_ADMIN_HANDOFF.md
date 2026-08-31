# Microsoft Teams + Graph API — Setup Handoff for the Microsoft 365 / Teams Administrator

**Audience:** Microsoft 365 Global Administrator (or Cloud Application Administrator) **+** Teams Administrator.
**Requested by:** Project Governance Portal team.
**Purpose:** Grant the Governance Portal backend permission to (a) create Microsoft Teams meetings on behalf of designated organizer accounts, and (b) read those meetings' transcripts automatically after the meeting ends.
**Effort:** ~30–45 min of admin work + up to 30 min for a Teams policy to propagate.

---

## 1. What this integration does (and does not do)

The portal lets a user schedule a Teams meeting from the app. When that meeting ends with transcription on, the portal pulls the `.vtt` transcript and runs it through an AI step that produces a summary, decision list, action items and an optional process diagram, attached to the governance record.

**Authentication model: app-only (client credentials).** There is **no user sign-in**, no delegated access, no refresh tokens. A single Entra app registration authenticates as itself and acts with the **organizer's** authority — but only for organizer accounts you explicitly authorize via a Teams *application access policy*.

| The app **can** (once you complete this setup) | The app **cannot** |
|---|---|
| Create Teams online meetings for the specific organizer account(s) you authorize | Create meetings for any other user |
| Read the transcript of meetings organized by those account(s) | Read chats, emails, files, calendars, or meeting *content*/recordings |
| Receive a Graph change-notification when a new transcript is available | Join meetings, act as a participant, or see participant identities beyond the transcript text |
| — | Access anything for users outside the application access policy |

The "only participants can view the transcript" tenant restriction does **not** block this: that is a Teams/Stream front-end ACL. The Graph app-only path is a separate, admin-sanctioned backend channel, and an organizer can always read their own meeting's transcript.

---

## 2. What we need back from you

Please return these five values (secure channel — the client secret is a credential):

| # | Value | Looks like | Where you get it |
|---|---|---|---|
| 1 | **Directory (tenant) ID** | GUID | App registration → Overview |
| 2 | **Application (client) ID** | GUID | App registration → Overview |
| 3 | **Client secret value** | ~40-char string | App registration → Certificates & secrets (copy at creation time — it is shown once) |
| 4 | **Organizer account object ID** | GUID | Entra ID → Users → *(the account meetings are booked as)* → Object ID |
| 5 | **Organizer account UPN / email** | user@pdshealth.com | same user record |

Also confirm:
- [ ] Application permissions **admin-consented** (step 5)
- [ ] Teams **application access policy** created and assigned to the organizer account(s) (step 6)
- [ ] **Transcription allowed** in the meeting policy assigned to the organizer account(s) (step 7)
- [ ] The portal's public notification URL is reachable from Microsoft (step 8 — mostly our infra team, listed so you're aware)

---

## 3. Prerequisites

- Role: **Global Administrator** or **Cloud Application Administrator** (for the app registration + admin consent), **and** **Teams Administrator** (for the application access policy and meeting policy).
- **Microsoft Teams PowerShell module** on your workstation:
  ```powershell
  Install-Module MicrosoftTeams -Scope CurrentUser
  ```
- Decide **which account(s)** meetings will be booked as. Recommended: a dedicated service/room-style account (e.g. `governance-meetings@pdshealth.com`) rather than a person, so the integration is not tied to an individual's lifecycle. One account is enough to start.

---

## 4. Step 1 — Create the Entra ID app registration

1. **Entra admin center** (entra.microsoft.com) → **Identity → Applications → App registrations → + New registration**.
2. **Name:** `Governance Portal – Teams Meetings`
3. **Supported account types:** *Accounts in this organizational directory only (single tenant)*.
4. **Redirect URI:** leave blank (app-only, no interactive sign-in).
5. **Register.**
6. On the **Overview** page, copy **Directory (tenant) ID** → value **#1**, and **Application (client) ID** → value **#2**.

---

## 5. Step 2 — Create a client secret

1. In the app registration → **Certificates & secrets → Client secrets → + New client secret**.
2. **Description:** `governance-portal backend`
3. **Expires:** 12 months (recommended; set a calendar reminder to rotate — see §10).
4. **Add**, then **immediately copy the `Value` column** → value **#3**. It is not retrievable later.

*(A certificate instead of a secret is supported by Graph and is more secure; the portal currently reads a secret. If you prefer certificate auth, tell us and we'll switch — it's a small config change.)*

---

## 6. Step 3 — Add application permissions + grant admin consent

1. App registration → **API permissions → + Add a permission → Microsoft Graph → Application permissions**.
2. Add exactly these two (search by name), both **Application** type — **not** Delegated:

   | Permission | Why the portal needs it |
   |---|---|
   | `OnlineMeetings.ReadWrite.All` | Create the Teams meeting (`POST /users/{organizer}/onlineMeetings`) and look up its transcript list |
   | `OnlineMeetingTranscript.Read.All` | Download the meeting transcript as WebVTT; create the transcript change-notification subscription |

3. Click **Grant admin consent for <tenant>** and confirm. Both rows must show **Granted**.

> These are broad-sounding (`.All`) because Graph does not offer a narrower application scope for these operations. Access is then **constrained to specific users** by the application access policy in the next step — without that policy the app can call the endpoints but every call returns `403`.

---

## 7. Step 4 — Teams application access policy (scopes the app to specific organizers)

Run in an elevated PowerShell:

```powershell
Connect-MicrosoftTeams

# 1. Create a policy that references THIS app registration (value #2)
New-CsApplicationAccessPolicy `
  -Identity  "GovernancePortal-Meetings" `
  -AppIds    "<APPLICATION_CLIENT_ID>" `
  -Description "Governance Portal – create meetings & read transcripts for governance service account"

# 2. Grant it to each organizer account (value #5 or #4). Repeat -Identity per account.
Grant-CsApplicationAccessPolicy `
  -PolicyName "GovernancePortal-Meetings" `
  -Identity   "governance-meetings@pdshealth.com"
```

- Do **not** use `Grant-CsApplicationAccessPolicy -Global` — that would authorize the app for **every** user in the tenant. Assign per organizer account only.
- Propagation can take **up to 30 minutes**.
- To verify later: `Get-CsApplicationAccessPolicy -Identity "GovernancePortal-Meetings"` and `Get-CsOnlineUser governance-meetings@pdshealth.com | Select ApplicationAccessPolicy`.

---

## 8. Step 5 — Allow transcription for the organizer account(s)

The transcript only exists if transcription runs during the meeting.

1. **Teams admin center** (admin.teams.microsoft.com) → **Meetings → Meeting policies**.
2. Open the policy assigned to the organizer account(s) (or create a dedicated one and assign it).
3. Set **Transcription = On**. (Also ensure **Meeting recording** is not blocked if you want recordings; not required for transcripts.)
4. Optional but recommended: set the meeting template / policy so transcription **auto-starts**, so organizers don't have to remember to click "Start transcription".
5. Assign the policy to the organizer account(s) if not already: **Users → <account> → Policies → Meeting policy**.

Menu labels shift between Teams admin center releases; the setting is consistently called *Transcription* under *Meeting policies*.

---

## 9. Step 6 — Notification endpoint reachability (mostly our infra team — for your awareness)

For automatic transcript ingest, Microsoft Graph must be able to `POST` to a public HTTPS URL on the portal:

```
https://<portal-public-host>/api/v1/teams-poc/webhooks/graph/transcripts
```

- Must be **HTTPS with a valid public CA certificate**, reachable from Microsoft's cloud (not internal-only).
- On subscription creation Graph sends a one-time validation `GET` with a `validationToken` query parameter; the portal echoes it back. This is already implemented.
- If the portal is behind a firewall/WAF, allow inbound from the Microsoft Graph change-notifications service. Microsoft publishes these IP ranges in the *Microsoft 365 IP Address and URL web service* (the "MEM"/"Microsoft 365 common" and "Skype/Teams" sections); the Graph notification service also documents its egress ranges. Share the portal's public host with us and we'll coordinate.
- **Without** this endpoint, everything else still works — transcripts just have to be ingested manually (paste/upload the `.vtt`, or a Power Automate flow — see §12).

---

## 10. Step 7 — Hand the values back

Fill in and return via a secure channel:

```
GRAPH_TENANT_ID              = <#1 Directory (tenant) ID>
GRAPH_CLIENT_ID              = <#2 Application (client) ID>
GRAPH_CLIENT_SECRET          = <#3 client secret value>
GRAPH_DEFAULT_ORGANIZER_ID   = <#4 organizer account Object ID (GUID, NOT the email)>
GRAPH_DEFAULT_ORGANIZER_EMAIL= <#5 organizer UPN / email>
```

Plus the confirmation checklist from §2.

---

## 11. How we install and verify (portal team — after we receive the values)

> This section is for the portal team, included so the admin can see the end-to-end check.

The values go into **`backend/.env`** (never committed — it's git-ignored):

```dotenv
GRAPH_TENANT_ID=00000000-0000-0000-0000-000000000000
GRAPH_CLIENT_ID=00000000-0000-0000-0000-000000000000
GRAPH_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GRAPH_DEFAULT_ORGANIZER_ID=00000000-0000-0000-0000-000000000000
GRAPH_DEFAULT_ORGANIZER_EMAIL=governance-meetings@pdshealth.com
GRAPH_WEBHOOK_CLIENT_STATE=<generate a random 32+ char string>
GRAPH_NOTIFICATION_URL=https://<portal-public-host>/api/v1/teams-poc/webhooks/graph/transcripts
```

- `graph_configured()` flips on when `GRAPH_TENANT_ID` + `GRAPH_CLIENT_ID` + `GRAPH_CLIENT_SECRET` are all present. The other keys are needed for full function.
- `GRAPH_WEBHOOK_CLIENT_STATE` is a shared secret we generate; Graph echoes it in every notification and the portal rejects any notification that doesn't match. It is **not** something the admin provides.
- Restart the backend after editing `.env`.

Verification sequence:
1. Backend boots, `graph_configured()` true.
2. **Schedule a meeting** in the portal `/teams-poc` page → a real Teams meeting is created; a `joinWebUrl` comes back (proves app permission + application access policy + admin consent).
3. `POST /api/v1/teams-poc/subscriptions/renew` → Graph accepts the `communications/onlineMeetings/getAllTranscripts` subscription (proves `OnlineMeetingTranscript.Read.All` + notification URL reachability + validation handshake).
4. Hold a short real meeting **with transcription on**; end it. Within ~2–10 min Graph calls the webhook → portal downloads the `.vtt` → the meeting flips to `completed`. End-to-end proven.

---

## 12. Lower-effort alternative — Power Automate (no app registration)

If the app-registration + PowerShell route is not desired for a first pilot, the same result is achievable with a **Power Automate** flow:

`Trigger: "When a transcript is available" (Teams)` → `Get meeting transcript (VTT)` → `HTTP: POST { "vtt_text": "<content>" }` to `https://<portal-public-host>/api/v1/teams-poc/meetings/{id}/ingest-transcript`.

Still requires: the flow's connection account to be the meeting organizer (or covered by an application access policy), and Transcription enabled (§8). It avoids §4–§7 and §9. The portal endpoint is identical, so you can start here and switch to the Graph subscription later with no backend change.

---

## 13. Security & governance notes

- **Least privilege by user:** the `.All` Graph permissions are tenant-wide *as granted*, but the **application access policy (§7) is the real boundary** — the app can only touch users explicitly assigned that policy. Keep the assigned set to the governance organizer account(s).
- **Dedicated organizer account:** use a service/shared account, not a person. Disable interactive sign-in / require it be exempt from anything that would block Graph.
- **Secret rotation:** the client secret expires (§5). Set a reminder ~30 days before expiry; we can accept a new secret with zero downtime by overlapping validity. Consider moving to **certificate credentials** for longer life and no plaintext secret.
- **Revocation:** removing the application access policy assignment, revoking admin consent, or deleting the secret each independently disables the integration immediately.
- **Data path / PHI:** the transcript text is sent to an external LLM API for summarization. Before this is used on meetings that may contain PHI or other regulated content, the portal team must route that call through **Azure OpenAI under the organization's BAA** (tracked as a pre-production item). Flag to your compliance team if governance meetings routinely discuss clinical or member data.
- **Audit:** every Graph call the portal makes is app-only against `graph.microsoft.com/v1.0`: `POST /users/{organizer}/onlineMeetings`, `GET .../transcripts`, `GET .../transcripts/{id}/content?$format=text/vtt`, `POST /subscriptions`. These appear in the Entra sign-in logs (service principal sign-ins) and Graph activity logs under the app's client ID.

---

## 14. Quick reference — everything the admin creates

| Artifact | Name we suggest | Scope |
|---|---|---|
| Entra app registration | `Governance Portal – Teams Meetings` | single tenant, no redirect URI |
| Client secret | `governance-portal backend` | 12-month expiry |
| Graph application permissions | `OnlineMeetings.ReadWrite.All`, `OnlineMeetingTranscript.Read.All` | admin-consented |
| Teams application access policy | `GovernancePortal-Meetings` | assigned to organizer account(s) only |
| Teams meeting policy setting | *Transcription = On* | policy assigned to organizer account(s) |
