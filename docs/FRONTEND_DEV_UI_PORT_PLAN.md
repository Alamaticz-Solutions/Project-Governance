# Frontend port: Dev-branch governance UI onto `governance-restructure`

## Goal

The `governance-restructure` frontend should present the **same UI as the `Dev`
branch governance app** — same layout, same pages, same navigation, same visual
language — while remaining **self-owned**:

- no `@appfw/*` or other client-proprietary runtime dependency;
- no verbatim copying of client framework source (design language may be
  modelled, implementation is ours — see
  `memory/feedback_no_verbatim_framework_copy.md`);
- every data read/write and auth call wired to **this branch's** `appfwClient`
  (GraphQL, tenant-scoped) — **not** Dev's `lib/api.ts` REST + Firebase layer,
  which would undo the backend framework-replacement this branch exists for.

Decisions locked with the user (2026-09-05):

- **Scope:** full Dev surface — shell + all top-level screens + the
  ProjectWorkspace page with all 7 panels, 5 review forms, `fields.tsx`,
  `StageReviewPanel`, `AIPopulationDropzone`.
- **Styling substrate:** extend the self-owned kit (`src/ui/kit.css` /
  `src/ui/kit.tsx`). **No Tailwind.** Dev's Tailwind utility classes are
  re-expressed as kit primitives + kit.css classes + framework-agnostic inline
  styles.

## Why this is a re-implementation, not a copy-paste

- No merge base between `Dev` and `governance-restructure` — every file is a
  manual port via `git show Dev:<path>`.
- Dev is ~7,000 LOC of React across ~40 files, ~80% Tailwind utility classes.
  Without Tailwind on this branch those classes are inert, so each screen's
  markup is rebuilt against the kit.
- Dev's data layer (`api.ts`, `apiClient.ts`, `firebase.ts`, `authStorage.ts`,
  `lib/types.ts`) is REST + Firebase against the *old* backend. This branch has
  `appfwClient.ts` (GraphQL, 41 generated entities + custom `invoke` mutations),
  `authContext.ts`, `tenantContext.ts`, `providers.tsx` (`useApp`, `useAsync`,
  `useAction`). Dev's aggregate endpoints (`/dashboard`, `/projects/.../workspace`)
  have no 1:1 GraphQL equivalent and must be composed from entity queries or a
  custom method — that is per-screen design work.

## Enforcement gates (must stay green every commit)

`npm run test:frontend` = `appfw:check && phi:check && typecheck && test && build`.

- `scripts/check-scaffold.mjs`: requires `src/main.tsx` to import `from '@ui-kit'`
  and reference `CommandPalette`, `AppShell`, `Dialog`, `KpiTile`,
  `DataGridShell`, `FormLayout`; `src/styles.css` imports `./ui/kit.css`;
  `@ui-kit` alias in `tsconfig.json` + `vite.config.ts`; manifest contains the
  string `self-owned`. Residue word-scan on a fixed non-feature file list.
  **Does not** enforce file placement (scaffold vs human-owned roots).
- `scripts/check-phi-lint.mjs`: no PHI/PII-shaped literals in `src/**` (excl.
  `src/generated/**`). Keep placeholder data obviously fake
  (`john.doe@example.com`, `123-45-6789`).
- `src/generated/**` is regenerated, never hand-edited.

## Open scope questions (assumptions stated, revisit if wrong)

- **`AuditScreen`, `EntityBrowserScreen`** have no Dev counterpart. Assumption:
  keep them, keep their routes, but drop them from the primary sidebar so the
  nav matches Dev exactly (reachable via command palette / direct URL).
- **`/scaffold` reference screen** stays (kit reference, not product IA).
- Dev's sidebar shows placeholder identity (`JD`, `John Doe`, `badge: 4`). Port
  the *visual treatment*, wire the real values from `useApp().auth` and live
  counts.
- Dev's UI is itself theme-inconsistent (light shell + Header/LoginPage, dark
  DashboardPage/WorkspacePage). Port each screen's own look as-is.
- `bpmn-js` (Dev dep, used by workspace BPMN view) — add back when the workspace
  phase needs it. `@assistant-ui/react`, `@xyflow/react` are restructure-only.

## Phases (each phase = one or more commits, all green)

### Phase 1 — Foundation: design language in the kit
- `index.html`: Inter + Outfit + Material Icons font links.
- `src/ui/kit.css`: replace the dark austere token set with Dev's palette
  (indigo/violet `#4F46E5`/`#7C3AED`/`#818CF8`/`#A78BFA`, slate neutrals,
  `#f1f5f9` app bg, premium/glass shadows), Inter/Outfit families. Add helper
  classes: `.brand-gradient`, `.glass-panel`, `.glass-panel-dark`, `.form-card`,
  `.field-label`, `.form-control`, `.btn-primary`/`.btn-secondary`,
  `.animate-fade-in`, `.custom-scrollbar`, `.material-icons` sizing.
- `src/ui/kit.tsx`: add an `Icon` primitive (Material Icons span wrapper) and any
  small primitives Dev leans on (e.g. gradient button variant). Keep all existing
  kit exports and their prop contracts.
- Verify: `npm run test:frontend`.

### Phase 2 — Shell
- `src/components/layout/Sidebar.tsx` (new, self-owned): Dev's two-section nav
  (Workspace / Governance Engine), gradient logo lockup, glow treatment, footer
  identity box — wired to `useApp().auth` + `NavLink`. Nav routes exactly Dev's
  six items.
- `src/components/layout/Header.tsx` (new, self-owned): brand title, search box,
  notifications bell + dropdown (via `useAsync` against the notifications
  entity), help, user menu + sign-out (`useApp().setAuthorization(null)`).
- `src/app/AppShell.tsx`: recompose to Dev's `flex h-screen` shell (sidebar +
  header + scroll main) expressed in kit.css classes; keep the `SessionDialog`
  local-session affordance.
- `src/app/App.tsx`: route table matched to Dev's paths — `/dashboard`,
  `/projects`, `/projects/:id`, `/intake`, `/team-inbox`,
  `/team-inbox/:id/workspace` (alias of workspace), `/notifications`,
  `/analytics` (placeholder), `/meeting-center`, `/meeting-center/:id`. Keep
  `RequireAuth` role-gating and `/sign-in`, `/audit`, `/entities`, `/scaffold`.
- `src/main.tsx`: keep the `@ui-kit` imports the scaffold check requires.
- Verify.

### Phase 3 — Top-level screens (ascending complexity, one commit each)
1. `SignInScreen` ← Dev `LoginPage`
2. `NotificationsScreen` ← Dev `NotificationsPage`
3. `ProjectListScreen` ← Dev `ProjectListPage`
4. `TeamInboxScreen` ← Dev `TeamInboxPage`
5. `DashboardScreen` ← Dev `DashboardPage` (compose dashboard aggregate from
   entity queries / custom method)
6. `MeetingCenterScreen` + `MeetingDetailScreen` ← Dev meeting-center
   (+ `shared/components/MeetingDetail`, `ConfirmationScreen`, `AttendeePicker`)
7. `ProjectDetailScreen` ← Dev `ProjectDetailPage` (717 LOC)
8. `IntakeScreen` ← Dev `IntakePage` (523 LOC) + `AIPopulationDropzone`
9. Static: `PlaceholderPage` for `/analytics`
- Each: presentation from Dev, data/auth rewired to `appfwClient` / `useAsync` /
  `useAction`. Verify after each.

### Phase 4 — ProjectWorkspace (long pole, multi-commit)
- `ProjectWorkspaceScreen` ← Dev `ProjectWorkspacePage` (858 LOC) + `fields.tsx`
- Panels: `CabPanel`, `EacPanel`, `PicPanel`, `SraDfdPanel`, `StRunbookPanel`,
  `TrcPanel`, `VcrVraPanel`
- Review forms: `BtaReviewForm`, `EacReviewForm`, `EpmoReviewForm`,
  `FinanceReviewForm`, `PicReviewForm`
- `StageReviewPanel`
- Workspace `get` / `saveStage` / `submitDecision` rewired to generated custom
  mutations (`invoke`).
- Add `bpmn-js` dep if the BPMN view is in scope.
- Verify per sub-commit.

### Phase 5 — Reconcile & finish
- Remove any now-dead restructure-only screen code that Dev has no equivalent
  for (only if the user confirms — see open questions).
- `frontend/README.md` + `.appfw-ui/scaffold-manifest.json` note updated to
  describe the ported IA.
- Full `npm run test:frontend`; manual smoke via `npm run dev`.
- Update `memory/` with anything hard-won.

## Progress log

- 2026-09-05: Plan written. Orientation complete.
- 2026-09-05: `npm install` (deps were stale — vitest/testing-library missing);
  baseline `npm run test:frontend` green.
- 2026-09-05: **Phase 1 done** (`f313190`). Fonts + kit.css palette flip + helper
  classes + `Icon` primitive.
- 2026-09-05: `chore: gitignore .env files` (`382426a`) — `backend/.env` was
  untracked and unignored; nearly committed. Now ignored.
- 2026-09-05: **Phase 2 done** (`92e03bb`). `components/layout/Sidebar.tsx` +
  `Header.tsx` (new, self-owned, wired to `useApp`); `AppShell.tsx` recomposed to
  the flex shell + live pending-review count; `App.tsx` routes aligned to Dev
  (+ `/team-inbox/:projectId/workspace` alias, `/analytics` placeholder).
- 2026-09-05: **Phase 3.1 done** (`03cf8f8`). `SignInScreen` split-panel
  presentation over the token session form. `vite.config.ts`
  `optimizeDeps.esbuildOptions.target: 'esnext'` — fixes pre-existing dead
  `npm run dev` (esbuild 0.28). Verified in-browser: sign-in → shell renders
  against the local backend (sidebar rail, glass header, live notification
  badge, dashboard data).
- 2026-09-05: **Phase 3.2 done** (`0b564c2`). `NotificationsScreen` card list.
- 2026-09-05: **Phase 3.3 done** (`ae68f72`). `ProjectListScreen` — dark console,
  glass filter bar, wide status table, server-side filtering. Verified.
- 2026-09-05: **Phase 3.4 done** (`2efa2bf`). `TeamInboxScreen` — dark glass
  "Task Queue" (approvals + gate reviews), search / action filter, empty states.
- 2026-09-05: **Phase 3.5 done** (`d244e7f`). `DashboardScreen` — dark executive
  dashboard, KPI row + portfolio table + tasks + risk + meetings, composed from
  entity queries (no aggregate endpoint). Fabricated trends/insights dropped.
- 2026-09-05: **Phase 3.6 done** (`6ee6c5b`). `MeetingCenterScreen` +
  `MeetingDetailScreen` — dark master/detail; real Meeting data +
  processTranscript retained.
- 2026-09-05: **Phase 3.7 done** (`9cf240c`). `ProjectDetailScreen` — dark
  read-only dossier, pipeline ribbon, dark tabs; relational tab data + cancel /
  fast-track actions retained. Fixed: kit `secondary` Button is invisible on
  dark canvases (color token is dark) — dark screens use inline-styled buttons.
- 2026-09-05: **Phase 3.8 done** (`a3ee3d7`). `IntakeScreen` — dark glass
  sectioned form + "what happens next" rail + success screen; create flow
  unchanged; document dropzone present but inert (no AI egress on this branch).
  **Phase 3 complete.** (`AIPopulationDropzone` does not exist on this branch —
  dropped from scope; 3.9 placeholder route landed in phase 2.)
- 2026-09-05: **Phase 4 done** (`dca83d6`). `ProjectWorkspaceScreen` — dark glass
  header + current-stage badge, tabbed body (Stages / Gate submissions / Approval
  routing), Required-Decision + Approval-Timeline widgets; real workflow
  transitions + drawers retained. **Dev's 5 per-gate review forms + 7 committee
  panels NOT ported** — they target form-payload fields / endpoints this
  branch's backend does not expose. Fabricated widgets (AI confidence,
  blockchain audit, sample comments/meetings) dropped.
- 2026-09-05: **Phase 5 done.** `frontend/README.md` updated to describe the
  ported IA + self-owned kit + what was intentionally left out. `scaffold-
  manifest.json` left untouched (generated root; its `designSystem.note`
  already states the self-owned-kit rationale). `AuditScreen` /
  `EntityBrowserScreen` verified rendering under the light theme, kept off the
  primary nav. Full `npm run test:frontend` green.

## Outcome

The `governance-restructure` frontend now presents the Dev-branch governance
portal's layout, navigation, and visual language, built entirely from the
self-owned `src/ui` kit (no Tailwind, no `@appfw/*`), with every data/auth
call wired to this branch's tenant-scoped GraphQL `appfwClient`. 20 commits
(`f313190`..`dca83d6` + docs), `npm run test:frontend` green at each.

Not carried over (no data contract on this backend, flagged for a later
decision): the five per-gate review forms, committee panels, BPMN process
viewer, and the fabricated AI/audit dashboard widgets.
