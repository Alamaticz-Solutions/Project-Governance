# Teams Meeting + VTT — Multi-User Graph Feasibility

Discussion notes, not a build plan. Answers whether a set of larger
capabilities are *possible* on top of the Power Automate POC
(`TEAMS_MEETING_VTT_POC.md`, `TEAMS_POWER_AUTOMATE_SETUP.md`), and what each
one actually costs. No code exists for any of this yet.

## The ask

Assuming a move to **Microsoft Graph API** (the route the current POC
deliberately avoided — see `TEAMS_GRAPH_API_MICROSOFT_ADMIN_HANDOFF.md`):

1. Let every user schedule meetings from **both** Teams directly and this
   application.
2. Process VTT transcripts for meetings a user is involved in **either as
   organizer or as attendee** — not just meetings this app scheduled.
3. Give each attendee **private, per-user action items** — visible only to
   their own login.
4. Deliver those per-user results via **email, Teams chat, or in-app**.
5. Run a fixed set of **predefined skills** (action items, decisions,
   summary, etc.) against every transcript.
6. Let individual users define **custom skills** — their own prompt/logic
   run against the transcript, for their eyes only.
7. Offer a **Teams-style org directory picker** when adding attendees —
   type-ahead search across the organization (and external contacts),
   instead of typing raw email addresses.

## 1. Any meeting, organizer or attendee, from Teams or the app

**Feasible, and the real architectural pivot.** Requires Graph
**application permissions with admin consent**, not the current
delegated-personal-connection model:

- `OnlineMeetingTranscript.Read.All` (application) — fetch transcripts
  tenant-wide, not tied to one person's calendar.
- `Calendars.Read` (application) or a Graph change-notification
  subscription — detect meetings and attendee lists across the org, not
  just meetings the app itself scheduled.
- The tenant-wide "Transcript API access" toggle (already required today)
  needs re-verifying under application permissions for meetings where the
  app is neither organizer nor attendee — treat as unconfirmed until
  tested against real Graph behavior.

This is a genuine step up in scope, cost, and governance (admin consent,
security review, an app registration someone owns long-term) — not a code
complexity problem. It's a decision, not just an engineering task.

## 2. Per-user, private action items

**Yes, trivially — no Graph dependency.** Pure app-level data modeling and
authorization. The schema already stores
`action_items: [{text, assignee}]`; scoping visibility to
`assignee == current user` is an API-level filter, nothing more. Works
identically whether meetings come from the current POC flow or a full
Graph rollout. The actual gap: these endpoints have no real auth wired on
yet (a pre-existing POC limitation, not new to this ask).

## 3. Delivery channels

| Channel | Verdict |
|---|---|
| Email | Yes — Graph `sendMail`, personalized per user. Straightforward. |
| In-app | Yes — already how it works today. |
| Teams chat | Feasible, but **not** via Graph permissions alone. Proactively messaging a user requires a **registered Teams bot app** using the Bot Framework's proactive-messaging model. Graph's `chatMessage` API can only post into a chat/channel the app already has a foothold in — it cannot cold-DM an arbitrary user. This channel means shipping a real, separate Teams app, not just adding a Graph scope. |

## 4. Predefined skills (action items, decisions, summary, etc.)

**Already exists.** This is exactly what `meeting_agent_service::extract_meeting_notes`
/ `generate_bpmn` already do (see `poc_meeting_service.rs`). Adding more
predefined extraction types is incremental work on a working pattern.

## 5. User-defined custom skills

**Feasible, most open-ended of the six.** Store a per-user "skill"
(a custom prompt/instruction, optionally with an expected output shape),
run it against the transcript alongside the fixed pipeline at processing
time, and scope its result to that user like action items. Design
questions that matter:

- How much freedom to give (see open questions below).
- Basic guardrails: per-user rate-limiting on custom LLM calls (cost
  surface) and awareness that unrestricted user-authored prompts against
  transcript content is a light prompt-injection surface, even internally.

## 7. Org directory / external people picker (Teams-style attendee search)

**Feasible — Microsoft even ships a ready-made component for it**
(Microsoft Graph Toolkit's `mgt-people-picker`, the same typeahead UI Teams
itself uses), but it rides on the same architectural fork as #1, not a
standalone small feature.

**Option A — real org directory search.** Needs Microsoft Graph:

- `People.Read` / `People.Read.All` or `User.Read.All` (delegated) to
  search `/users` or `/me/people`.
- Requires the person using this app to actually **sign in with their
  Microsoft/Entra identity** — the app has no Microsoft-identity login
  today (its auth is a separate local/mock system, unrelated to Teams
  identity). This is a prerequisite, not a detail.
- Same admin-consent + app-registration story as the rest of this
  document — not a small add-on, it's downstream of the same rollout
  decision as #1.
- **External people, even under Option A**: there is no directory of
  "everyone outside the org" — that doesn't exist anywhere. What's
  actually searchable is (a) guest users already added to the tenant's
  Azure AD, or (b) the signed-in user's own Outlook "frequently
  contacted" people (personal interaction history, delegated, not
  org-wide). A genuinely new external contact still has to be typed by
  email, same as today.

**Option B — lightweight, no Graph.** Pick from this app's own registered
users (the Governance Portal already has a `users` table and a working
`/users` list endpoint) instead of a free-text box. Buildable immediately:
no Graph, no admin consent, no new auth. Limitation: only offers people who
already have an account in *this app*, not the whole Teams org; external
attendees remain free-typed email (already supported today via the
attendees feature).

## Open questions (change the actual design)

1. **Scope of "every user"** — literally every person in the M365 tenant
   (even ones who've never opened this app), or only users who've signed
   into this application at least once? Determines whether tenant-wide
   discovery is needed or just "meetings involving known app users."
2. **Attendee-only meetings entirely outside this app** — if two people
   unrelated to this app schedule a meeting in plain Teams/Outlook and one
   app user is just invited, should that be processed too? This is the
   difference between "meetings involving app users" and "every
   transcript-eligible meeting in the org."
3. **Teams chat delivery** — acceptable to build and ship a real,
   installable Teams bot app for this, or drop that channel and rely on
   email + in-app for v1?
4. **Custom skills — how much freedom?** A free-text prompt ("summarize
   just the risks"), a menu of structured extraction fields to toggle, or
   literal user-supplied code? Determines how much guardrail/sandboxing
   work is actually needed versus "another prompt template."
5. **Attendee picker — Option A or B?** A real org-wide typeahead
   (Option A) only makes sense once the Graph/admin-consent rollout is
   decided; until then, Option B (pick from this app's own registered
   users, external still free-typed) is available today with no new
   dependencies. Worth building B now regardless of the answer on #1?

## Bottom line

Nothing here is blocked. Per-user private action items, the delivery
channels, skill extensibility, and an in-app-only attendee picker (Option B
above) are all buildable on the current architecture with normal
engineering effort. The one decision that changes the project's shape is
#1: covering *any* meeting a user is involved in, not just app-scheduled
ones — and a real Teams-style org directory picker (#7, Option A) rides on
that same decision. Worth deciding deliberately before committing
engineering time, not backing into it feature-by-feature.
