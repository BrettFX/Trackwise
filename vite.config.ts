import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isTauri = !!process.env.TAURI_ENV_PLATFORM;

// https://vite.dev/config/
export default defineConfig({
  base: isTauri ? './' : '/Trackwise/',
  plugins: [
    react(),
    tailwindcss(),
    // Stub out Tauri-only packages so the browser dev server doesn't error
    !isTauri && {
      name: 'tauri-stub',
      resolveId(id: string) {
        if (id.startsWith('@tauri-apps/')) return id;
      },
      load(id: string) {
        if (id.startsWith('@tauri-apps/')) return 'export default {}';
      },
    },
  ],
})
