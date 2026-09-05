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
  // '@ui-kit' is the product's own UI component library (src/ui/kit.tsx) --
  // no vendor/client-owned frontend package is used.
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@ui-kit': fileURLToPath(new URL('./src/ui/kit.tsx', import.meta.url))
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
