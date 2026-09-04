import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Frontend test backbone (ADR 0011). Unit + component tests run under jsdom.
// Playwright E2E / a11y against a running backend remain deferred — see
// HANDOFF.md §9.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}']
  }
});
