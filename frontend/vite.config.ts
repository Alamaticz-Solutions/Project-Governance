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
