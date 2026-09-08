import { useCallback, useState } from 'react'
import { useCatalog } from '../api/catalog'
import { api, getTenant } from '../api/client'
import {
  Card,
  Empty,
  Field,
  SelectField,
  StringList,
  TextField,
  useAsync,
  useToast,
} from '../components/ui'
/**
 * Bindings are the knowledge/CRM sources an `Inform` node reads from.
 *
 * Two knowledge modes (server-validated in internal/control/bindings.go):
 *   inline_faq    — entries carried in the binding itself, answers per locale
 *   http_retrieve — delegate to a knowledge gateway
 * The server rejects any config containing `api_key`; keys belong in credentials.
 */
export default function Bindings() {
  const { catalog } = useCatalog()
  const toast = useToast()
  const list = useAsync(() => api.listBindings(), [])
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState('knowledge')
  const [status, setStatus] = useState('active')
  const [mode, setMode] = useState('inline_faq')
  const [entries, setEntries] = useState([])
  const [gatewayId, setGatewayId] = useState('')
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const locales = catalog?.tts_locales_v1 ?? ['en-IN']
  const load = useCallback((b) => {
    setId(b.id)
    setName(b.name ?? '')
    setKind(b.kind)
    setStatus(b.status)
    const cfg = b.config ?? {}
    setMode(cfg.mode ?? 'inline_faq')
    setEntries(Array.isArray(cfg.entries) ? cfg.entries : [])
    setGatewayId(cfg.gateway_id ?? '')
    setPath(cfg.path ?? '')
    setDirty(false)
  }, [])
  const reset = () => {
    setId('')
    setName('')
    setKind('knowledge')
    setStatus('active')
    setMode('inline_faq')
    setEntries([])
    setGatewayId('')
    setPath('')
    setDirty(false)
  }
  const save = async () => {
    const bid = id.trim()
    if (!bid) {
      toast.push('err', 'Binding id required')
      return
    }
    const config =
      kind === 'knowledge'
        ? mode === 'inline_faq'
          ? {
              mode,
              entries,
            }
          : {
              mode,
              gateway_id: gatewayId.trim(),
              path: path.trim(),
            }
        : {}
    setBusy(true)
    try {
      const got = await api.putBinding(bid, {
        tenant_id: getTenant(),
        kind,
        name: name.trim() || bid,
        status,
        config,
      })
      toast.ok(`Saved ${got.id} (${got.kind}/${got.status})`)
      setDirty(false)
      await list.reload()
    } catch (e) {
      toast.fail(e, 'Save binding')
    } finally {
      setBusy(false)
    }
  }
  const setEntry = (i, p) => {
    setEntries((xs) =>
      xs.map((e, n) =>
        n === i
          ? {
              ...e,
              ...p,
            }
          : e,
      ),
    )
    setDirty(true)
  }
  return (
    <div className="content">
      <div className="page-head">
        <h1>Bindings</h1>
        <p>
          Knowledge and CRM sources referenced by <code>Inform</code> nodes. A flow may only use a
          binding it declares in <code>binding_refs</code>, and the answer text is per locale.
        </p>
      </div>

      <div className="split">
        <div>
          <div className="list">
            {(list.data?.bindings ?? []).map((b) => (
              <div
                key={b.id}
                className={`list-item ${id === b.id ? 'active' : ''}`}
                onClick={() => load(b)}
              >
                <div className="mono">{b.id}</div>
                <div className="sub">
                  {b.kind} · {b.status}
                  {Array.isArray(b.config?.entries) ? ` · ${b.config.entries.length} entries` : ''}
                </div>
              </div>
            ))}
            {!list.data?.bindings?.length && <div className="empty">No bindings</div>}
          </div>
          <div className="actions">
            <button className="btn secondary" onClick={reset}>
              New binding
            </button>
            <button className="btn secondary" onClick={() => void list.reload()}>
              Reload
            </button>
          </div>
        </div>

        <div>
          <Card
            title={id ? `Binding: ${id}` : 'New binding'}
            hint="PUT is create-or-update. Never put an api_key in config — the server rejects it; use Engines → credentials instead."
            actions={
              <>
                <button className="btn" onClick={save} disabled={busy}>
                  {busy ? 'Saving…' : 'Save binding'}
                </button>
                {dirty && <span className="badge warn">unsaved changes</span>}
              </>
            }
          >
            <div className="row">
              <TextField
                label="Binding id"
                value={id}
                onChange={(v) => {
                  setId(v)
                  setDirty(true)
                }}
                placeholder="product-faq"
                mono
              />
              <TextField
                label="Name"
                value={name}
                onChange={(v) => {
                  setName(v)
                  setDirty(true)
                }}
              />
            </div>
            <div className="row">
              <SelectField
                label="Kind"
                value={kind}
                onChange={(v) => {
                  setKind(v)
                  setDirty(true)
                }}
                options={catalog?.binding_kinds ?? ['knowledge', 'crm']}
                allowEmpty={false}
              />
              <SelectField
                label="Status"
                value={status}
                onChange={(v) => {
                  setStatus(v)
                  setDirty(true)
                }}
                options={catalog?.binding_statuses ?? ['active', 'disabled']}
                allowEmpty={false}
              />
              {kind === 'knowledge' && (
                <SelectField
                  label="Knowledge mode"
                  value={mode}
                  onChange={(v) => {
                    setMode(v)
                    setDirty(true)
                  }}
                  options={catalog?.knowledge_modes ?? ['inline_faq', 'http_retrieve']}
                  allowEmpty={false}
                />
              )}
            </div>
          </Card>

          {kind === 'knowledge' && mode === 'http_retrieve' && (
            <Card title="HTTP retrieve">
              <div className="row">
                <TextField
                  label="gateway_id"
                  value={gatewayId}
                  onChange={(v) => {
                    setGatewayId(v)
                    setDirty(true)
                  }}
                  mono
                />
                <TextField
                  label="path"
                  value={path}
                  onChange={(v) => {
                    setPath(v)
                    setDirty(true)
                  }}
                  placeholder="/v1/retrieve"
                  mono
                />
              </div>
            </Card>
          )}

          {kind === 'knowledge' && mode === 'inline_faq' && (
            <Card
              title={`Inline FAQ — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`}
              hint="Each entry matches on its questions and answers in the caller's active locale. A missing locale is what triggers the FAQ locale warnings on flow publish."
              actions={
                <button
                  className="btn secondary sm"
                  onClick={() => {
                    setEntries((xs) => [
                      ...xs,
                      {
                        id: `faq_${xs.length + 1}`,
                        questions: [],
                        text: {},
                      },
                    ])
                    setDirty(true)
                  }}
                >
                  Add entry
                </button>
              }
            >
              {!entries.length && <Empty>No entries yet.</Empty>}
              {entries.map((e, i) => (
                <details className="section" key={i}>
                  <summary>
                    {e.id || `entry ${i + 1}`}
                    <span className="tag">
                      {Object.keys(e.text ?? {}).length}/{locales.length} locales
                    </span>
                  </summary>
                  <div className="body">
                    <TextField
                      label="Entry id"
                      value={e.id ?? ''}
                      onChange={(v) =>
                        setEntry(i, {
                          id: v,
                        })
                      }
                      mono
                    />
                    <StringList
                      label="Questions"
                      values={e.questions ?? []}
                      onChange={(v) =>
                        setEntry(i, {
                          questions: v,
                        })
                      }
                      placeholder="what is IRIS IVDX"
                      desc="Matched against the caller utterance."
                    />
                    <Field label="Answer text per locale">
                      {locales.map((loc) => (
                        <div
                          key={loc}
                          style={{
                            display: 'flex',
                            gap: '0.4rem',
                            marginBottom: '0.3rem',
                          }}
                        >
                          <code
                            style={{
                              fontSize: 11,
                              width: 52,
                              paddingTop: 6,
                              flex: '0 0 52px',
                            }}
                          >
                            {loc}
                          </code>
                          <textarea
                            rows={2}
                            value={e.text?.[loc] ?? ''}
                            placeholder={
                              loc === 'en-IN' ? 'required for the default locale' : 'optional'
                            }
                            onChange={(ev) =>
                              setEntry(i, {
                                text: {
                                  ...(e.text ?? {}),
                                  [loc]: ev.target.value,
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </Field>
                    <div className="actions tight">
                      <button
                        className="btn danger sm"
                        onClick={() => {
                          setEntries((xs) => xs.filter((_, n) => n !== i))
                          setDirty(true)
                        }}
                      >
                        Remove entry
                      </button>
                    </div>
                  </div>
                </details>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
