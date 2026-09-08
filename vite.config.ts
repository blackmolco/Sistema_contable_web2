import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registro manual (ver src/main.tsx): el script auto-inyectado no
      // fuerza un reload cuando hay una version nueva — la pestaña se queda
      // corriendo el JS viejo hasta cerrarla y abrirla de nuevo, aunque el
      // usuario presione recargar muchas veces. Con registerSW() propio se
      // detecta la nueva version y se recarga sola.
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Valenzuela & Asociados - Sistema Contable',
        short_name: 'V&A Contable',
        description: 'Sistema de contabilidad electrónica para Chile',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Ya NO se cachean las respuestas de /api/* (era NetworkFirst con
        // fallback a una copia de hasta 5 min): en un sistema contable, que
        // el service worker le sirva a alguien datos financieros de hace
        // minutos si la red tiene un hipo es un riesgo real, no una
        // optimizacion — mejor un error visible que un saldo viejo silencioso.
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/api\.mindicador\.cl\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mindicador-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Redirigir /api/* al backend Express en puerto 3001
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react', 'recharts', 'date-fns'],
          pdf: ['jspdf', 'jspdf-autotable'],
        },
      },
    },
  },
});
