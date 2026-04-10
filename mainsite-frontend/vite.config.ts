/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/**
 * Remove console.* e debugger do bundle de produção.
 * Usa renderChunk (Rollup-native) para ser type-safe em qualquer versão do Vite/esbuild.
 * Atua no código já transformado, antes do write final.
 */
function dropDevArtifacts(): Plugin {
  const consoleRe = /\bconsole\.\w+\s*\((?:[^)(]*|\((?:[^)(]*|\([^)(]*\))*\))*\)\s*;?/g;
  const debuggerRe = /\bdebugger\s*;?/g;
  return {
    name: 'drop-dev-artifacts',
    apply: 'build',
    renderChunk(code) {
      const next = code.replace(consoleRe, '').replace(debuggerRe, '');
      return next !== code ? { code: next, map: null } : null;
    },
  };
}

export default defineConfig({
  plugins: [react(), dropDevArtifacts()],
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
    exclude: ['node_modules', 'dist'],
  },
});
