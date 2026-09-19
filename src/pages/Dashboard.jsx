import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useCatalog } from '../api/catalog'
import { api } from '../api/client'
import { Card, Empty, useAsync } from '../components/ui'
import { readinessChecklist } from '../lib/setupSteps'

const PORTS = ['listen', 'think', 'speak', 'knowledge', 'translate', 'skill']

export default function Dashboard() {
  const { catalog, gateways, status, reload, reloadStatus, loading, error } = useCatalog()
  const health = useAsync(() => api.health(), [])
  const flows = useAsync(() => api.listFlows(), [])
  const profiles = useAsync(() => api.listProfiles(), [])
  const bindings = useAsync(() => api.listBindings(), [])
  const pins = useAsync(() => api.getAnswerPins(), [])

  // The profile list does not say whether a profile has a published version, and
  // the server counts unpublished rows as "ready" — so ask each one directly.
  const [publishedProfiles, setPublishedProfiles] = useState(new Set())
  useEffect(() => {
    const ids = (profiles.data?.profiles ?? []).map((p) => p.id)
    if (!ids.length) {
      setPublishedProfiles(new Set())
      return
    }
    let cancelled = false
    Promise.all(
      ids.map((id) =>
        api
          .getProfileVersion(id, 'latest')
          .then(() => id)
          .catch(() => null),
      ),
    ).then((res) => {
      if (!cancelled) setPublishedProfiles(new Set(res.filter(Boolean)))
    })
    return () => {
      cancelled = true
    }
  }, [profiles.data])

  const refreshAll = () => {
    void reload()
    void reloadStatus()
    void health.reload()
    void flows.reload()
    void profiles.reload()
    void bindings.reload()
    void pins.reload()
  }

  const checklist = readinessChecklist({
    status,
    profiles: profiles.data?.profiles,
    flows: flows.data?.flows,
    bindings: bindings.data?.bindings,
    pins: pins.data?.pins,
    publishedProfiles,
  })
  const required = checklist.filter((c) => !c.optional)
  const doneCount = required.filter((c) => c.done).length
  const allDone = doneCount === required.length
  const nextStep = checklist.find((c) => !c.done && !c.optional)

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

      <div className="stat-row" style={{ marginBottom: '1rem' }}>
        <div className="stat">
          <div className="n" style={{ color: allDone ? 'var(--ok)' : 'var(--warn)' }}>
            {loading ? '…' : `${doneCount}/${required.length}`}
          </div>
          <div className="l">Setup steps complete</div>
        </div>
        <div className="stat">
          <div className="n" style={{ color: health.data?.db ? 'var(--ok)' : 'var(--err)' }}>
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
        title="Setup checklist"
        hint="What actually has to be true before a call can be answered. Stricter than the server's own readiness flag — see the note below."
        actions={
          <>
            <button className="btn secondary" onClick={refreshAll}>
              Refresh everything
            </button>
            {nextStep && (
              <Link className="btn" to={nextStep.to}>
                Next: {nextStep.label}
              </Link>
            )}
          </>
        }
      >
        {checklist.map((c) => (
          <div
            key={c.n}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span
              className={`dot ${c.done ? 'ok' : c.optional ? 'idle' : 'warn'}`}
              style={{ marginTop: 6 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Link to={c.to} style={{ fontWeight: 550 }}>
                  {c.n}. {c.label}
                </Link>
                {c.optional && <span className="badge">optional</span>}
                {c.done && <span className="badge ok">done</span>}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{c.detail}</div>
            </div>
          </div>
        ))}

        {allDone ? (
          <div className="probe ok">
            Configuration is complete. Verify it end to end from{' '}
            <Link to="/pins">Answer pins → Test this pin</Link>.
          </div>
        ) : (
          <div className="probe warn">
            {required.length - doneCount} required step(s) outstanding. Work top to bottom — each
            one depends on the ones above it.
          </div>
        )}
      </Card>

      <Card title="Server readiness" hint="What GET /v1/platform/status reports, for comparison.">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className={`dot ${status?.ready_for_sessions ? 'ok' : 'err'}`} />
          <strong>{status?.status ?? '…'}</strong>
          <span className="badge">
            ready_for_sessions: {String(status?.ready_for_sessions ?? '—')}
          </span>
        </div>
        {!!status?.blockers?.length && (
          <div className="probe err">blockers: {status.blockers.join(', ')}</div>
        )}
        {!!status?.warnings?.length && (
          <div className="probe warn">warnings: {status.warnings.join(', ')}</div>
        )}
        <p className="inline-note">
          The server's flag checks the database, the engine binding, the gateway registry and
          whether at least one profile <em>row</em> exists. It does <strong>not</strong> check that
          the profile has a published version, that a flow exists or is published, or that an answer
          pin points at them. So it can report <code>ready</code> while every call is still refused
          with <code>422 flow_pin_required</code>. Trust the checklist above.
        </p>
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
                            <span key={g.id} className="badge" style={{ marginRight: 4 }}>
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
    </div>
  )
}
