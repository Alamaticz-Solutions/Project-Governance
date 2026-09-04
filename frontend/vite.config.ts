import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../app-framework/', import.meta.url));
const frontendRoot = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    outDir: '../backend/product_dist',
    emptyOutDir: true
  },
  // '@appfw/pds-health-components' resolves from node_modules (file:vendor/*.tgz).
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  server: {
    fs: {
      allow: [frontendRoot, repoRoot]
    },
    port: 5173,
    proxy: {
      '/admin': 'http://127.0.0.1:8080',
      '/system': 'http://127.0.0.1:8080',
      '/governance': 'http://127.0.0.1:8080'
    }
  }
});
