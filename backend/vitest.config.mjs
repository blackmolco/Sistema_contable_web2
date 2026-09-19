import { defineConfig } from 'vitest/config';

export default defineConfig({
  // El backend no usa CSS: se le da una config de PostCSS vacia para que Vite
  // no suba a buscar la del frontend (postcss.config.js en la raiz, que exige
  // tailwindcss y hacia fallar las pruebas en CI, donde no esta instalado).
  css: { postcss: { plugins: [] } },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.mjs'],
  },
});
