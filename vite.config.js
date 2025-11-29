import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: process.env.ELECTRON_BUILD === 'true' ? './' : (mode === 'production' ? '/wiki/' : '/'),
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'lucide';
            }
            if (id.includes('react-syntax-highlighter')) {
              return 'syntax-highlighter';
            }
            if (id.includes('katex') || id.includes('remark-math') || id.includes('rehype-katex')) {
              return 'katex';
            }
            if (id.includes('react-markdown')) {
              return 'markdown';
            }
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('@dnd-kit')) {
              return 'dnd-kit';
            }
            return 'vendor';
          }
        }
      }
    }
  }
}))
