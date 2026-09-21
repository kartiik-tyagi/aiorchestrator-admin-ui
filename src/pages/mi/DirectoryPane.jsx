import { useCallback, useEffect, useState } from 'react'
import { mi, setMiKbToken, getMiKbToken } from '../../api/mi/client'
import { Card, TextField, useToast } from '../../components/ui'
import { miErrorSentence } from '../../lib/miErrors'

const KB_TOKEN_KEY = 'orch_mi_kb_token'

function readStoredToken() {
  try {
    return localStorage.getItem(KB_TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function persistToken(v) {
  try {
    if (v) localStorage.setItem(KB_TOKEN_KEY, v)
    else localStorage.removeItem(KB_TOKEN_KEY)
  } catch {
    /* private mode */
  }
  setMiKbToken(v)
}

function summarizeImport(res) {
  if (!res || typeof res !== 'object') return 'Import finished.'
  const parts = []
  for (const k of ['imported', 'upserted', 'created', 'updated', 'skipped', 'errors', 'error_count', 'rows']) {
    if (res[k] != null) parts.push(`${k}=${res[k]}`)
  }
  if (Array.isArray(res.errors) && res.errors.length) {
    parts.push(`${res.errors.length} error detail(s)`)
  }
  if (res.message) parts.push(String(res.message))
  if (res.dry_run || res.dryRun) parts.push('(dry-run)')
  return parts.length ? parts.join(' · ') : 'Import finished.'
}

function downloadCsv(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Profile identity directory (people/products CSV) + Enable KG.
 * Not the Other docs paste library.
 */
export default function DirectoryPane({ profileId, rulesKb, onProfileReload }) {
  const toast = useToast()
  const [token, setToken] = useState(() => {
    const t = readStoredToken()
    if (t) setMiKbToken(t)
    return t || getMiKbToken()
  })
  const [busy, setBusy] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [peopleResult, setPeopleResult] = useState('')
  const [productsResult, setProductsResult] = useState('')
  const [people, setPeople] = useState([])
  const [products, setProducts] = useState([])
  const [listErr, setListErr] = useState(null)

  const loadEntities = useCallback(async () => {
    try {
      const [ppl, prod] = await Promise.all([
        mi.listEntities({ profileId, entityType: 'person' }),
        mi.listEntities({ profileId, entityType: 'product' }),
      ])
      const asList = (r) => r?.entities ?? r?.items ?? (Array.isArray(r) ? r : [])
      setPeople(asList(ppl))
      setProducts(asList(prod))
      setListErr(null)
    } catch (e) {
      setListErr(miErrorSentence(e.code, e.message))
    }
  }, [profileId])

  useEffect(() => {
    void loadEntities()
  }, [loadEntities])

  const onToken = (v) => {
    setToken(v)
    persistToken(v)
  }

  const runImport = async (kind, file) => {
    if (!file) return
    setBusy(true)
    try {
      const opts = dryRun ? { dryRun: true } : {}
      const res =
        kind === 'people'
          ? await mi.importPeopleCsv(profileId, file, opts)
          : await mi.importProductsCsv(profileId, file, opts)
      const line = summarizeImport(res)
      if (kind === 'people') setPeopleResult(line)
      else setProductsResult(line)
      toast.ok(line)
      await loadEntities()
    } catch (e) {
      const msg = miErrorSentence(e.code, e.message)
      toast.push('err', msg)
      if (kind === 'people') setPeopleResult(msg)
      else setProductsResult(msg)
    } finally {
      setBusy(false)
    }
  }

  const runExport = async (kind) => {
    setBusy(true)
    try {
      const text =
        kind === 'people'
          ? await mi.exportPeopleCsv(profileId)
          : await mi.exportProductsCsv(profileId)
      downloadCsv(`${kind}.csv`, typeof text === 'string' ? text : String(text))
      toast.ok(`Downloaded ${kind}.csv`)
    } catch (e) {
      toast.push('err', miErrorSentence(e.code, e.message))
    } finally {
      setBusy(false)
    }
  }

  const enableKg = async () => {
    setBusy(true)
    try {
      await mi.enableKg(profileId, { step: 'enabled' })
      toast.ok('KG enable requested — applies to new jobs; meetings keep their snapshot.')
      if (onProfileReload) await onProfileReload()
    } catch (e) {
      toast.push('err', miErrorSentence(e.code, e.message))
    } finally {
      setBusy(false)
    }
  }

  const kb = rulesKb && typeof rulesKb === 'object' ? rulesKb : {}
  const enabled = kb.enabled === true || kb.enabled === 'true' || kb.enabled === 1

  return (
    <>
      <Card
        title="KB write token"
        hint="Optional. When the server sets MI_KB_TOKEN, directory and inbox writes need X-MI-KB-Token. Not the Call Center Bearer."
      >
        <TextField
          label="X-MI-KB-Token"
          value={token}
          onChange={onToken}
          type="password"
          autoComplete="off"
        />
      </Card>

      <Card
        title="Identity directory"
        hint="Directory is identity resolution, not a prompt. No auto-create people from speech in V1."
      >
        <label className="row tight" style={{ gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          Dry-run import (when the server supports dry_run)
        </label>

        <h3 className="section-sub">People</h3>
        <div className="row tight">
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              void runImport('people', f)
              e.target.value = ''
            }}
          />
          <button type="button" className="btn secondary sm" disabled={busy} onClick={() => void runExport('people')}>
            Export people CSV
          </button>
        </div>
        {peopleResult && <p className="desc">{peopleResult}</p>}

        <h3 className="section-sub">Products</h3>
        <div className="row tight">
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              void runImport('products', f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="btn secondary sm"
            disabled={busy}
            onClick={() => void runExport('products')}
          >
            Export products CSV
          </button>
        </div>
        {productsResult && <p className="desc">{productsResult}</p>}

        {listErr && <div className="probe err">{listErr}</div>}

        <h3 className="section-sub">People in archive</h3>
        {!people.length && <p className="desc">No people entities yet.</p>}
        {!!people.length && (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {people.map((e) => (
                <tr key={e.id}>
                  <td>{e.name ?? e.id}</td>
                  <td>{e.status ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3 className="section-sub">Products in archive</h3>
        {!products.length && <p className="desc">No product entities yet.</p>}
        {!!products.length && (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((e) => (
                <tr key={e.id}>
                  <td>{e.name ?? e.id}</td>
                  <td>{e.status ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card
        title="Enable KG (live rules.kb)"
        hint="Applies to new jobs; meetings keep their snapshot."
      >
        <p className="desc">
          Live status:{' '}
          <strong>{enabled ? 'enabled' : 'off'}</strong>
          {kb.resolve != null ? ` · resolve=${String(kb.resolve)}` : ''}
          {kb.extract != null ? ` · extract=${String(kb.extract)}` : ''}
        </p>
        <button type="button" className="btn" disabled={busy} onClick={() => void enableKg()}>
          Enable KG
        </button>
      </Card>
    </>
  )
}
