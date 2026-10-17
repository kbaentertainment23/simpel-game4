import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function pwaVersionPlugin(): Plugin {
  return {
    name: 'pwa-version-plugin',
    closeBundle() {
      const distSwPath = path.resolve(__dirname, 'dist', 'sw.js');
      if (fs.existsSync(distSwPath)) {
        let swContent = fs.readFileSync(distSwPath, 'utf-8');
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
        const randomHex = Math.random().toString(36).substring(2, 6);
        const buildVersion = `v-${dateStr}-${timeStr}-${randomHex}`;

        swContent = swContent.replace(/__SW_CACHE_VERSION__/g, buildVersion);
        fs.writeFileSync(distSwPath, swContent, 'utf-8');
        console.log(`[PWA Plugin] Injected cache version ${buildVersion} into dist/sw.js`);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), pwaVersionPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom', 'react-dom/client'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'motion/react',
        'lucide-react',
        'canvas-confetti',
        'xlsx',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            ui: ['lucide-react', 'motion'],
            charts: ['recharts'],
            firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth'],
            excel: ['xlsx'],
          },
        },
      },
    },
  };
});
