# Project Governance Frontend

This frontend was created because product intake selected UI mode `scaffold`.

Use the legacy UI screenshots, route inventory, and workflow evidence for workflow intent and App Framework frontend
standards for implementation shape. Replace the placeholder screen after the
legacy-modernization entity model and generated UI contract exist.

```bash
npm install
npm run appfw:check
npm run typecheck
npm run build
```

`npm run build` emits the deployable SPA bundle to `../backend/product_dist`.
The generated backend serves that bundle at `/` in the default one-image
deployment topology when `APP_PRODUCT_UI_ENABLED=true`.
