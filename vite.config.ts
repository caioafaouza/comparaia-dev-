
/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './setupTests.ts',
      include: ['tests/**/*.test.tsx'],
      css: true,
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: [
        'comparaia.com.br',
        'www.comparaia.com.br',
        'localhost',
        '127.0.0.1'
      ],
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
          secure: false
        }
      }
    },
    preview: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: [
        'comparaia.com.br',
        'www.comparaia.com.br',
        'localhost',
        '127.0.0.1'
      ],
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      cssCodeSplit: true,
      chunkSizeWarningLimit: 700,
    }
  };
});
