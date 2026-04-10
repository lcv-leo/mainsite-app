/// <reference types="vitest/config" />
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
/**
 * Remove console.* e debugger do bundle de produção.
 * Usa renderChunk (Rollup-native) para ser type-safe em qualquer versão do Vite/esbuild.
 * Atua no código já transformado, antes do write final.
 */
function dropDevArtifacts() {
    const debuggerRe = /\bdebugger\s*;/g;
    return {
        name: 'drop-dev-artifacts',
        apply: 'build',
        // transform: atua no código-fonte antes do bundle, arquivo por arquivo.
        // Mais seguro que renderChunk (que opera no código já concatenado/minificado).
        transform(code, id) {
            if (id.includes('node_modules'))
                return null;
            if (!/\.[jt]sx?$/.test(id))
                return null;
            const next = code.replace(debuggerRe, '');
            return next !== code ? { code: next, map: null } : null;
        },
    };
}
export default defineConfig({
    plugins: [react(), dropDevArtifacts(), ...(process.env.ANALYZE ? [visualizer({ filename: 'dist/stats.html', open: true, gzipSize: true })] : [])],
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
                        if (id.includes('lucide-react'))
                            return 'vendor-icons';
                        if (id.includes('react') || id.includes('react-dom'))
                            return 'vendor-react';
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
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            exclude: ['node_modules', 'dist', 'src/test-setup.ts', '**/*.test.{ts,tsx}'],
            thresholds: { lines: 60, functions: 60, branches: 50, statements: 60 },
        },
    },
});
