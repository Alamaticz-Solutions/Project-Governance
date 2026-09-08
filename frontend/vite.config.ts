import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const frontendRoot = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    outDir: '../backend/product_dist',
    emptyOutDir: true
  },
  // esbuild 0.28 errors (rather than silently lowering) on modern syntax in
  // pre-bundled deps unless the dep-optimizer target matches the build target.
  optimizeDeps: {
    esbuildOptions: { target: 'esnext' }
  },
  // The product ships its own UI component library at src/ui/kit.tsx, exposed
  // both as '@ui-kit' (product code) and under the framework generator's
  // '@appfw/pds-health-components' name (generated code — app_gen always emits
  // that import; the kit re-exports the same component surface). To switch to
  // the real PDS component package instead: `npm install
  // @appfw/pds-health-components` and remove the two aliases below.
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@ui-kit': fileURLToPath(new URL('./src/ui/kit.tsx', import.meta.url)),
      '@appfw/pds-health-components/styles.css': fileURLToPath(new URL('./src/ui/kit.css', import.meta.url)),
      '@appfw/pds-health-components': fileURLToPath(new URL('./src/ui/kit.tsx', import.meta.url))
    }
  },
  server: {
    fs: {
      allow: [frontendRoot]
    },
    port: 5173,
    proxy: {
      '/admin': 'http://127.0.0.1:8080',
      '/system': 'http://127.0.0.1:8080',
      '/governance': 'http://127.0.0.1:8080'
    }
  }
});
