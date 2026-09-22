import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Section, TextField, describeError } from '../../components/ui'

/**
 * Masked API secrets for profile integrations (auth_type ≠ none).
 * Never writes into the profile document — Control /api-secrets only.
 */
export default function ApiSecrets({ profileId, integrations, onStatus }) {
  const list = (integrations ?? []).filter((a) => (a?.auth_type ?? 'none') !== 'none' && (a?.id ?? '').trim())
  const [masked, setMasked] = useState([])
  const [drafts, setDrafts] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const reload = useCallback(async () => {
    if (!profileId) {
      setMasked([])
      onStatus?.([])
      return
    }
    try {
      const res = await api.listProfileApiSecrets(profileId)
      const secrets = res.secrets ?? []
      setMasked(secrets)
      setErr('')
      onStatus?.(secrets)
    } catch (e) {
      setErr(describeError(e, 'List API secrets'))
      onStatus?.([])
    }
  }, [profileId, onStatus])

  useEffect(() => {
    void reload()
  }, [reload])

  const byId = new Map(masked.map((s) => [s.api_id, s]))
  const missing = list.filter((a) => !byId.get(a.id)?.auth_set)

  const setDraft = (apiId, p) =>
    setDrafts((d) => ({
      ...d,
      [apiId]: {
        ...(d[apiId] ?? {}),
        ...p,
      },
    }))

  const buildPayload = (apiRow, d) => {
    const t = apiRow.auth_type
    if (t === 'bearer') return { bearer_token: (d.bearer_token ?? '').trim() }
    if (t === 'api_key') return { api_key: (d.api_key ?? '').trim() }
    if (t === 'basic')
      return {
        username: (d.username ?? '').trim(),
        password: (d.password ?? '').trim(),
      }
    if (t === 'headers') {
      const name = (apiRow.auth_header_name || d.header_name || '').trim() || 'Authorization'
      const val = (d.header_value ?? '').trim()
      return {
        headers: {
          [name]: val,
        },
      }
    }
    return {}
  }

  const save = async (apiRow) => {
    const id = apiRow.id
    const d = drafts[id] ?? {}
    const payload = buildPayload(apiRow, d)
    setBusy(true)
    try {
      await api.putProfileApiSecret(profileId, id, payload)
      setDrafts((x) => {
        const n = { ...x }
        delete n[id]
        return n
      })
      await reload()
    } catch (e) {
      setErr(describeError(e, 'Save API secret'))
    } finally {
      setBusy(false)
    }
  }

  const clear = async (apiId) => {
    if (!confirm(`Clear secret for ${apiId}? Publish will fail until a new secret is set.`)) return
    setBusy(true)
    try {
      await api.deleteProfileApiSecret(profileId, apiId)
      await reload()
    } catch (e) {
      setErr(describeError(e, 'Delete API secret'))
    } finally {
      setBusy(false)
    }
  }

  if (!profileId) return null

  return (
    <Section title="API secrets" tag="masked" open={list.length > 0}>
      <p className="desc" style={{ marginBottom: '0.75rem' }}>
        Write-only. The server returns masked previews only. Secrets are snapshotted when you
        Publish the profile — never stored in the profile JSON or this browser.
      </p>
      {err && <p className="err">{err}</p>}
      {!list.length && (
        <p className="desc">No integrations need auth (all auth_type none), or add integrations first.</p>
      )}
      {!!missing.length && (
        <p className="err" style={{ marginBottom: '0.75rem' }}>
          Missing secret for: {missing.map((a) => a.id).join(', ')} — Publish will fail until set.
        </p>
      )}
      {list.map((apiRow) => {
        const st = byId.get(apiRow.id)
        const d = drafts[apiRow.id] ?? {}
        return (
          <div
            key={apiRow.id}
            className="card-inset"
            style={{
              marginBottom: '0.75rem',
              padding: '0.75rem',
              border: '1px solid var(--border, #333)',
              borderRadius: 6,
            }}
          >
            <div className="row tight" style={{ justifyContent: 'space-between' }}>
              <strong className="mono">{apiRow.id}</strong>
              <span className="desc">
                {apiRow.auth_type}
                {st?.auth_set
                  ? ` · set${st.auth_preview ? ` (${st.auth_preview})` : ''}`
                  : ' · not set'}
              </span>
            </div>
            {apiRow.auth_type === 'bearer' && (
              <TextField
                label="bearer_token"
                type="password"
                value={d.bearer_token ?? ''}
                onChange={(v) => setDraft(apiRow.id, { bearer_token: v })}
                mono
              />
            )}
            {apiRow.auth_type === 'api_key' && (
              <TextField
                label="api_key"
                type="password"
                value={d.api_key ?? ''}
                onChange={(v) => setDraft(apiRow.id, { api_key: v })}
                mono
              />
            )}
            {apiRow.auth_type === 'basic' && (
              <div className="row tight">
                <TextField
                  label="username"
                  value={d.username ?? ''}
                  onChange={(v) => setDraft(apiRow.id, { username: v })}
                />
                <TextField
                  label="password"
                  type="password"
                  value={d.password ?? ''}
                  onChange={(v) => setDraft(apiRow.id, { password: v })}
                />
              </div>
            )}
            {apiRow.auth_type === 'headers' && (
              <div className="row tight">
                <TextField
                  label="header name"
                  value={d.header_name ?? apiRow.auth_header_name ?? ''}
                  onChange={(v) => setDraft(apiRow.id, { header_name: v })}
                  mono
                  placeholder="X-Api-Key"
                />
                <TextField
                  label="header value"
                  type="password"
                  value={d.header_value ?? ''}
                  onChange={(v) => setDraft(apiRow.id, { header_value: v })}
                  mono
                />
              </div>
            )}
            <div className="actions tight">
              <button
                type="button"
                className="btn sm"
                disabled={busy}
                onClick={() => void save(apiRow)}
              >
                Save secret
              </button>
              {st?.auth_set && (
                <button
                  type="button"
                  className="btn secondary sm"
                  disabled={busy}
                  onClick={() => void clear(apiRow.id)}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )
      })}
    </Section>
  )
}

/** True when every auth-required integration has auth_set. */
export function apiSecretsReady(integrations, secrets) {
  const need = (integrations ?? []).filter(
    (a) => (a?.auth_type ?? 'none') !== 'none' && (a?.id ?? '').trim(),
  )
  const byId = new Map((secrets ?? []).map((s) => [s.api_id, s]))
  return need.filter((a) => !byId.get(a.id)?.auth_set).map((a) => a.id)
}
