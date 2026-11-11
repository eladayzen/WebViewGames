import { defineConfig } from 'vite';

// GoBalance contract: base '/', normal multi-file ES-module output (GOBALANCE_SDK.md).
export default defineConfig({
  base: '/',
  server: { host: '127.0.0.1', port: 8140 },
  preview: { host: '127.0.0.1', port: 8140 },
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 1200 },
});
