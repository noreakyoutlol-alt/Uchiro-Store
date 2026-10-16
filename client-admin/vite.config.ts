import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.VITE_API_URL || 'http://127.0.0.1:5000';

const rawSlug =
  process.env.ADMIN_URL_SLUG ||
  process.env.ADMIN_SECRET_SLUG ||
  process.env.ADMIN_SECRET_PATH ||
  process.env.ADMIN_BASE_PATH ||
  'noreakyoutadmindashboard';
const cleanedSlug = rawSlug.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9_-]/g, '') || 'noreakyoutadmindashboard';
const adminBase = `/${cleanedSlug}/`;

export default defineConfig({
  base: adminBase,
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-framer': ['framer-motion'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['axios', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/health': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
