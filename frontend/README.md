# Project Governance Frontend

This frontend was created because product intake selected UI mode `scaffold`.

## UI

The information architecture, layout, and visual language follow the
`Dev`-branch governance portal (fixed navigation rail, sticky glass top bar,
dark "console" screens for the portfolio/workspace flows, light premium
screens for sign-in / notifications). Everything is built from the in-repo,
self-owned UI kit (`src/ui/kit.tsx` + `kit.css`) — no Tailwind, no
client-proprietary design-system dependency. See
`../docs/FRONTEND_DEV_UI_PORT_PLAN.md` for the port log.

Every screen's data and auth calls go through this branch's App Framework
client (`src/lib/appfwClient.ts`, GraphQL, tenant-scoped) — not the Dev
branch's REST + Firebase layer. Dev features with no data contract on this
backend (the five per-gate review forms, committee panels, AI recommendation
/ blockchain-audit widgets, BPMN viewer) are intentionally not carried over.

`src/features/audit` and `src/features/entities` have no Dev counterpart —
they keep their routes but are off the primary navigation.

```bash
npm install
npm run appfw:check
npm run typecheck
npm run test
npm run build
```

`npm run dev` starts the Vite dev server on :5173 and proxies `/governance`
(and `/admin`, `/system`) to a backend on `127.0.0.1:8080`.

`npm run build` emits the deployable SPA bundle to `../backend/product_dist`.
The generated backend serves that bundle at `/` in the default one-image
deployment topology when `APP_PRODUCT_UI_ENABLED=true`.
