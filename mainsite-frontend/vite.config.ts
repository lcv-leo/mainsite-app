/// <reference types="vitest/config" />

import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Remove console.* e debugger do bundle de produção.
 * Usa renderChunk (Rollup-native) para ser type-safe em qualquer versão do Vite/esbuild.
 * Atua no código já transformado, antes do write final.
 */
function dropDevArtifacts(): Plugin {
  const debuggerRe = /\bdebugger\s*;/g;
  return {
    name: 'drop-dev-artifacts',
    apply: 'build',
    // transform: atua no código-fonte antes do bundle, arquivo por arquivo.
    // Mais seguro que renderChunk (que opera no código já concatenado/minificado).
    transform(code, id) {
      if (id.includes('node_modules')) return null;
      if (!/\.[jt]sx?$/.test(id)) return null;
      const next = code.replace(debuggerRe, '');
      return next !== code ? { code: next, map: null } : null;
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    dropDevArtifacts(),
    // PWA Service Worker via workbox (vite-plugin-pwa).
    // Estratégia de cache alinhada com HTMLRewriter em functions/[[path]].ts:
    // - HTML de /p/* e / é NetworkFirst com maxAge=300s para limitar staleness
    //   de meta tags/JSON-LD injetados no edge quando o admin edita um post.
    // - Mutations e pagamentos são NetworkOnly (nunca cached).
    // - Terceiros (SumUp SDK, Turnstile) não entram no cache do SW — SW só
    //   cobre self.origin. O CSP no _headers não é alterado (C3 do plano).
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      injectRegister: 'auto',
      manifest: false, // preserva public/manifest.webmanifest existente
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallbackDenylist: [/^\/api\//, /^\/sitemap/, /^\/feed/, /^\/autor\//],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // HTML com HTMLRewriter (home + posts + aliases) — NetworkFirst TTL curto
          {
            urlPattern: ({ url, request }) =>
              request.destination === 'document' &&
              url.origin === self.location.origin &&
              (url.pathname === '/' ||
                url.pathname === '/sobre-este-site' ||
                /^\/(p|post|materia|m|s)\/\d+\/?$/i.test(url.pathname)),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-post-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          // Assets estáticos com hash no nome — CacheFirst longo
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && /\/assets\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: { maxEntries: 120, maxAgeSeconds: 86_400 },
            },
          },
          // Leituras da API (posts, settings) — StaleWhileRevalidate
          {
            urlPattern: ({ url, request }) =>
              url.origin === self.location.origin &&
              request.method === 'GET' &&
              (url.pathname === '/api/posts' ||
                /^\/api\/posts\/\d+\/?$/.test(url.pathname) ||
                url.pathname === '/api/settings' ||
                url.pathname === '/api/settings/disclaimers' ||
                url.pathname === '/api/about' ||
                url.pathname === '/api/content-fingerprint'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-read-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 300 },
            },
          },
          // Mutations, pagamentos, AI — SEMPRE NetworkOnly (nunca cachear)
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin &&
              (url.pathname.startsWith('/api/sumup/') ||
                url.pathname.startsWith('/api/ai/') ||
                url.pathname === '/api/comment' ||
                url.pathname === '/api/rating' ||
                url.pathname === '/api/contact' ||
                url.pathname === '/api/zoom' ||
                url.pathname === '/api/shares'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
    ...(process.env.ANALYZE ? [visualizer({ filename: 'dist/stats.html', open: true, gzipSize: true })] : []),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            return 'vendor';
          }
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lightningcss'],
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['node_modules', 'dist', 'src/test-setup.ts', '**/*.test.{ts,tsx}'],
      thresholds: { lines: 60, functions: 60, branches: 50, statements: 60 },
    },
  },
});
