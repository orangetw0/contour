import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'esnext', chunkSizeWarningLimit: 1200 },
  worker: { format: 'es' },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
