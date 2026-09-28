import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The orchestrator Control API. Override with ORCH_URL when the lab runs elsewhere.
const ORCH = process.env.ORCH_URL ?? 'http://127.0.0.1:8011'
export default defineConfig({
  // Dev stays at /. Production on voip is served under /aiorchestrator-admin/.
  //   $env:VITE_BASE="/aiorchestrator-admin/"; npm run build
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    // Bind IPv4 all-interfaces so phones/LAN can open http://<your-ipv4>:5183
    // (not only localhost / ::1). host:true alone sometimes still preferred loopback in practice.
    host: '0.0.0.0',
    port: 5183,
    strictPort: true,
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
