import { defineConfig } from 'electron-vite';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { version } from './package.json';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'RYUJIN_');
  const development = mode === 'development';
  const csp = [
    "default-src 'none'", development ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
    development ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
    "img-src 'self' data:", "font-src 'self'",
    development ? "connect-src 'self' ws://127.0.0.1:5173" : "connect-src 'none'",
    "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-src 'none'",
  ].join('; ');
  return {
    main: {
      define: { 'process.env.RYUJIN_API_URL': JSON.stringify(env.RYUJIN_API_URL ?? '') },
      build: { rollupOptions: { input: 'src/main/index.ts', output: { entryFileNames: 'index.js', format: 'es' } } },
    },
    preload: {
      define: { __APP_VERSION__: JSON.stringify(version) },
      build: { externalizeDeps: false, rollupOptions: { input: 'src/preload/index.ts', output: { entryFileNames: 'index.cjs', format: 'cjs' } } },
    },
    renderer: {
      plugins: [react(), tailwindcss(), {
        name: 'ryujin-csp',
        transformIndexHtml: (html) => html.replace('__RYUJIN_CSP__', csp),
      }],
      server: { host: '127.0.0.1', port: 5173, strictPort: true },
    },
  };
});
