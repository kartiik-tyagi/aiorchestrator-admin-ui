import { useRef, useState } from 'react'
import { api } from '../api/client'
import { Card, Empty, TextField, useAsync, useToast } from '../components/ui'

/** Settings the orchestrator actually reads, so operators are not guessing key names. */
const KNOWN_KEYS = [
  {
    key: 'coral.base_url',
    desc: 'Base URL of the Coral platform used by the transfer and CRM gateways.',
  },
  {
    key: 'control.auth_token',
    desc: 'When set, every Control API call must send Authorization: Bearer <token>. Empty means the API is open.',
  },
  {
    key: 'answer_pins',
    desc: 'Managed by the Answer pins screen — do not hand-edit, malformed JSON breaks call answering.',
  },
]
export default function Settings() {
  const toast = useToast()
  const settings = useAsync(() => api.listSettings(), [])
  const fallback = useAsync(() => api.listFallback(), [])
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [scenario, setScenario] = useState('')
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const saveSetting = async () => {
    const k = key.trim()
    if (!k) {
      toast.push('err', 'Key required')
      return
    }
    if (
      k === 'answer_pins' &&
      !confirm(
        'answer_pins is managed by the Answer pins screen. Editing it by hand can break call answering. Continue?',
      )
    )
      return
    setBusy(true)
    try {
      await api.putSetting(k, value)
      toast.ok(`Saved ${k}`)
      await settings.reload()
    } catch (e) {
      toast.fail(e, 'Save setting')
    } finally {
      setBusy(false)
    }
  }
  const upload = async () => {
    const f = fileRef.current?.files?.[0]
    if (!scenario || !f) {
      toast.push('err', 'Pick a scenario and a WAV file')
      return
    }
    setUploading(true)
    try {
      await api.putFallback(scenario, await f.arrayBuffer())
      toast.ok(`Uploaded ${f.name} for ${scenario}`)
      if (fileRef.current) fileRef.current.value = ''
      await fallback.reload()
    } catch (e) {
      toast.fail(e, 'Upload fallback')
    } finally {
      setUploading(false)
    }
  }
  const remove = async (sc) => {
    if (!confirm(`Delete the fallback prompt for "${sc}"?`)) return
    try {
      await api.deleteFallback(sc)
      toast.ok(`Deleted ${sc}`)
      await fallback.reload()
    } catch (e) {
      toast.fail(e, 'Delete fallback')
    }
  }
  const scenarios = fallback.data?.valid_scenarios ?? []
  const present = new Set((fallback.data?.prompts ?? []).map((p) => p.scenario))
  return (
    <div className="content">
      <div className="page-head">
        <h1>Settings &amp; fallback</h1>
        <p>
          Tenant key/value settings, and the operator WAV prompts played when the AI pipeline cannot
          serve a call — engine down, credits exhausted, timeout, or an unhandled error.
        </p>
      </div>

      <Card
        title="System settings"
        hint="Free-form per tenant. There is no delete endpoint — set a key to an empty value to clear it."
        actions={
          <>
            <button className="btn" onClick={saveSetting} disabled={busy}>
              Save setting
            </button>
            <button className="btn secondary" onClick={() => void settings.reload()}>
              Reload
            </button>
          </>
        }
      >
        <div className="row">
          <TextField label="Key" value={key} onChange={setKey} placeholder="coral.base_url" mono />
          <TextField label="Value" value={value} onChange={setValue} mono />
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(settings.data?.settings ?? []).map((s) => (
                <tr key={s.key}>
                  <td>
                    <code>{s.key}</code>
                  </td>
                  <td
                    className="mono"
                    style={{
                      maxWidth: 380,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.value.length > 90
                      ? `${s.value.slice(0, 90)}…`
                      : s.value || (
                          <span
                            style={{
                              color: 'var(--dim)',
                            }}
                          >
                            (empty)
                          </span>
                        )}
                  </td>
                  <td
                    style={{
                      color: 'var(--muted)',
                    }}
                  >
                    {s.updated_at?.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                    }}
                  >
                    <button
                      className="btn secondary sm"
                      onClick={() => {
                        setKey(s.key)
                        setValue(s.value)
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!settings.data?.settings?.length && <Empty>No settings stored.</Empty>}

        <div
          style={{
            marginTop: '0.9rem',
          }}
        >
          <div className="label">Keys the orchestrator reads</div>
          {KNOWN_KEYS.map((k) => (
            <div
              key={k.key}
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '0.3rem',
                fontSize: 12,
              }}
            >
              <code
                style={{
                  cursor: 'pointer',
                  color: 'var(--accent)',
                  flex: '0 0 auto',
                }}
                onClick={() => setKey(k.key)}
              >
                {k.key}
              </code>
              <span
                style={{
                  color: 'var(--muted)',
                }}
              >
                {k.desc}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Fallback prompts"
        hint={`WAV per scenario, stored under ${fallback.data?.root ?? 'the configured fallback root'}. Scenario names are fixed by the server.`}
        actions={
          <>
            <button className="btn" onClick={upload} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload WAV'}
            </button>
            <button className="btn secondary" onClick={() => void fallback.reload()}>
              Reload
            </button>
          </>
        }
      >
        <div className="row">
          <div className="field">
            <label>Scenario</label>
            <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
              <option value="">— select —</option>
              {scenarios.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>WAV file</label>
            <input ref={fileRef} type="file" accept="audio/wav,.wav" />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Status</th>
                <th>Path</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => {
                const p = fallback.data?.prompts?.find((x) => x.scenario === s)
                return (
                  <tr key={s}>
                    <td>
                      <code>{s}</code>
                    </td>
                    <td>
                      {present.has(s) ? (
                        <span className="badge ok">uploaded</span>
                      ) : (
                        <span className="badge">not set</span>
                      )}
                    </td>
                    <td
                      className="mono"
                      style={{
                        color: 'var(--muted)',
                      }}
                    >
                      {p?.path ?? '—'}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                      }}
                    >
                      {present.has(s) && (
                        <button className="btn danger sm" onClick={() => void remove(s)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
