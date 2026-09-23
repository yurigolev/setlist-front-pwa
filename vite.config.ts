import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    allowedHosts: ['.trycloudflare.com'],
  },
  preview: {
    allowedHosts: ['.trycloudflare.com'],
  },
  plugins: [
    vue(),
    tailwindcss(),
    {
      // Старый production worker был зарегистрирован по /sw.js. При запуске
      // через Vite он должен получить рабочее обновление, а не HTML fallback.
      name: 'dev-service-worker-recovery',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/sw.js', (_request, response) => {
          response.statusCode = 200
          response.setHeader('Content-Type', 'application/javascript; charset=utf-8')
          response.setHeader('Cache-Control', 'no-store')
          response.end("self.addEventListener('install', () => self.skipWaiting()); self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));")
        })
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Setlist',
        short_name: 'Setlist',
        description: 'Локальная библиотека песен и плейбэков',
        theme_color: '#171d26',
        background_color: '#171d26',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
      },
      // Офлайн-тестирование выполняется через `vite preview`: только
      // production-сборка содержит весь бандл в precache. Dev-сервер отдаёт
      // исходные модули по отдельности и не может гарантировать запуск без сети.
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
