import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Aumenta o limite do aviso levemente para acomodar o ecossistema React padrão
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Implementa a divisão de código (Code Splitting) recomendada pelo console
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Separa o Tiptap e suas dependências pesadas em um chunk chamado "vendor-tiptap"
            if (id.includes('@tiptap') || id.includes('prosemirror')) {
              return 'vendor-tiptap';
            }
            // Separa o React para melhor cache
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            // As demais dependências vão para um chunk genérico
            return 'vendor';
          }
        }
      }
    }
  }
})