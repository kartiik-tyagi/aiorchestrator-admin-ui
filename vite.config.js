import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The orchestrator Control API. Override with ORCH_URL when the lab runs elsewhere.
const ORCH = process.env.ORCH_URL ?? 'http://127.0.0.1:8011'
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5183,
    proxy: {
      // Same-origin in the browser, so no CORS work is needed server-side.
      '/v1': {
        target: ORCH,
        changeOrigin: true,
      },
      '/mi/v1': {
        target: ORCH,
        changeOrigin: true,
      },
      '/edge': {
        target: ORCH,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
