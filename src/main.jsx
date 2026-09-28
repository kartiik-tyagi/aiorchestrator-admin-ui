import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

// Vite base is "/" in dev and "/aiorchestrator-admin/" for the Apache deploy.
// React Router wants no trailing slash.
const rawBase = import.meta.env.BASE_URL || '/'
const basename = rawBase === '/' ? undefined : rawBase.replace(/\/$/, '')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
