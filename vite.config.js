import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The orchestrator Control API. Override with ORCH_URL when the lab runs elsewhere.
const ORCH = process.env.ORCH_URL ?? 'http://127.0.0.1:8011'

// Where the built app is mounted in production.
//
// Apache on voip serves it under this subpath, and the web root hosts a
// DIFFERENT SPA whose catch-all answers /assets/* with its own index.html. A
// build made at '/' therefore emits <script src="/assets/index-*.js">, gets HTML
// back, and the browser refuses it under strict MIME checking for modules — no
// JavaScript runs at all and the page is blank, with nothing in the console but
// a MIME-type complaint. That shipped once because the base was an environment
// variable someone had to remember, so the build now defaults to the real
// deployment path and you have to opt OUT for anything else.
//
// It also drives routing, not just asset URLs: src/main.jsx derives the
// BrowserRouter basename from import.meta.env.BASE_URL.
//
// Deploying somewhere else? VITE_BASE overrides it — use VITE_BASE=/ for a
// root deployment, or a full origin for a CDN.
const DEPLOY_BASE = '/aiorchestrator-admin/'

function resolveBase(forDeployment) {
  const raw = (process.env.VITE_BASE ?? '').trim()
  if (!raw) return forDeployment ? DEPLOY_BASE : '/'

  // Git Bash applies MSYS path conversion to a value that starts with a slash,
  // silently turning "/aiorchestrator-admin/" into "/Program Files/Git/…" or
  // "C:/Program Files/Git/…". That builds cleanly and is wrong in a way you only
  // discover in the browser, so refuse it here instead.
  if (/^[A-Za-z]:[\\/]/.test(raw) || raw.includes('Program Files/Git')) {
    throw new Error(
      `VITE_BASE="${raw}" looks like a Git Bash path conversion of a URL path.\n` +
        `Set it from PowerShell:  $env:VITE_BASE="${DEPLOY_BASE}"; npm run build\n` +
        `or disable the rewrite:  MSYS_NO_PATHCONV=1 VITE_BASE="${DEPLOY_BASE}" npm run build`,
    )
  }

  // A full origin (CDN) is passed through untouched; a path needs both a leading
  // and a trailing slash or Vite resolves assets relative to the current route.
  if (raw.includes('://')) return raw.endsWith('/') ? raw : `${raw}/`
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`
}

export default defineConfig(({ command, isPreview }) => ({
  // `vite preview` serves the built output, so it needs the same base the build
  // wrote into index.html — otherwise preview 404s on its own assets.
  base: resolveBase(command === 'build' || isPreview === true),
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
}))
