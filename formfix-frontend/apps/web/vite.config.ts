import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const rootEnv = fileURLToPath(new URL('../../', import.meta.url));
  const env = loadEnv(mode, rootEnv, '');
  const apiBase = env.API_PROXY_TARGET || env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

  return {
    envDir: rootEnv,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      // In live mode the dev server proxies /api to the real backend so the
      // browser never needs a cross-origin credentialed request.
      proxy: apiBase
        ? { '/api': { target: apiBase, changeOrigin: false } }
        : undefined,
    },
    build: {
      target: 'es2022',
      sourcemap: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  };
});
