# Microsoft 365 / Teams admin runbook — Governance Portal ↔ Graph API

**Audience:** the person(s) holding these tenant roles — you may need all four:

| Task | Role required |
|---|---|
| Add Graph permissions to the app, grant admin consent | **Global Administrator** or **Privileged Role Administrator** + **Cloud Application Administrator** |
| Create the Teams application access policy | **Teams Administrator** (or Global Admin) |
| Create the Exchange application access policy | **Exchange Administrator** (or Global Admin) |
| Enable meeting transcription policy | **Teams Administrator** |

**Requested by:** Project Governance Portal engineering team.
**Time:** ~45 min of work + up to ~30 min for Teams policy propagation.
**Change type:** grants one existing Entra app the ability to create Teams
meetings for **one designated mailbox** and read **that mailbox's** meeting
transcripts. No user sign-in, no access to mail/files/chats.

---

## 0. What this integration does

The Governance Portal backend authenticates to Microsoft Graph **as an
application** (client-credentials / app-only — no user logs in). With the access
you grant below it will:

1. **Create a Teams meeting** by creating a calendar event on a single service
   mailbox (`isOnlineMeeting = true`), which also emails invitations to the
   attendees the portal user chose.
2. **Be notified** by Graph when that meeting's transcript becomes available
   after the meeting ends.
3. **Download the transcript** (`.vtt` text) and run it through an internal AI
   summarisation step.

It will **not**: sign in as any user, read anyone's mailbox / files / chat /
calendar contents beyond the one service mailbox's calendar, join meetings, see
attendee identities beyond what the transcript text contains, or touch any
mailbox outside the two access policies you create.

---

## 1. The Entra application (already registered)

```
Display name : Governance Portal-Team Meeting
Client ID    : cb2fd374-0701-49fe-aec3-5642617354f7
Object ID    : b9d0d278-26ea-435f-9114-f09b1e561619
Tenant ID    : 19a8fbac-4bc6-4e82-a386-f7a6866a9a1e
```

You do not need to create anything in **App registrations** — only add
permissions (Step 3) and manage its secret (Step 7).

---

## 2. Decide the organizer mailbox

Every meeting the portal creates is hosted on **one mailbox's calendar**. That
mailbox is the meeting *organizer*.

**Recommended:** a dedicated licensed account, e.g.
`governance-meetings@abchealth.com`, **not** a person's personal mailbox — it
survives staff changes and keeps portal meetings out of anyone's personal
calendar.

Requirements for that mailbox:

- A licence that includes **Exchange Online** and **Microsoft Teams** (e.g.
  Microsoft 365 Business Basic or above, or Teams Essentials + Exchange).
- It does **not** need to be a shared mailbox; a normal licensed user account is
  simpler for Teams policy assignment.

**Return to the engineering team:** this mailbox's **UPN** (e.g.
`governance-meetings@abchealth.com`) and its **Entra user object ID**
(Entra admin center → Users → that user → *Object ID*).

---

## 3. Add Microsoft Graph application permissions + grant admin consent

Entra admin center → **Identity → Applications → App registrations** →
*Governance Portal-Team Meeting* → **API permissions**.

**Add permission → Microsoft Graph → Application permissions**, add these three:

| Permission | Purpose in this integration |
|---|---|
| `Calendars.ReadWrite` | Create / update / cancel the calendar event that hosts each Teams meeting and sends the invites. |
| `OnlineMeetings.Read.All` | Look up the Teams *online meeting* record for an event we created (to get the meeting ID used to match transcripts). |
| `OnlineMeetingTranscript.Read.All` | Subscribe to "transcript available" notifications and download transcript text. |

Then click **“Grant admin consent for {tenant}”** and confirm. All three must
show **“Granted for {tenant}”** with a green check.

> We are deliberately **not** requesting `OnlineMeetings.ReadWrite.All` (create
> standalone meetings) or any `Mail.*`, `Files.*`, `Chat.*`, `User.ReadWrite`,
> or `.ReadWrite` directory scopes.

**Why consent is required:** application permissions never work until a tenant
admin consents on behalf of the organisation — there is no per-user prompt in
app-only mode.

---

## 4. Teams application access policy  *(the “who can this app act as” gate)*

### What it is

Adding `OnlineMeetings.Read.All` / `OnlineMeetingTranscript.Read.All` in Step 3
gives the app the *capability*, but Microsoft **blocks all cloud-communication
calls (meetings, transcripts) until a Teams application access policy explicitly
names which mailboxes the app may act for.** Without this policy every
`/onlineMeetings` and `/transcripts` call returns **403 Forbidden**.

### Why we need it

It is the least-privilege control for Teams: instead of "this app can read every
meeting in the tenant", it becomes "this app can act only for
`governance-meetings@abchealth.com`". You scope our blast radius to one mailbox.

### Steps

Run in **Teams PowerShell** (`Install-Module MicrosoftTeams`):

```powershell
Connect-MicrosoftTeams

# 1. Create a policy naming our app's Client ID
New-CsApplicationAccessPolicy `
  -Identity "GovPortalMeetingPolicy" `
  -AppIds "cb2fd374-0701-49fe-aec3-5642617354f7" `
  -Description "Governance Portal backend — create meetings & read transcripts"

# 2. Grant it to the organizer mailbox ONLY (preferred — least privilege)
Grant-CsApplicationAccessPolicy `
  -PolicyName "GovPortalMeetingPolicy" `
  -Identity "governance-meetings@abchealth.com"
```

> Do **not** use `Grant-CsApplicationAccessPolicy -Global` unless you
> deliberately want the app to be able to act for every user in the tenant.

**Propagation:** up to ~30 minutes before the grant takes effect.

### Verify

```powershell
Get-CsApplicationAccessPolicy -Identity "GovPortalMeetingPolicy"
Get-CsOnlineUser -Identity "governance-meetings@abchealth.com" |
  Select-Object DisplayName, ApplicationAccessPolicy   # should show GovPortalMeetingPolicy
```

---

## 5. Exchange application access policy  *(the calendar-scope gate — different product, same phrase)*

### What it is — and why it is separate

`Calendars.ReadWrite` (Step 3) is an **Exchange Online** permission. Granted as
an application permission it lets the app read/write the calendar of **every
mailbox in the tenant** by default. The Teams policy in Step 4 does **not**
constrain it — Teams and Exchange are different products with a
confusingly-identical “application access policy” concept and **different
cmdlets** (`New-CsApplicationAccessPolicy` vs `New-ApplicationAccessPolicy`).

### Why we need it

To reduce `Calendars.ReadWrite` from "every mailbox" down to "only the
Governance Portal organizer mailbox".

### Steps

Run in **Exchange Online PowerShell**
(`Install-Module ExchangeOnlineManagement`):

```powershell
Connect-ExchangeOnline

# 1. A mail-enabled security group whose members are the mailboxes the app may touch
New-DistributionGroup `
  -Name "GovPortalMailboxes" `
  -Type Security `
  -Members "governance-meetings@abchealth.com"

# 2. Restrict the app to just that group
New-ApplicationAccessPolicy `
  -AppId "cb2fd374-0701-49fe-aec3-5642617354f7" `
  -PolicyScopeGroupId "GovPortalMailboxes@abchealth.com" `
  -AccessRight RestrictAccess `
  -Description "Governance Portal backend — calendar access limited to portal mailbox"
```

### Verify

```powershell
Test-ApplicationAccessPolicy `
  -AppId "cb2fd374-0701-49fe-aec3-5642617354f7" `
  -Identity "governance-meetings@abchealth.com"    # AccessCheckResult : Granted

Test-ApplicationAccessPolicy `
  -AppId "cb2fd374-0701-49fe-aec3-5642617354f7" `
  -Identity "someone.else@abchealth.com"           # AccessCheckResult : Denied
```

---

## 6. Enable meeting transcription in the Teams meeting policy

### Why this matters

If the organizer mailbox's Teams meeting policy does **not** allow transcription,
Teams will never produce a transcript, and the entire "auto-summarise" half of
this integration produces nothing — regardless of the permissions above. This is
the single most common reason the integration appears "broken" after setup.

### Steps

```powershell
# See which policy the organizer mailbox has
Get-CsOnlineUser -Identity "governance-meetings@abchealth.com" |
  Select-Object TeamsMeetingPolicy

# Option A: adjust the assigned policy (affects everyone on that policy)
Set-CsTeamsMeetingPolicy -Identity "<PolicyNameFromAbove>" `
  -AllowTranscription $true

# Option B (cleaner): a dedicated policy just for the portal organizer
New-CsTeamsMeetingPolicy -Identity "GovPortalMeetingTranscription" `
  -AllowTranscription $true `
  -AllowCloudRecording $false
Grant-CsTeamsMeetingPolicy -Identity "governance-meetings@abchealth.com" `
  -PolicyName "GovPortalMeetingTranscription"
```

**Recommended:** also turn on **automatic transcription** so a meeting organized
by this mailbox starts transcribing without a human clicking "Start transcript".
In the Teams admin center this is *Meetings → Meeting policies → (policy) →
“Transcription” = On* and, where available, the auto-start toggle. If auto-start
is not available in your tenant, the meeting participants must click
**More → Record and transcribe → Start transcription** during each meeting.

> Graph also requires the tenant-level setting **“Allow Microsoft Graph API
> access to Teams meeting transcripts”** to be **on** (Teams admin center →
> *Meetings → Meeting settings*, or it is on by default). If it is off, transcript
> downloads return `403 GraphAccessToTranscriptsDisabled`.

**Propagation:** Teams policy changes can take up to 24h to fully apply, usually
much less.

---

## 7. Client secret

A client secret for this app was shared with the engineering team as a chat
screenshot (visible value, expiry **01/09/2027**).

**Please:**

1. **Rotate it** — App registration → **Certificates & secrets** → *New client
   secret* (24-month expiry), delete the old one, and send the **new value**
   over a secure channel (not chat/email plaintext — use a password manager
   share or a secrets vault).
2. For production, consider a **certificate credential** instead of a secret —
   no copy-pasteable value, and no silent expiry outage. Upload a `.cer` public
   key under *Certificates & secrets → Certificates*; engineering holds the
   private key in the deploy secret store.

The engineering team stores the secret only in the backend's server-side secret
store (Render) and the local `.env` (git-ignored). It is never committed.

---

## 8. What to send back to engineering

| Item | Example | Where to find it |
|---|---|---|
| Organizer mailbox UPN | `governance-meetings@abchealth.com` | you chose it in Step 2 |
| Organizer mailbox object ID | `00000000-0000-0000-0000-000000000000` | Entra → Users → that user → Object ID |
| New client secret **value** | `abc8Q~…` | Step 7, over a secure channel |
| Confirmation | "Steps 3–6 done, consent granted, policies verified" | — |

Also confirm the tenant is in the **commercial** cloud (not GCC High / DoD),
since Graph endpoints differ there.

---

## 9. Verification the engineering team will run (for your awareness)

1. App gets a token: `POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`.
2. Create a test event on the organizer mailbox → invite lands in a test inbox.
3. Create a Graph subscription to `communications/onlineMeetings/getAllTranscripts`
   (validates the notification URL round-trip).
4. Hold a 2-person test meeting with transcription on, end it → within minutes
   the backend receives the notification and downloads the `.vtt`.

If step 2 fails with `403` → Step 5 (Exchange policy) not applied yet.
If step 3/4 fails with `403` → Step 4 (Teams policy) not propagated, or Step 6
tenant toggle off.

---

## 10. How to revoke everything later

```powershell
# Teams
Grant-CsApplicationAccessPolicy -PolicyName $null -Identity "governance-meetings@abchealth.com"
Remove-CsApplicationAccessPolicy -Identity "GovPortalMeetingPolicy"
# Exchange
Remove-ApplicationAccessPolicy -Identity "<policy id from Get-ApplicationAccessPolicy>"
# Entra: App registrations → API permissions → remove the three Graph permissions
#        Certificates & secrets → delete the secret/cert
```

Removing the app registration entirely (Entra → App registrations → Delete)
severs all access in one step.

---

## Appendix — every permission / policy and why it exists

| Item | Layer | Grants | Without it | Scoped by |
|---|---|---|---|---|
| `Calendars.ReadWrite` (application) | Graph / Exchange | Create, update, cancel calendar events + read the event's online-meeting join info | Can't create meetings or send invites | Exchange application access policy (Step 5) |
| `OnlineMeetings.Read.All` (application) | Graph / Teams | Read an online meeting object by ID or join URL | Can't map a created meeting to its transcript | Teams application access policy (Step 4) |
| `OnlineMeetingTranscript.Read.All` (application) | Graph / Teams | Subscribe to transcript-ready notifications; download transcript content | No auto-transcript pipeline at all | Teams application access policy (Step 4) |
| Admin consent | Entra | Activates the three permissions org-wide | Permissions stay inert | — |
| **Teams** application access policy (`New-CsApplicationAccessPolicy`) | Teams | Names which mailboxes the app may act for, for **Teams cloud-communication** calls | All meeting/transcript calls return 403 | its own `Grant-…-Identity` (one mailbox) |
| **Exchange** application access policy (`New-ApplicationAccessPolicy`) | Exchange Online | Restricts which mailboxes the app's **calendar/mail** permissions reach | `Calendars.ReadWrite` hits every mailbox in the tenant | a mail-enabled security group |
| Teams meeting policy `-AllowTranscription $true` | Teams | Lets meetings organized by that mailbox be transcribed | Teams never generates a transcript → nothing to fetch | assigned per user/policy |
| Tenant toggle: Graph access to transcripts | Teams | Lets Graph download transcript content at all | `403 GraphAccessToTranscriptsDisabled` on every fetch | tenant-wide |
| Client secret / certificate | Entra | Lets the backend prove it is this app when requesting a token | No token, no calls | expiry + secret store |

### The two "application access policies" in one sentence each

- **Teams** (`*-CsApplicationAccessPolicy`): "This app is allowed to use its
  Teams meeting/transcript permissions, and only on behalf of these specific
  users." Required or Teams calls are blocked outright.
- **Exchange** (`*-ApplicationAccessPolicy`, no `Cs`): "This app's mailbox/
  calendar permissions are limited to this security group's mailboxes instead of
  the whole tenant." Optional but strongly recommended — it is the only thing
  narrowing `Calendars.ReadWrite`.
