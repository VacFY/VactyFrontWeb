import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // En desarrollo el front llama a /api y /ws en su mismo origen y Vite los reenvía al backend local
  // (./mvnw spring-boot:run en VacfyBackend). Así la cookie de sesión es del mismo sitio.
  // El backend solo acepta el origen http://localhost:8000. Para usar el de Render: BACKEND_URL=https://vacfybackend.onrender.com
  const backend = env.BACKEND_URL || 'http://localhost:8080';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'VacTy — Monitoreo del termo porta-vacunas',
          short_name: 'VacTy',
          lang: 'es-PE',
          start_url: '/',
          display: 'standalone',
          theme_color: '#390f07',
          background_color: '#ffde59',
          icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api/, /^\/ws/, /^\/actuator/],
        },
      }),
    ],
    // recharts + motion + gsap + ogl (animaciones de React Bits) suman ~1 MB sin comprimir (~330 kB gzip).
    build: { chunkSizeWarningLimit: 1200 },
    server: {
      port: 8000,
      strictPort: true,
      proxy: {
        '/api': { target: backend, changeOrigin: true, secure: true },
        '/ws': { target: backend.replace(/^http/, 'ws'), ws: true, changeOrigin: true, secure: true },
      },
    },
    preview: {
      port: 8000,
      strictPort: true,
      proxy: {
        '/api': { target: backend, changeOrigin: true, secure: true },
        '/ws': { target: backend.replace(/^http/, 'ws'), ws: true, changeOrigin: true, secure: true },
      },
    },
  };
});
