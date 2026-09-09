# 9. Every file under `frontend/`

Same markers as chapter 8: **[P]** hand-written, **[G]** generated. The frontend
is almost entirely hand-written — only `src/generated/` is [G].

The frontend is a React SPA built with Vite and TypeScript. Every screen gets its
data through one client (`src/lib/appfwClient.ts`) that speaks GraphQL to the
backend's `/governance` endpoint. Auth is a bearer token the user pastes in
(local dev) or an Okta token (managed). The backend re-checks every permission —
the frontend's role checks only decide which buttons to *show* (fail-closed).

---

## 9.1 `frontend/` root

| File | | What it does |
|------|--|--------------|
| `package.json` | [P] | Deps: `react` 18, `react-dom`, `react-router` 7. Dev deps: `vite` 6, `vitest` 2, `typescript` 5, testing-library, `jsdom`. Scripts: `dev`, `build` (`tsc --noEmit && vite build`), `typecheck`, `test`, `appfw:check`, `phi:check`, `test:frontend` (runs them all). |
| `package-lock.json` | [P] | Exact dependency tree (npm's lockfile). |
| `vite.config.ts` | [P] | Build target `esnext`, output to `../backend/product_dist`. **Aliases** `@ui-kit` and `@appfw/pds-health-components` → `src/ui/kit.tsx` (so generated code that imports the PDS component package resolves to the in-repo kit — swap by `npm install`ing the real package and removing the aliases). Dev server on `:5173`, proxies `/governance`, `/system`, `/admin` → `127.0.0.1:8080`. |
| `vitest.config.ts` | [P] | Test runner config (jsdom environment, `src/test/setup.ts`). |
| `tsconfig.json` | [P] | TypeScript compiler options (strict, `esnext`, `react-jsx`). |
| `index.html` | [P] | The single HTML page. Has `<div id="root">`; loads `src/main.tsx`. |
| `README.md` | [P] | Frontend overview + commands. |
| `.appfw-ui/` | [G] | `ownership.json` + `scaffold-manifest.json` — the scaffold contract `npm run appfw:check` (`scripts/check-scaffold.mjs`) verifies. |
| `scripts/check-scaffold.mjs` | [P] | Node script: asserts the required generated files exist and no stale product-identity residue is present. |
| `scripts/check-phi-lint.mjs` | [P] | Node script: scans `src/**` (except `src/generated/`) for string literals shaped like real SSN / email / phone / DOB values (placeholders like `example.com`, `555-…`, all-zeros are allowed). Exit 1 on a finding. Run by hand — there is no CI. |
| `node_modules/` | [installed] | ~113 MB, from `npm install`. Not committed. |
| `target/` | [G] | Frontend tool scratch (`appfw:check` evidence JSON etc.). Not the Rust `target/`. |

---

## 9.2 `src/` entry and app shell [all P]

| File | ln | What it does |
|------|----|--------------|
| `main.tsx` | 212 | React entry. Mounts `<AppRoot>` inside `ErrorBoundary` → `BrowserRouter` → `AppProviders`. Also defines `ScaffoldReference` — a UI-kit demo screen at `/scaffold` (not part of the product IA). |
| `styles.css` | — | Global styles / CSS custom properties (`--gov-*` tokens; no raw hex — the `phi:check` sibling `appfw:check` enforces token usage). |
| `vite-env.d.ts` | 1 | Vite type reference. |
| `test/setup.ts` | 1 | Imports `@testing-library/jest-dom`. |
| `app/App.tsx` | 132 | **The route table.** `/sign-in` (+ `/login` redirect) public; everything else inside `<RequireAuth><AppShell/></RequireAuth>`. `/projects/:projectId/workspace` and `/team-inbox` are further wrapped in `<RequireAuth roles={OPERATOR_ROLES}>`. `/analytics` is a placeholder. Unknown → `NotFound`. |
| `app/AppShell.tsx` | 169 | The chrome: `<Sidebar>` + `<Header>` + a scrolling `<Outlet/>`. Hosts the "local session" token dialog. `countPendingReviews(client, roles)` feeds the sidebar's "Pending Reviews" badge (queries `ProjectApproval` with `status = PENDING` + role filter). |
| `app/RequireAuth.tsx` | 50 | Shell-level auth guard. No token → redirect to `/sign-in` preserving the intended path. Authenticated but missing a required role → an explicit "denied" state (never a hidden route or generic error). |
| `app/RequireAuth.test.tsx` | 60 | Tests for the guard. |
| `app/providers.tsx` | 181 | `AppProviders` context: holds the `auth` session + a memoised `AppfwClient`, exposes `useApp()` and `useAsync((client) => ...)` (the async-with-loading/error hook every screen uses). |
| `app/ErrorBoundary.tsx` | 38 | Last-resort render-crash guard. |

---

## 9.3 `src/lib/` — the client + session layer [all P]

| File | ln | What it does |
|------|----|--------------|
| `appfwClient.ts` | 413 | **The GraphQL client.** `createAppfwClient(context)` returns `{ graphql, queryList, findRecord, saveRecord, invoke }`. `queryList` builds a connection query from the generated UI contract's field presets; `findRecord` builds `find<Entity>(id)`; `saveRecord` builds `create<Entity>` / `update<Entity>($input: Input<Entity>!)`; `invoke(field, args, kind)` calls a custom-method operation (declares string args as `String!`, everything else as `JSON`; pass `kind:'query'` for query-kind methods like `searchDirectory`/`workspace`). Adds `Authorization`, `x-tenant-id`, `x-request-id`, `x-correlation-id`, `x-timezone` headers. Maps errors into an `AppfwErrorCategory` (`validation`/`policy_denied`/`auth`/`not_found`/`provider`/`network`/`unknown`) so screens render the right state. |
| `appfwClient.test.ts` | 60 | Client tests. |
| `authContext.ts` | 162 | **Local-exploration auth only.** Remembers a pasted bearer token in `sessionStorage`, decodes claims (`user_name`, `roles`, `tenant_id`), exposes `GovernanceRole` + `GOVERNANCE_ROLES` + `ROLE_CAPTIONS`. Not a security boundary — the backend governs. |
| `authContext.test.ts` | 73 | Auth-context tests. |
| `tenantContext.ts` | 47 | Single-tenant. Hardcodes the PDS tenant id (`180000`) matching the generated backend; only lets local exploration override `x-tenant-id`. Not a security boundary. |
| `entities.ts` | 21 | `entityByType(typeName)` — looks up an entity's contract entry from the generated UI contract. |

---

## 9.4 `src/generated/` — the UI contract [G — do not hand-edit]

| File | ln | What it does |
|------|----|--------------|
| `appfw-ui-contract.ts` | **38,107** | The typed contract: for every entity, its `typeName`, `schemaName`, `primaryKey`, `captionField`, `fields[]` (name, kind, type, whether it's a relationship), `operations[]` (kind, graphqlName, returnsShape, selectionPreset, disabledReason), and `scaffold` (default list/detail field sets). The client and every screen read from this — it's what keeps the SPA in sync with the model without hand-maintained types. Huge because it's data, not logic. |
| `appfw-entity-workspace.tsx` | 183 | A contract-driven presentational "entity workspace" starter wired to the PDS component library (via the `@appfw/pds-health-components` alias → `src/ui/kit.tsx`). Products pass rows + handlers in; the component owns layout/density/a11y. Used by `EntityBrowserScreen`. |

---

## 9.5 `src/ui/` — the in-repo component kit [all P]

No third-party design system. `vite.config.ts` aliases both `@ui-kit` and the
framework's `@appfw/pds-health-components` name to `kit.tsx`.

| File | ln | What it does |
|------|----|--------------|
| `kit.tsx` | 1,025 | The whole component library: primitives (`Button`, `Badge`, `TextField`, `SelectField`, `DateField`, `SwitchField`, `TextArea`), layout (`AppShell`, `PageHeader`, `Surface`, `FormLayout`), data grid (`DataGridShell`, `DataGridToolbar`, `DataGridPagination`), chart chrome (`ChartShell`, `ChartLegend`, `KpiTile`, `MetricTrend`), overlays (`Dialog`, `CommandPalette`), feedback (`FeedbackState`, `ValidationSummary`), `IdentitySummary`, `ProcessStepper`. |
| `kit.css` | — | The kit's styles (also aliased as `@appfw/pds-health-components/styles.css`). |
| `types.ts` | 29 | Shared primitive types (tones, sizes, density, option + column shapes) + the `cx` class-name helper. |

---

## 9.6 `src/components/` — cross-screen layout [all P]

| File | ln | What it does |
|------|----|--------------|
| `layout/Sidebar.tsx` | 344 | The nav rail: brand lockup, pill nav items, identity footer, live "Pending Reviews" badge. |
| `layout/Header.tsx` | 475 | Top bar: wordmark, notification bell + dropdown (reads `Notification` via the client), user menu, "Local session" item (opens the token dialog), sign-out (clears the local session). |
| `ui.tsx` | 176 | `AsyncSection` and the error/empty/loading presentation — everything routes through the kit's `FeedbackState`; policy denials render as a distinct "denied" kind (never show the blocked action). |
| `ui.test.tsx` | 43 | Tests. |

---

## 9.7 `src/features/` — the product screens [all P]

Each screen fetches via `useAsync((client) => ...)` and renders kit components.

"Backend it calls" is the operations each screen uses (spot-checked for several;
treat the rest as indicative — open the file to be sure).

| File | ln | Screen / route | Backend it calls |
|------|----|----------------|------------------|
| `auth/SignInScreen.tsx` | 195 | `/sign-in` — paste a bearer token, records it + claims to `sessionStorage`. Public landing route. | none (local); Okta in managed envs |
| `dashboard/DashboardScreen.tsx` | 410 | `/dashboard` — KPI row, portfolio status table, my-tasks, risk summary, meetings. **No aggregate endpoint** — figures composed from several entity queries. | `queryProjects` (×2), `queryProjectApprovals`, `queryMeetings` |
| `projects/ProjectListScreen.tsx` | 512 | `/projects` — the portfolio list; server-side filtering. | `queryProjects` |
| `projects/ProjectDetailScreen.tsx` | 468 | `/projects/:projectId` — read-only dossier, stage-gate ribbon, tabbed body. | `findProject`, `queryProjectStakeholders`, `queryProjectApprovals`, `queryGateSubmissions`, `queryRiskItems`, + `invoke` (workspace/eligibility) |
| `workspace/ProjectWorkspaceScreen.tsx` | 607 | `/projects/:projectId/workspace` and `/team-inbox/:projectId/workspace` — the gate operator surface. A `stage` switch picks which review form to render. | `workspace` (query), `saveStage`, `decide`, `submitDecision`, `start`/`submit`/`skip` |
| `workspace/forms/GateWizard.tsx` | 133 | Shared stepper shell for BTA/EAC/Finance/PIC forms. | — |
| `workspace/forms/BtaReviewForm.tsx` | 255 | 9-section BTA gate form. Field names shadow `Project` columns but are stored as a **parallel copy** in `GateSubmission.data`, not written back to `Project`. | `saveStage`, `extractTeamFields('bta')` |
| `workspace/forms/EacReviewForm.tsx` | 198 | 10-section EAC form (only 1–4 + 10 have inputs). `stakeholders` array is local-only, not submitted. | `saveStage`, `extractTeamFields('eac')` |
| `workspace/forms/EpmoReviewForm.tsx` | 78 | Single-screen 4-question EPMO checklist. | `saveStage`, `extractTeamFields('epmo')` |
| `workspace/forms/FinanceReviewForm.tsx` | 232 | 3-section Finance form + dynamic per-fiscal-year cost table. **No `Finance` stage exists in the seeded 19-stage workflow**, so the workspace doesn't currently render it from a live stage. | `saveStage`, `extractTeamFields('finance')` |
| `workspace/forms/PicReviewForm.tsx` | 174 | 7-section PIC form for the "Prepare for PIC" stage. | `saveStage`, `extractTeamFields('pic')` |
| `team-inbox/TeamInboxScreen.tsx` | 415 | `/team-inbox` — task queue: pending `ProjectApproval` + open `GateReview` routed to the session's roles. | `queryProjectApprovals`, `queryGateReviews` |
| `intake/IntakeScreen.tsx` | 505 | `/intake` — new-request form (3 sections + "what happens next" rail + success screen). Its `Draft` interface must stay in sync with `ai_extraction/mod.rs`'s `INTAKE_FIELDS`. | `createProject`, `extractIntake` |
| `notifications/NotificationsScreen.tsx` | 203 | `/notifications` — the in-app notification list + mark-read. | `queryNotifications`, `updateNotification` |
| `meeting-center/MeetingCenterScreen.tsx` | 414 | `/meeting-center` — card grid, stat-tile status filter, inline schedule form. | `queryMeetings`, `createMeeting`, `scheduleViaGraph`, `cancelViaGraph` |
| `meeting-center/MeetingDetailScreen.tsx` | 309 | `/meeting-center/:meetingId` — AI summary / action items / details; runs transcript processing. | `findMeeting`, `processTranscript` |
| `meeting-center/AttendeePicker.tsx` | 179 | Chips + typeahead; live Microsoft 365 directory search. | `searchDirectory` (query) |
| `meeting-center/shared.ts` | 74 | Display helpers: maps `Meeting.status` (`scheduled`→`graph_scheduled`→`transcript_captured`→`cancelled`) and `source` (`manual`/`local_stub`) to labels. |
| `audit/AuditScreen.tsx` | 130 | `/audit` — the append-only `AuditEvent` trail (off the primary nav). | `queryAuditEvents` |
| `entities/EntityBrowserScreen.tsx` | 76 | `/entities` and `/entities/:routeSegment` — a generic contract-driven CRUD browser over any entity (off the primary nav). | generated CRUD for the selected entity |
| `shared/AIPopulationDropzone.tsx` | 226 | Drag/drop document upload used by intake + every gate form. Sends base64 content to `extractIntake` / `extractTeamFields`; renders a distinct message when the server's PHI gate blocked the doc. |
| `shared/enums.ts` | 68 | Option lists mirrored from the model enums. **Important gotcha noted in the file:** the model authors SCREAMING_SNAKE, but async-graphql's default enum rename exposes them as **PascalCase** on the wire — these lists use the wire (PascalCase) values. (Filter args, however, compare the raw stored SCREAMING_SNAKE text — see `AppShell.tsx`'s `countPendingReviews`.) |

---

## 9.8 The "generated vs. product" boundary in the frontend

`npm run appfw:check` (`scripts/check-scaffold.mjs`) is the frontend equivalent of
the backend's `boundary-check`: it verifies `src/generated/**` and the required
scaffold files are intact and that product identity strings weren't left as
stale placeholders. If you edit `src/generated/appfw-ui-contract.ts` by hand it
will be overwritten on the next `scripts/appfw product generate` and
`appfw:check` may flag drift.

---

Next: [`10-appfw-model-files.md`](10-appfw-model-files.md).
