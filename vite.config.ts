import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    reportCompressedSize: true,
  },
  server: {
    host: '127.0.0.1',
    // 5173 falls inside a Windows reserved port range (5168-5267) on some
    // machines, which makes the bind fail with EACCES. 5273 is outside it.
    port: 5273,
    strictPort: false,
  },
});
