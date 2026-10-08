import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // La tabla CIE-10 (≈1 MB, 155 kB comprimida) va en su propio archivo y se carga al buscar un diagnóstico.
  build: { chunkSizeWarningLimit: 1100 },
  plugins: [
    react(),
    // Precarga toda la app para que la consulta funcione sin internet (A4).
    VitePWA({
      // Sin recarga automática: la app avisa y el profesional decide cuándo actualizar.
      registerType: 'prompt',
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'] },
      manifest: {
        name: 'HCP Digital — Control prenatal',
        short_name: 'HCP Digital',
        lang: 'es-CO',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0f766e',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['src/pruebas/setup.ts'],
  },
});
