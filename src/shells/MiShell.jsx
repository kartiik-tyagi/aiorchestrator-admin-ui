import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useState } from 'react'
import { ToastProvider } from '../components/ui'
import { getToken, setToken } from '../api/client'
import ComingNext from '../pages/mi/ComingNext'
import MiDashboard from '../pages/mi/Dashboard'
import ProductSwitch from './ProductSwitch'

function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Meeting Intelligence navigation">
      <div className="brand">
        <span className="brand-mark">M</span>
        <span>
          Orchestrator
          <span className="brand-sub">Meeting Intelligence</span>
        </span>
      </div>
      <div className="nav-group">
        <div className="nav-section">Overview</div>
        <NavLink to="/MI/admin" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="nav-label">Home</span>
        </NavLink>
      </div>
      <div className="side-foot">
        <div className="nav-section">Status</div>
        <div style={{ padding: '0 0.6rem', fontSize: 12, color: 'var(--muted)' }}>
          Profiles and meetings — next phases
        </div>
      </div>
    </aside>
  )
}

function TopBar() {
  const [token, setTokenState] = useState(getToken())
  const [showToken, setShowToken] = useState(false)
  return (
    <div className="topbar">
      <ProductSwitch />
      <div className="spacer" />
      {showToken ? (
        <>
          <input
            type="password"
            placeholder="Bearer token (only if the server sets one)"
            style={{ width: 280 }}
            value={token}
            onChange={(e) => {
              setTokenState(e.target.value)
              setToken(e.target.value)
            }}
          />
          <button className="btn secondary sm" onClick={() => setShowToken(false)}>
            Done
          </button>
        </>
      ) : (
        <button className="btn secondary sm" onClick={() => setShowToken(true)}>
          {token ? 'Token set' : 'Set token'}
        </button>
      )}
    </div>
  )
}

function ShellInner() {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <TopBar />
        <Routes>
          <Route index element={<MiDashboard />} />
          <Route path="profiles" element={<ComingNext title="MI profiles" />} />
          <Route path="meetings" element={<ComingNext title="Meetings" />} />
          <Route path="*" element={<Navigate to="/MI/admin" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default function MiShell() {
  return (
    <ToastProvider>
      <ShellInner />
    </ToastProvider>
  )
}
