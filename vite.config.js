import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});

