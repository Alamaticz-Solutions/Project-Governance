# SharePoint as the document store for the Governance Portal — deep research

**Status:** research / options paper. No code written.
**Author:** architecture spike, 2026-09-03.
**Scope:** replacing / augmenting the current attachment + knowledge-base storage
(AWS S3 + local `static/uploads` + Postgres `knowledge_documents`/`knowledge_chunks`)
with SharePoint / OneDrive, accessed through Microsoft Graph, so documents are
(a) governed inside M365 and (b) still trivially pullable for the AI extraction
and RAG pipelines.

---

## 1. TL;DR / recommendation

- **Yes, this is fully API-driven.** SharePoint document libraries, OneDrive, and
  the newer "SharePoint Embedded" are all reached through the **Microsoft Graph
  `/drives` + `/sites` REST API**. No SharePoint server, no CSOM, no SharePoint
  Framework, no Power Automate. It is the *same* Graph surface and the *same*
  app-only (client-credentials) token flow you already built for Teams meetings
  (`backend/src/services/graph_client.rs`). ~70% of the plumbing already exists.
- **Recommended target: a single dedicated SharePoint Online site** ("Governance
  Portal Documents") with **one document library per governance stage or one
  library with folder-per-project**, accessed app-only, locked down with the
  **`Sites.Selected`** permission so the app can touch *only that site*.
- **For per-user document storage**, prefer **folders (or a library) inside that
  same governance site keyed by the user's Entra object id**, not each user's
  personal OneDrive. OneDrive-per-user is possible but adds licensing,
  lifecycle (leaver) and consent headaches for marginal benefit.
- **Consider SharePoint Embedded** only if you later want documents fully hidden
  from the SharePoint UI and billed via Azure consumption. For an internal
  governance portal, classic SharePoint Online is simpler and cheaper.
- **Keep a storage abstraction.** Introduce a `DocumentStore` trait with `S3` and
  `Graph`/SharePoint implementations so you can migrate incrementally and keep S3
  (or local disk) for dev.

---

## 2. Where documents live today

| Path | What | Storage |
|---|---|---|
| `POST /projects/extract-intake` | intake wizard doc → text → OpenAI field extraction | **in-memory only**, never persisted |
| `POST /projects/:id/extract-team-fields/:team` | team-form docs → text → OpenAI | written to **local disk** `static/uploads/`, row in `attachments` with a fake `s3_key`/`s3_url` |
| `S3Service` (`services/s3_service.rs`) | real S3 upload + presigned URL | **AWS S3**, bucket `governance-attachments` (hard-coded), wired into `AppState.s3` but not actually called by the team-fields path |
| `knowledge_documents` / `knowledge_chunks` (+ `embedding vector(1536)` via raw SQL) | RAG corpus for the governance assistant | **Postgres + pgvector** |
| Teams transcripts | VTT → meeting AI pipeline | fetched from Graph, processed, not stored as files |

So today document storage is **inconsistent** (memory vs local disk vs S3) and
the S3 path is half-wired. That inconsistency is the real thing to fix; SharePoint
is one candidate backend for the fix.

---

## 3. The three Microsoft options, compared

### Option A — SharePoint Online document library (classic) ✅ recommended

A normal SharePoint site with one or more document libraries. Files are Graph
`driveItem`s under `/sites/{site-id}/drives/{drive-id}/...`.

| | |
|---|---|
| **API** | Microsoft Graph `/sites`, `/drives`, `/drive/items`, `/drive/root:/path:` |
| **Auth** | App-only client credentials (you have this) **or** delegated/OBO |
| **Isolation** | `Sites.Selected` app permission → app can access only the sites an admin grants it, at read or write. This is the key to not asking for tenant-wide `Sites.ReadWrite.All`. |
| **Metadata** | Library columns (managed metadata, choice, lookup, person). You can stamp `projectId`, `governanceStage`, `dataClassification`, `containsPHI`, `reviewStatus` as real SharePoint columns and query/filter on them via Graph. |
| **Governance you get for free** | Versioning, retention labels & retention policies, eDiscovery, DLP, sensitivity labels, audit log, recycle bin, legal hold. For a *governance* product with HIPAA/PHI flags already in the schema (`hasPhiData`, `isHipaaApplicable`, `dataClassification`), this is a strong argument. |
| **Cost** | Included in existing M365 licensing; pooled tenant storage (1 TB + 10 GB/licensed user, extra storage add-on packs). No new bill for an internal app of this size. |
| **Change notifications** | Graph subscriptions on `/drives/{id}/root` → webhook to your backend when a file is added/changed. You already run a Graph webhook (`/teams-poc/graph-notifications`) + renewal loop — reuse the exact pattern to trigger the AI pipeline on upload. |
| **Downsides** | Files are visible/navigable in the SharePoint web UI (can be a pro or con). ~5,000-item "list view threshold" matters for *UI* views, not Graph queries, but you still want a sane folder structure. Throttling is per-app-per-tenant and real (see §7). |

### Option B — SharePoint Embedded (containers, API-only)

Microsoft's "headless" SharePoint: your app creates **file storage containers** in
the customer tenant, content never appears in normal SharePoint sites, billed via
an **Azure pay-as-you-go** subscription (storage + API transactions + egress).

| | |
|---|---|
| **API** | Same Graph `/drives` shape, but containers via `/storage/fileStorage/containers`; permission `FileStorageContainer.Selected` |
| **When it's right** | You're an ISV shipping this to *multiple customer tenants*; you want content invisible to end users in SharePoint; you want storage that doesn't consume the tenant's pooled quota. |
| **When it's overkill** | Single internal tenant, internal users who are *fine* seeing docs in SharePoint, no desire to run an Azure metered bill. That's your situation. |
| **Still gives you** | Retention, eDiscovery, DLP, sensitivity labels, Purview — same compliance surface as Option A. |

Verdict: keep in your back pocket; not the first move.

### Option C — OneDrive for Business (per user)

Each user's personal OneDrive is a Graph `/users/{id}/drive`. Good for "my private
drafts," bad as a system of record: tied to that user's license, deleted/locked
when they leave, and app-only access to every user's OneDrive needs the broad
`Files.ReadWrite.All`. Use only for genuinely personal scratch space, and even
then Option A folders are usually better.

---

## 4. Auth model — two ways, pick per surface

You already have an **app-only** `GraphClient` (client-credentials, cached token,
`.default` scope). Two patterns going forward:

### 4a. App-only (service identity) — for system storage

- The backend is the identity. All writes/reads happen as "Governance Portal".
- **Permission:** `Sites.Selected` (Application), then an admin runs a one-time
  grant of `write` for your specific site:
  `POST /sites/{site-id}/permissions` with the app's `id`/`displayName` and
  `roles: ["write"]`. After that the app can do everything in that site and
  nothing elsewhere.
- **Pro:** simple, no user token juggling, works for background jobs (webhook
  ingest, re-embedding, retention sweeps).
- **Con:** SharePoint audit shows the app, not the human. Mitigate by always
  writing an app-level `uploaded_by_id` (you already have the column) and, if you
  want it in SharePoint too, stamp an `UploadedBy` person column.

### 4b. Delegated / On-Behalf-Of — for "act as the signed-in user"

- User signs in (your portal already issues its own JWT; you'd add an MSAL/OIDC
  login against Entra or an OBO exchange).
- **Permission:** `Files.ReadWrite.All` / `Sites.ReadWrite.All` *delegated*, which
  is constrained by the user's *own* SharePoint permissions — so a reviewer only
  sees what they're allowed to see.
- **Pro:** real per-user attribution and security trimming in SharePoint.
- **Con:** more moving parts (token cache per user, refresh, consent). Only worth
  it if you want SharePoint-native per-user permissions rather than enforcing
  access in your app.

**Pragmatic split:** app-only for everything the *system* does (ingest, AI,
retention), and enforce user-level visibility in your own API layer (you already
have roles/stages). Add OBO later only if compliance demands SharePoint-native
trimming.

---

## 5. Document lifecycle mapped onto Graph

### 5.1 Upload (small, < 4 MB — the intake/team-form case)

```
PUT /sites/{siteId}/drives/{driveId}/root:/{projectId}/{stage}/{filename}:/content
Content-Type: application/octet-stream
<bytes>
```

Returns a `driveItem` with `id`, `eTag`, `webUrl`, `@microsoft.graph.downloadUrl`.
Persist `driveItem.id` + `driveId` in `attachments` (replace the fake `s3_key`).

### 5.2 Upload (large, ≥ 4 MB — SOWs, architecture decks, financial models)

1. `POST .../root:/{path}:/createUploadSession` → get an `uploadUrl` +
   `expirationDateTime`.
2. `PUT` the file in ordered byte ranges (e.g. 5–10 MiB, must be a multiple of
   320 KiB) with `Content-Range: bytes 0-10485759/52428800`.
3. Last chunk returns the finished `driveItem` (201).
4. Each chunk extends the session expiry; a dropped connection can resume by
   `GET`ting the `uploadUrl` for `nextExpectedRanges`.

The upload URL is pre-authenticated — chunk `PUT`s don't need the bearer token.

### 5.3 Set metadata (columns)

```
PATCH /sites/{siteId}/lists/{listId}/items/{itemId}/fields
{ "ProjectId": "...", "GovernanceStage": "PIC", "ContainsPHI": true,
  "DataClassification": "restricted", "ReviewStatus": "Pending" }
```

Now you can query without touching Postgres:
`GET /sites/{siteId}/lists/{listId}/items?$expand=fields&$filter=fields/ProjectId eq '...'`
(add header `Prefer: HonorNonIndexedQueriesWarningMayFailRandomly` or index the
column).

### 5.4 Pull for AI (the important one)

Two clean ways to get bytes back:

- `GET /sites/{siteId}/drives/{driveId}/items/{itemId}/content` → 302 to a short-
  lived pre-authenticated CDN URL → stream bytes → feed straight into your
  existing `ai_extraction_service::extract_text` (PDF/DOCX/XLSX/TXT already
  handled). **No code change to the extractor** — only the byte source changes.
- Or read `@microsoft.graph.downloadUrl` off the item (same thing, no second
  round-trip, URL valid ~1 hour).

For text-heavy pulls you can also ask SharePoint to do the conversion:
`GET .../items/{id}/content?format=pdf` (Office → PDF server-side) — handy if you
later OCR or want a canonical render.

### 5.5 Event-driven ingest (recommended pipeline)

```
User drops file in SharePoint library  (or your portal uploads via Graph)
        │
        ▼
Graph change-notification subscription on /drives/{driveId}/root
   POST /api/v1/documents/graph-notifications   ← new, mirrors teams-poc webhook
        │  verify clientState, read delta
        ▼
GET /drives/{driveId}/root/delta?token=...      ← list exactly what changed
        │
        ▼
for each new/changed driveItem:
   download bytes → extract_text → chunk → embed (OpenAI) →
   upsert knowledge_documents / knowledge_chunks  (source_url = item.webUrl)
        │
        ▼
   optionally PATCH fields/AiIndexed = true, AiIndexedAt = now
```

This means **users can add reference material straight into SharePoint** and the
RAG corpus updates itself — no upload UI needed for the knowledge base. Your
portal's own uploads go through the same Graph write and trip the same webhook,
so there's one ingest path.

### 5.6 Retention / deletion

- `DELETE /drives/{driveId}/items/{itemId}` → recycle bin (93-day restore).
- Better: apply a **retention label** (`PATCH .../retentionLabel`) so Purview
  enforces "keep governance records 7 years, then dispose" without app logic.
- Legal hold / eDiscovery is automatic once the site is in scope — a genuine
  compliance win over an S3 bucket you'd have to build lifecycle rules for.

---

## 6. User-level document storage — concrete options

| Approach | How | Pros | Cons |
|---|---|---|---|
| **Per-user folder in the governance site** ✅ | `/drives/{gov}/root:/_users/{entraObjectId}/...`; app-only writes; your API filters by `uploaded_by_id` | one site to govern, one permission grant, survives leavers, retention applies uniformly | access-trimming is *your* job, not SharePoint's (fine — you already do stage/role checks) |
| **Per-user document library in the governance site** | one library per user, or per team | SharePoint-native permissions possible; clean quotas | library sprawl; provisioning cost; 5k-view-threshold housekeeping |
| **The user's real OneDrive** | delegated/OBO `GET /me/drive`; app-only `GET /users/{id}/drive` needs `Files.ReadWrite.All` | truly personal; user manages it in familiar OneDrive UI | dies with the account; per-user license; broad app permission; hard to apply governance retention consistently |
| **SharePoint Embedded container per user/project** | `POST /storage/fileStorage/containers` | hard isolation, invisible in SP UI, per-container permissions & metered storage | Azure billing to run; heaviest option; overkill internally |
| **Postgres large objects / bytea** | store blobs in DB | zero external dep | bloats DB, no versioning/retention/AV, bad for big decks — not recommended |

**Recommendation for "user documents":** per-user folder (keyed by Entra object
id, not email — email changes) inside the one governance site, app-only writes,
visibility enforced in your API. Add an `owner_user_id` + `visibility`
(`private` / `project` / `stage`) column to `attachments`. Promote to OneDrive/OBO
only if a compliance requirement specifically calls for SharePoint-native
per-user trimming.

---

## 7. Limits, throttling, gotchas

- **Throttling:** Graph SharePoint/OneDrive throttles per app **per tenant**.
  Expect `429` with `Retry-After`; honor it (your `graph_error` already marks
  `TOO_MANY_REQUESTS` retryable — add actual backoff/retry). Rough guardrails:
  batch metadata reads with `$expand=fields`, use `/delta` instead of polling,
  don't re-embed unchanged files (compare `eTag`/`cTag`).
- **File size:** hard cap 250 GB per file; you'll never hit it. Use upload
  sessions above ~4 MB.
- **Path characters:** `~ " # % & * : < > ? / \ { | }` and leading/trailing
  spaces are rejected or mangled — sanitize filenames (you generate a UUID prefix
  today; keep that).
- **List view threshold (5,000):** affects unindexed *filtered queries* and UI
  views, not `GET item by id`. Index `ProjectId`, `GovernanceStage`. Partition by
  folder (`/{year}/{projectId}/`) to stay well under it per folder.
- **`Sites.Selected` grant is manual & per-site:** an M365 admin must run the
  `POST /sites/{id}/permissions` grant once. Document it exactly like
  `TEAMS_GRAPH_ADMIN_RUNBOOK.md` does for the Teams policies.
- **Change-notification renewal:** drive subscriptions max out around 30 days
  (shorter than the Teams transcript one). You already have a renewal background
  task — parameterize it.
- **eventual consistency:** a file just written may take seconds to show in
  `/delta` or `$filter`. Drive item by `id` is immediately consistent; queries
  are not.
- **Tenant storage quota:** classic SharePoint draws on pooled tenant storage.
  For this app's volume it's negligible, but monitor if you dump every historical
  attachment + every RAG source in.
- **PHI/HIPAA:** M365 can be covered by Microsoft's BAA; SharePoint + Purview is a
  defensible home for PHI. An ad-hoc S3 bucket with a hard-coded name and 1-hour
  presigned URLs is harder to defend in an audit. This alone may justify the move.

---

## 8. What changes in this codebase

### 8.1 New config (mirror the `GRAPH_*` block)

```
SP_SITE_ID=                 # or SP_SITE_HOSTNAME + SP_SITE_PATH to resolve at boot
SP_DOCS_DRIVE_ID=           # default document library drive id
SP_KNOWLEDGE_DRIVE_ID=      # optional separate library for RAG sources
DOCUMENT_STORE=sharepoint   # sharepoint | s3 | local   (feature switch)
```

Reuse `GRAPH_TENANT_ID` / `GRAPH_CLIENT_ID` / `GRAPH_CLIENT_SECRET`. Add a
`config.sharepoint_enabled()` guard exactly like `graph_enabled()`.

### 8.2 New Entra permission

Add **`Sites.Selected` (Application)** to the existing app registration, admin
consent, then the one-time per-site `write` grant. No change to the Teams
permissions. (If you ever do per-user OneDrive: `Files.ReadWrite.All`, but avoid.)

### 8.3 Storage abstraction

```rust
#[async_trait]
pub trait DocumentStore: Send + Sync {
    async fn put(&self, path: &str, content_type: &str, bytes: Vec<u8>) -> AppResult<StoredDoc>;
    async fn get(&self, key: &StoredKey) -> AppResult<Vec<u8>>;
    async fn download_url(&self, key: &StoredKey) -> AppResult<String>; // presigned / graph downloadUrl
    async fn delete(&self, key: &StoredKey) -> AppResult<()>;
}
```

- `S3DocumentStore` — refactor of today's `S3Service` (also fix: bucket name from
  config, not hard-coded).
- `SharePointDocumentStore` — thin layer over the existing `GraphClient`
  (`put_bytes`, `get_content`, `create_upload_session`, `patch_fields`). Add a
  `GraphClient::put_bytes(path, content_type, body)` and a streaming `get`.
- `LocalDocumentStore` — for `cargo run` without cloud creds (replaces the
  `static/uploads` hack, keep it as the dev default).

`AppState` holds `Arc<dyn DocumentStore>`; handlers stop caring which backend.

### 8.4 Schema (`attachments`)

Add: `storage_backend TEXT`, `sp_drive_id TEXT`, `sp_item_id TEXT`,
`sp_web_url TEXT`, `owner_user_id UUID`, `visibility TEXT`, `retention_label TEXT`.
Keep `s3_key`/`s3_url` for back-compat; new rows use the SP columns. One migration.

### 8.5 New webhook + delta ingest

- `POST /api/v1/documents/graph-notifications` (+ `/graph-lifecycle`) —
  copy `handlers::teams_poc::graph_notifications` structure, verify `clientState`.
- `services::sharepoint_ingest_service` — on notification, call
  `/drives/{id}/root/delta`, and for each changed item run
  `extract_text` → chunk → embed → upsert `knowledge_documents`/`knowledge_chunks`.
- Extend the existing subscription-renewal background task to also renew the drive
  subscription.

### 8.6 Unchanged

`ai_extraction_service` (extractor + OpenAI calls), `knowledge_chunks` pgvector
approach, the intake/team-form OpenAI prompts, the Teams pipeline. Only the
*source of bytes* and *where files rest* change.

---

## 9. Rollout plan

1. **Spike (1–2 days):** register `Sites.Selected`, create "Governance Portal
   Documents" site + one library, admin grant, prove `GraphClient` can PUT/GET a
   file and PATCH a column. Throwaway route.
2. **Abstraction:** land the `DocumentStore` trait; move the existing (real) S3
   path behind it; `DOCUMENT_STORE=local` default so nothing breaks.
3. **Wire portal uploads:** intake + team-form + a real project "Documents" tab
   write through `SharePointDocumentStore`; persist `sp_item_id`. Download route
   returns Graph `downloadUrl`.
4. **Metadata columns + filtered listing** (`list_documents` reads from SP or DB).
5. **Event-driven RAG ingest:** webhook + `/delta` + embed. Now "drop a file in
   SharePoint" feeds the assistant.
6. **Governance polish:** retention labels, sensitivity labels for PHI docs,
   audit fields, admin runbook doc.
7. **(Optional, later)** OBO login for per-user SharePoint-native trimming, or
   SharePoint Embedded if this ever ships to multiple tenants.

---

## 10. Decision checklist

| # | Decision | Recommendation |
|---|---|---|
| D1 | SharePoint Online vs SharePoint Embedded | **SharePoint Online** (single internal tenant, no Azure metered bill) |
| D2 | One library + folder-per-project vs library-per-stage | **One library, `/{projectId}/{stage}/` folders**, indexed `ProjectId`/`Stage` columns |
| D3 | App-only vs delegated/OBO | **App-only now**, enforce user visibility in the API; add OBO only if compliance needs SP-native trimming |
| D4 | Per-user docs: governance-site folder vs personal OneDrive | **Governance-site folder keyed by Entra object id** |
| D5 | Keep S3? | **Keep behind the `DocumentStore` trait** for dev/fallback; SharePoint becomes the prod backend |
| D6 | RAG ingest trigger | **Graph change notification + `/delta`**, reuse the Teams webhook pattern |
| D7 | PHI handling | Move PHI docs to SharePoint under a **retention + sensitivity label**; stop putting PHI in ad-hoc S3 |

---

## Sources

- [Overview of Selected Permissions in OneDrive and SharePoint — Microsoft Graph](https://learn.microsoft.com/en-us/graph/permissions-selected-overview)
- [Upload small files — Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0)
- [driveItem: createUploadSession — Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0)
- [Upload large files using the Microsoft Graph SDKs](https://learn.microsoft.com/en-us/graph/sdks/large-file-upload)
- [SharePoint Embedded overview — Microsoft Learn](https://learn.microsoft.com/en-us/sharepoint/dev/embedded/overview)
- [SharePoint Online (Microsoft 365) vs SharePoint Embedded — Titan Workspace](https://titanworkspace.com/sharepoint-online-microsoft-365-vs-sharepoint-embedded-whats-the-difference/)
- [SharePoint Embedded cost control checklist — Titan Workspace](https://titanworkspace.com/sharepoint-embedded-cost-control-checklist-practical-buyer-friendly/)
- [Uploads a large file to SharePoint using MS Graph REST API — PnP Samples](https://pnp.github.io/script-samples/graph-upload-file-to-sharepoint/README.html)
- Internal: `docs/TEAMS_GRAPH_API_MIGRATION_PLAN.md`, `docs/TEAMS_GRAPH_ADMIN_RUNBOOK.md`, `backend/src/services/graph_client.rs`, `backend/src/services/s3_service.rs`, `backend/src/services/ai_extraction_service.rs`
