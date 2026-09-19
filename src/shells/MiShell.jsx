import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useState } from 'react'
import { ToastProvider } from '../components/ui'
import { getToken, setToken } from '../api/client'
import MiDashboard from '../pages/mi/Dashboard'
import MiMeetingDetail from '../pages/mi/MeetingDetail'
import MiMeetings from '../pages/mi/Meetings'
import MiProfileDetail from '../pages/mi/ProfileDetail'
import MiProfiles from '../pages/mi/Profiles'
import MiRetention from '../pages/mi/Retention'
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
        <NavLink to="/MI/admin/profiles" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="nav-label">Profiles</span>
        </NavLink>
        <NavLink to="/MI/admin/meetings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="nav-label">Meetings</span>
        </NavLink>
      </div>
      <div className="side-foot">
        <div className="nav-section">Archive</div>
        <NavLink to="/MI/admin/retention" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="nav-label">Retention</span>
        </NavLink>
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
          <Route path="profiles" element={<MiProfiles />} />
          <Route path="profiles/:id" element={<MiProfileDetail />} />
          <Route path="meetings" element={<MiMeetings />} />
          <Route path="meetings/:id" element={<MiMeetingDetail />} />
          <Route path="retention" element={<MiRetention />} />
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
