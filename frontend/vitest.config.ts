import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Frontend test backbone (ADR 0011). Unit + component tests run under jsdom.
// Playwright E2E / a11y against a running backend remain deferred — see
// HANDOFF.md §9.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ui-kit': fileURLToPath(new URL('./src/ui/kit.tsx', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}']
  }
});
