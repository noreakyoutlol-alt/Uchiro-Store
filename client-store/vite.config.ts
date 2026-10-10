import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.VITE_API_URL || 'http://127.0.0.1:5000';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-framer': ['framer-motion'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['axios', 'canvas-confetti', 'qrcode.react', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[Vite Store Proxy] Notice: Backend connection pending on', backendTarget, err.message);
          });
        },
      },
      '/health': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
