import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `pnpm --filter @rackline/ui dev` serves the UI on http://127.0.0.1:5173;
// it talks to a core on ws://127.0.0.1:5180 (or `?core=ws://…`).
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
  build: { outDir: 'dist/app', emptyOutDir: true },
});
