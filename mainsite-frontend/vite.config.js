import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Usa terser para remover logs em produção sem conflito com Oxc/esbuild do Vite 8
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    target: 'esnext',
    // Desabilita lightningcss (problema de compatibilidade no Windows)
    cssCodeSplit: false,
    // O Vite já usa o 'esbuild' como minificador padrão, não precisamos chamar o terser
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Separa a biblioteca Lucide e React em arquivos de cache independentes
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            return 'vendor'; 
          }
        }
      }
    }
  },
  // Desabilita lightningcss para resolver problema em Windows
  optimizeDeps: {
    exclude: ['lightningcss']
  }
});