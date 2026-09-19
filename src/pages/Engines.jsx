import { useEffect, useState } from 'react'
import { useCatalog } from '../api/catalog'
import { api } from '../api/client'
import { Card, Empty, SelectField, useAsync, useToast } from '../components/ui'

/**
 * Tenant engines = which registered gateway serves each live port.
 * Credentials = the vendor API key for a gateway; write-only by design
 * (the API returns only api_key_set + a masked preview).
 */
export default function Engines() {
  const { idsFor, allIds, reloadStatus } = useCatalog()
  const toast = useToast()
  const engines = useAsync(
    () =>
      api.getEngines().catch((e) => {
        // 404 simply means "not configured yet" — not an error worth shouting about.
        if (e.status === 404) return null
        throw e
      }),
    [],
  )
  const creds = useAsync(() => api.listCredentials(), [])
  const [listen, setListen] = useState('')
  const [think, setThink] = useState('')
  const [speak, setSpeak] = useState('')
  const [saving, setSaving] = useState(false)
  const [credGw, setCredGw] = useState('')
  const [credKey, setCredKey] = useState('')
  const [savingCred, setSavingCred] = useState(false)
  useEffect(() => {
    if (!engines.data) return
    setListen(engines.data.listen ?? '')
    setThink(engines.data.think ?? '')
    setSpeak(engines.data.speak ?? '')
  }, [engines.data])
  const saveEngines = async () => {
    if (!listen || !think || !speak) {
      toast.push('err', 'Pick a gateway for all three ports')
      return
    }
    setSaving(true)
    try {
      const got = await api.putEngines({
        listen,
        think,
        speak,
      })
      toast.ok(`Engines saved: ${got.listen} / ${got.think} / ${got.speak}`)
      await engines.reload()
      void reloadStatus()
    } catch (e) {
      toast.fail(e, 'Save engines')
    } finally {
      setSaving(false)
    }
  }
  const removeCred = async (gatewayId) => {
    const bound = [listen, think, speak].includes(gatewayId)
    if (
      !confirm(
        `Delete the stored key for "${gatewayId}"?

` +
          `The key is write-only — it cannot be read back, so this is permanent unless you have ` +
          `it elsewhere.` +
          (bound
            ? `

WARNING: ${gatewayId} is currently a bound engine. Calls will fail on auth ` +
              `until you add a key or switch that engine.`
            : ''),
      )
    )
      return
    try {
      await api.deleteCredential(gatewayId)
      toast.ok(`Deleted credential for ${gatewayId}`)
      await creds.reload()
      void reloadStatus()
    } catch (e) {
      toast.fail(e, 'Delete credential')
    }
  }

  const saveCred = async () => {
    if (!credGw || !credKey.trim()) {
      toast.push('err', 'Pick a gateway and paste a key')
      return
    }
    setSavingCred(true)
    try {
      const got = await api.putCredential(credGw, credKey.trim())
      setCredKey('')
      toast.ok(`Credential saved for ${got.gateway_id} (${got.api_key_preview ?? 'set'})`)
      await creds.reload()
      void reloadStatus()
    } catch (e) {
      toast.fail(e, 'Save credential')
    } finally {
      setSavingCred(false)
    }
  }
  return (
    <div className="content">
      <div className="page-head">
        <h1>Engines &amp; credentials</h1>
        <p>
          Which vendor adapter serves each live port, and the API keys they authenticate with. Both
          are stored in Postgres per tenant — nothing here comes from the properties file.
        </p>
      </div>

      <Card
        title="Tenant engines"
        hint="Listen is STT, Think is the LLM, Speak is TTS. Options come from the registered gateway list, and the server rejects ids that are not registered or are bound to the wrong port."
        actions={
          <>
            <button className="btn" onClick={saveEngines} disabled={saving}>
              {saving ? 'Saving…' : 'Save engines'}
            </button>
            <button className="btn secondary" onClick={() => void engines.reload()}>
              Reload
            </button>
            {engines.data?.source && <span className="badge">source: {engines.data.source}</span>}
          </>
        }
      >
        <div className="row">
          <SelectField
            label="Listen (STT)"
            value={listen}
            onChange={setListen}
            options={idsFor('listen')}
          />
          <SelectField
            label="Think (LLM)"
            value={think}
            onChange={setThink}
            options={idsFor('think')}
          />
          <SelectField
            label="Speak (TTS)"
            value={speak}
            onChange={setSpeak}
            options={idsFor('speak')}
          />
        </div>
        {!engines.data && !engines.loading && (
          <div className="probe warn">Not configured yet — choose three gateways and save.</div>
        )}
      </Card>

      <Card
        title="Gateway credentials"
        hint="Write-only. The API never returns a stored key — only whether one is set plus a masked preview. Keys are never written to logs."
        actions={
          <>
            <button className="btn" onClick={saveCred} disabled={savingCred}>
              {savingCred ? 'Saving…' : 'Save credential'}
            </button>
            <button className="btn secondary" onClick={() => void creds.reload()}>
              Reload list
            </button>
          </>
        }
      >
        <div className="row">
          <SelectField label="Gateway" value={credGw} onChange={setCredGw} options={allIds()} />
          <div className="field">
            <label>API key</label>
            <input
              type="password"
              value={credKey}
              autoComplete="off"
              placeholder="Paste key — stored encrypted at rest, never echoed"
              onChange={(e) => setCredKey(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Gateway</th>
                <th>Key set</th>
                <th>Preview</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(creds.data?.credentials ?? []).map((c) => (
                <tr key={c.gateway_id}>
                  <td>
                    <code>{c.gateway_id}</code>
                  </td>
                  <td>
                    {c.api_key_set ? (
                      <span className="badge ok">yes</span>
                    ) : (
                      <span className="badge err">no</span>
                    )}
                  </td>
                  <td className="mono">{c.api_key_preview || '—'}</td>
                  <td
                    style={{
                      color: 'var(--muted)',
                    }}
                  >
                    {c.updated_at?.slice(0, 19).replace('T', ' ') ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!creds.data?.credentials?.length && (
          <Empty>
            No credentials stored. The <code>fake-*</code> gateways need none; the Sarvam adapters
            error until a key is set here.
          </Empty>
        )}
      </Card>
    </div>
  )
}
