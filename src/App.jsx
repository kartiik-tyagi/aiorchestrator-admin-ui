import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { CatalogProvider, useCatalog } from './api/catalog'
import { ToastProvider } from './components/ui'
import { getTenant, getToken, setTenant, setToken } from './api/client'
import Dashboard from './pages/Dashboard'
import Engines from './pages/Engines'
import Profiles from './pages/Profiles'
import Flows from './pages/Flows'
import FlowBuilder from './pages/FlowBuilder'
import Bindings from './pages/Bindings'
import Pins from './pages/Pins'
import Settings from './pages/Settings'
function Sidebar() {
  const { status } = useCatalog()
  const nav = [
    {
      section: 'Overview',
      links: [
        {
          to: '/',
          label: 'Dashboard',
          end: true,
        },
      ],
    },
    {
      section: 'Runtime',
      links: [
        {
          to: '/engines',
          label: 'Engines & credentials',
        },
        {
          to: '/pins',
          label: 'Answer pins',
        },
      ],
    },
    {
      section: 'Conversation',
      links: [
        {
          to: '/profiles',
          label: 'Profiles',
        },
        {
          to: '/flows',
          label: 'Flows',
        },
        {
          to: '/bindings',
          label: 'Bindings',
        },
      ],
    },
    {
      section: 'Platform',
      links: [
        {
          to: '/settings',
          label: 'Settings & fallback',
        },
      ],
    },
  ]
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">C</span>
        <span>
          Orchestrator
          <span className="brand-sub">Admin console</span>
        </span>
      </div>

      {nav.map((g) => (
        <div key={g.section}>
          <div className="nav-section">{g.section}</div>
          {g.links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={'end' in l ? l.end : false}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      ))}

      <div
        style={{
          marginTop: 'auto',
          paddingTop: '1rem',
        }}
      >
        <div className="nav-section">Status</div>
        <div
          style={{
            padding: '0 0.6rem',
            fontSize: 12,
            color: 'var(--muted)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span
              className={`dot ${status?.ready_for_sessions ? 'ok' : status?.db ? 'warn' : 'err'}`}
            />
            {status
              ? status.ready_for_sessions
                ? 'Ready for sessions'
                : 'Not ready'
              : 'Checking…'}
          </div>
          {!!status?.blockers?.length && (
            <div
              style={{
                color: 'var(--dim)',
                fontSize: 11,
                marginTop: '0.25rem',
              }}
            >
              {status.blockers.join(', ')}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
function TopBar() {
  const { status, reloadStatus } = useCatalog()
  const [tenant, setTenantState] = useState(getTenant())
  const [token, setTokenState] = useState(getToken())
  const [showToken, setShowToken] = useState(false)
  useEffect(() => {
    const t = window.setInterval(() => void reloadStatus(), 15000)
    return () => window.clearInterval(t)
  }, [reloadStatus])
  return (
    <div className="topbar">
      <span
        style={{
          fontSize: 12,
          color: 'var(--muted)',
        }}
      >
        Tenant
      </span>
      <input
        style={{
          width: 130,
        }}
        value={tenant}
        onChange={(e) => {
          setTenantState(e.target.value)
          setTenant(e.target.value)
        }}
        title="tenant_id sent with every request"
      />
      <span className="badge">{status?.store_backend ?? '—'}</span>
      <span className="badge">{status?.http_addr ?? ':8011'}</span>

      <div className="spacer" />

      {showToken ? (
        <>
          <input
            type="password"
            placeholder="Bearer token (only if the server sets one)"
            style={{
              width: 280,
            }}
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
function Shell() {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <TopBar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/engines" element={<Engines />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/flows" element={<Flows />} />
          <Route path="/flows/:flowId/builder" element={<FlowBuilder />} />
          <Route path="/bindings" element={<Bindings />} />
          <Route path="/pins" element={<Pins />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  )
}
export default function App() {
  return (
    <ToastProvider>
      <CatalogProvider>
        <Shell />
      </CatalogProvider>
    </ToastProvider>
  )
}
