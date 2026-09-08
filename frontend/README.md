# Project Governance — Frontend

React/TypeScript single-page app (Vite). UI mode `scaffold`.

## UI

Fixed navigation rail, sticky glass top bar, dark "console" screens for the
portfolio/workspace flows, light screens for sign-in and notifications. Built
from the in-repo component kit (`src/ui/kit.tsx` + `kit.css`) — no
Tailwind, no client-proprietary design-system dependency.

Every screen's data and auth calls go through the App Framework client
(`src/lib/appfwClient.ts`, GraphQL, tenant-scoped). `src/features/audit` and
`src/features/entities` keep their routes but are off the primary navigation.

## Layout

| Path | Ownership |
|---|---|
| `src/features/**`, `src/app/`, `src/components/`, `src/lib/`, `src/ui/` | Product |
| `src/generated/` | Generated UI contract — do not hand-edit |

## Commands

```bash
npm install
npm run appfw:check
npm run phi:check
npm run typecheck
npm run test
npm run build
```

`npm run test:frontend` runs all of the above (`appfw:check → phi:check →
typecheck → test → build`) in sequence.

`npm run dev` starts the Vite dev server on `:5173` and proxies `/governance`,
`/system`, and `/admin` to a backend on `127.0.0.1:8080`.

`npm run build` emits the deployable SPA bundle to `../backend/product_dist`.
The backend serves it at `/` in the single-image deployment topology when
`APP_PRODUCT_UI_ENABLED=true`.
