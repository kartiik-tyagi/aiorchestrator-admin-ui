import { Link } from 'react-router-dom'
import { useCatalog } from '../api/catalog'
import { api } from '../api/client'
import { Card, Empty, useAsync } from '../components/ui'
const PORTS = ['listen', 'think', 'speak', 'knowledge', 'translate', 'skill']

/** Maps a platform-status blocker to the screen that clears it. */
const BLOCKER_FIX = {
  tenant_engines_missing: {
    label: 'Bind engines',
    to: '/engines',
  },
  no_profiles: {
    label: 'Create a profile',
    to: '/profiles',
  },
  credentials_missing: {
    label: 'Add credentials',
    to: '/engines',
  },
}
export default function Dashboard() {
  const { catalog, gateways, status, reload, reloadStatus, loading, error } = useCatalog()
  const health = useAsync(() => api.health(), [])
  const flows = useAsync(() => api.listFlows(), [])
  const profiles = useAsync(() => api.listProfiles(), [])
  const bindings = useAsync(() => api.listBindings(), [])
  const pins = useAsync(() => api.getAnswerPins(), [])
  const refreshAll = () => {
    void reload()
    void reloadStatus()
    void health.reload()
    void flows.reload()
    void profiles.reload()
    void bindings.reload()
    void pins.reload()
  }
  return (
    <div className="content">
      <div className="page-head">
        <h1>Dashboard</h1>
        <p>
          Live view of the orchestrator this console is pointed at. Everything here is read from the
          Control API — configuration lives in Postgres, never in files.
        </p>
      </div>

      {error != null && (
        <div className="probe err">
          Cannot reach the Control API. Start the orchestrator (
          <code>./bin/aiorchestrator.exe</code>) and make sure it is listening on :8011.
        </div>
      )}

      <div
        className="stat-row"
        style={{
          marginBottom: '1rem',
        }}
      >
        <div className="stat">
          <div
            className="n"
            style={{
              color: status?.ready_for_sessions ? 'var(--ok)' : 'var(--warn)',
            }}
          >
            {loading ? '…' : status?.ready_for_sessions ? 'Ready' : 'Not ready'}
          </div>
          <div className="l">Answer path</div>
        </div>
        <div className="stat">
          <div
            className="n"
            style={{
              color: health.data?.db ? 'var(--ok)' : 'var(--err)',
            }}
          >
            {health.data ? (health.data.db ? 'Up' : 'Down') : '…'}
          </div>
          <div className="l">Database ({health.data?.store_backend ?? '—'})</div>
        </div>
        <div className="stat">
          <div className="n">{profiles.data?.profiles?.length ?? '…'}</div>
          <div className="l">Profiles</div>
        </div>
        <div className="stat">
          <div className="n">{flows.data?.flows?.length ?? '…'}</div>
          <div className="l">Flows</div>
        </div>
        <div className="stat">
          <div className="n">{bindings.data?.bindings?.length ?? '…'}</div>
          <div className="l">Bindings</div>
        </div>
        <div className="stat">
          <div className="n">{pins.data?.pins?.length ?? '…'}</div>
          <div className="l">Answer pins</div>
        </div>
      </div>

      <Card
        title="What still blocks live calls"
        hint="From GET /v1/platform/status. An empty list means a pinned DID can be answered."
        actions={
          <button className="btn secondary" onClick={refreshAll}>
            Refresh everything
          </button>
        }
      >
        {!status && <Empty>Loading…</Empty>}
        {status && status.blockers.length === 0 && (
          <div className="probe ok">
            No blockers. Engines bound ({status.engines.listen} / {status.engines.think} /{' '}
            {status.engines.speak}) and {status.profiles.count} profile(s) published.
          </div>
        )}
        {status &&
          status.blockers.map((b) => {
            const fix = BLOCKER_FIX[b]
            return (
              <div
                key={b}
                className="probe err"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                }}
              >
                <code>{b}</code>
                {fix && (
                  <Link
                    className="btn sm secondary"
                    to={fix.to}
                    style={{
                      marginLeft: 'auto',
                    }}
                  >
                    {fix.label}
                  </Link>
                )}
              </div>
            )
          })}
        {!!status?.warnings?.length && (
          <div className="probe warn">{status.warnings.join('\n')}</div>
        )}
      </Card>

      <div className="grid-2">
        <Card
          title="Registered gateways"
          hint="Vendor adapters compiled into the binary. Profiles and engines may only reference these ids."
        >
          {!gateways && <Empty>Loading…</Empty>}
          {gateways && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Port</th>
                    <th>Gateway ids</th>
                  </tr>
                </thead>
                <tbody>
                  {PORTS.map((p) => {
                    const list = gateways.gateways?.[p] ?? []
                    if (!list.length) return null
                    return (
                      <tr key={p}>
                        <td>
                          <code>{p}</code>
                        </td>
                        <td>
                          {list.map((g) => (
                            <span
                              key={g.id}
                              className="badge"
                              style={{
                                marginRight: 4,
                              }}
                            >
                              {g.id}
                            </span>
                          ))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="inline-note">
            <code>fake-*</code> adapters are built-in stubs — useful without vendor keys, but they
            do not produce real speech or LLM output.
          </p>
        </Card>

        <Card
          title="Server catalog"
          hint="Every dropdown in this console is fed from GET /v1/meta/catalog, so the UI cannot offer something the kernel would reject."
        >
          {!catalog && <Empty>Loading…</Empty>}
          {catalog && (
            <dl className="kv">
              <dt>Flow schema</dt>
              <dd>{catalog.schema_id}</dd>
              <dt>Node types</dt>
              <dd>{catalog.node_types.join(', ')}</dd>
              <dt>Edge kinds</dt>
              <dd>{catalog.edge_kinds.join(', ')}</dd>
              <dt>Tools</dt>
              <dd>{catalog.tools.join(', ')}</dd>
              <dt>Clocks</dt>
              <dd>{catalog.clocks.join(', ')}</dd>
              <dt>Speak modes</dt>
              <dd>{catalog.speak_render_modes.join(', ')}</dd>
              <dt>TTS locales</dt>
              <dd>{catalog.tts_locales_v1.join(', ')}</dd>
            </dl>
          )}
        </Card>
      </div>

      <Card
        title="Answer pins"
        hint="A pin is what makes an inbound call answerable: it ties a profile to a published flow version."
      >
        {!pins.data && <Empty>Loading…</Empty>}
        {pins.data && pins.data.pins.length === 0 && (
          <Empty>
            No pins yet — <Link to="/pins">create one</Link> once a profile and flow are published.
          </Empty>
        )}
        {!!pins.data?.pins.length && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>Flow</th>
                  <th>Version</th>
                  <th>DID</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {pins.data.pins.map((p, i) => (
                  <tr key={i}>
                    <td>
                      <code>{p.profile_id}</code>
                    </td>
                    <td>
                      <code>{p.flow_id}</code>
                    </td>
                    <td>{p.flow_version}</td>
                    <td>{p.did || '—'}</td>
                    <td
                      style={{
                        color: 'var(--muted)',
                      }}
                    >
                      {p.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
