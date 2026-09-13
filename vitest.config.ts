import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    // backend/ tiene su propia suite (backend/vitest.config.mjs, con
    // supertest) que se corre aparte con "cd backend && npm test" — sin este
    // include, vitest barre todo el repo por defecto y también la agarra,
    // pero supertest solo está instalado en backend/node_modules.
    include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
