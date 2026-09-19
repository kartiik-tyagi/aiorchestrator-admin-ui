import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { CatalogProvider, useCatalog } from '../api/catalog'
import { ToastProvider } from '../components/ui'
import { getTenant, getToken, setTenant, setToken } from '../api/client'
import Dashboard from '../pages/Dashboard'
import Engines from '../pages/Engines'
import Profiles from '../pages/Profiles'
import Flows from '../pages/Flows'
import FlowBuilder from '../pages/FlowBuilder'
import Bindings from '../pages/Bindings'
import Pins from '../pages/Pins'
import Settings from '../pages/Settings'
import Tutorial from '../pages/Tutorial'
import { SETUP_STEPS } from '../lib/setupSteps'
import ProductSwitch from './ProductSwitch'

const SIDEBAR_KEY = 'orch_sidebar_collapsed'
const readCollapsed = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

function Sidebar({ collapsed, onToggle }) {
  const { status } = useCatalog()
  const nav = [
    { section: 'Overview', links: [{ to: '/CC/admin', label: 'Dashboard', end: true }] },
    {
      section: 'Set up in this order',
      links: SETUP_STEPS.filter((x) => x.n <= 5).map((x) => ({
        to: x.to,
        label: x.label,
        num: x.n,
        why: x.why,
      })),
    },
    {
      section: 'Optional',
      links: SETUP_STEPS.filter((x) => x.n > 5).map((x) => ({
        to: x.to,
        label: x.label,
        num: x.n,
        why: x.why,
      })),
    },
  ]

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Call Center navigation">
      <div className="brand">
        <span className="brand-mark">C</span>
        <span>
          Orchestrator
          <span className="brand-sub">Call Center</span>
        </span>
        {!collapsed && (
          <button
            className="side-toggle"
            style={{ marginLeft: 'auto' }}
            onClick={onToggle}
            aria-label="Collapse sidebar"
            title="Collapse sidebar (Ctrl+B)"
          >
            ‹
          </button>
        )}
      </div>
      {collapsed && (
        <button
          className="side-toggle"
          style={{ margin: '0 auto 0.6rem' }}
          onClick={onToggle}
          aria-label="Expand sidebar"
          title="Expand sidebar (Ctrl+B)"
        >
          ›
        </button>
      )}

      {nav.map((g) => (
        <div key={g.section} className="nav-group">
          <div className="nav-section">{g.section}</div>
          {g.links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={'end' in l ? l.end : false}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              title={collapsed ? `${l.num ? l.num + '. ' : ''}${l.label}` : l.why || undefined}
            >
              {l.num != null && <span className="nav-num">{l.num}</span>}
              <span className="nav-label">{l.label}</span>
            </NavLink>
          ))}
        </div>
      ))}

      <div className="side-foot">
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
      <ProductSwitch />
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

function ShellInner() {
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggle = () =>
    setCollapsed((v) => {
      const next = !v
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
      } catch {
        /* private mode — the choice just will not persist */
      }
      return next
    })

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      const typing =
        t instanceof HTMLElement &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (!typing && (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="main">
        <TopBar />
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="engines" element={<Engines />} />
          <Route path="profiles" element={<Profiles />} />
          <Route path="flows" element={<Flows />} />
          <Route path="flows/:flowId/builder" element={<FlowBuilder />} />
          <Route path="bindings" element={<Bindings />} />
          <Route path="pins" element={<Pins />} />
          <Route path="settings" element={<Settings />} />
          <Route path="tutorial" element={<Tutorial />} />
          <Route path="*" element={<Navigate to="/CC/admin" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default function CcShell() {
  return (
    <ToastProvider>
      <CatalogProvider>
        <ShellInner />
      </CatalogProvider>
    </ToastProvider>
  )
}
