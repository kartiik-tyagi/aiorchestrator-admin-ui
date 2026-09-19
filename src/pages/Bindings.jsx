import { useCallback, useState } from 'react'
import { useCatalog } from '../api/catalog'
import { api, getTenant } from '../api/client'
import {
  Card,
  Empty,
  Field,
  markHue,
  Modal,
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
  const [status, setStatusField] = useState('active')
  const [mode, setMode] = useState('inline_faq')
  const [entries, setEntries] = useState([])
  const [gatewayId, setGatewayId] = useState('')
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState('knowledge')
  const [newMode, setNewMode] = useState('inline_faq')
  const [q, setQ] = useState('')
  const locales = catalog?.tts_locales_v1 ?? ['en-IN']
  const INTENT_RE = /^[a-z0-9][a-z0-9_]{0,63}$/
  const emptyFaqEntry = (n) => ({
    id: `faq_${n}`,
    questions: [],
    aliases: [],
    intents: [],
    department: '',
    product: '',
    text: {},
  })
  const acceptIntents = (next) => next.filter((x) => INTENT_RE.test(x))

  const allBindings = list.data?.bindings ?? []
  const bNeedle = q.trim().toLowerCase()
  const shownBindings = bNeedle
    ? allBindings.filter(
        (b) =>
          b.id.toLowerCase().includes(bNeedle) ||
          (b.name ?? '').toLowerCase().includes(bNeedle) ||
          (b.kind ?? '').toLowerCase().includes(bNeedle),
      )
    : allBindings
  const load = useCallback((b) => {
    setId(b.id)
    setName(b.name ?? '')
    setKind(b.kind)
    setStatusField(b.status)
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
    setStatusField('active')
    setMode('inline_faq')
    setEntries([])
    setGatewayId('')
    setPath('')
    setDirty(false)
  }
  const openCreate = () => {
    setNewId('')
    setNewName('')
    setNewKind('knowledge')
    setNewMode('inline_faq')
    setCreating(true)
  }

  /**
   * Creates the binding straight away with an empty config, then hands it to the
   * editor to fill in.
   *
   * PUT is create-or-update, so an id that already exists would silently
   * overwrite a live binding — including its entries. That is worth one
   * confirmation, since Inform nodes read this the moment it is saved.
   */
  const createBinding = async () => {
    const bid = newId.trim()
    if (!bid) {
      toast.push('err', 'Binding id required')
      return
    }
    const existing = list.data?.bindings?.find((b) => b.id === bid)
    if (
      existing &&
      !confirm(
        `"${bid}" already exists (${existing.kind}/${existing.status}).\n\n` +
          `Saving over it replaces its config, including any entries. Open it from the list ` +
          `instead if you meant to edit it.`,
      )
    )
      return

    const config = newKind === 'knowledge' ? { mode: newMode, entries: [] } : {}
    setBusy(true)
    try {
      const got = await api.putBinding(bid, {
        tenant_id: getTenant(),
        kind: newKind,
        name: newName.trim() || bid,
        status: 'active',
        config,
      })
      toast.ok(`Created ${got.id}`)
      setCreating(false)
      await list.reload()
      load({
        id: bid,
        name: newName.trim() || bid,
        kind: newKind,
        status: 'active',
        config,
      })
    } catch (e) {
      toast.fail(e, 'Create binding')
    } finally {
      setBusy(false)
    }
  }

  /**
   * The API has no DELETE for bindings, but the runtime honours status:
   * internal/runtime/graph/inform.go:55 refuses any binding that is not "active".
   * So disabling one genuinely stops it answering, and is reversible.
   */
  const setStatus = async (b, next) => {
    const verb = next === 'disabled' ? 'Disable' : 'Enable'
    if (
      next === 'disabled' &&
      !confirm(
        `Disable "${b.id}"?

Inform nodes using it will stop answering immediately. ` +
          `The binding is kept and you can re-enable it at any time.`,
      )
    )
      return
    try {
      await api.putBinding(b.id, {
        tenant_id: b.tenant_id || getTenant(),
        kind: b.kind,
        name: b.name,
        status: next,
        config: b.config ?? {},
      })
      toast.ok(`${verb}d ${b.id}`)
      if (id === b.id) setStatusField(next)
      await list.reload()
    } catch (e) {
      toast.fail(e, `${verb} binding`)
    }
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
      <div className="page-head has-actions">
        <div className="head-text">
          <h1>Bindings</h1>
          <p>
            Knowledge and CRM sources referenced by <code>Inform</code> nodes. A flow may only use a
            binding it declares in <code>binding_refs</code>. These fields are how the bot finds the
            answer — not just the words. There is no delete; Disable stops Inform without losing
            entries.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn secondary" onClick={() => void list.reload()}>
            Reload
          </button>
          <button className="btn" onClick={openCreate}>
            New binding
          </button>
        </div>
      </div>

      <div className="split">
        <div>
          <div className="list cards">
            {allBindings.length > 3 && (
              <div className="list-head">
                <input
                  type="search"
                  value={q}
                  placeholder="Filter bindings…"
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Filter bindings"
                />
                <span className="list-count">
                  {shownBindings.length}/{allBindings.length}
                </span>
              </div>
            )}
            <div className="list-scroll">
              {shownBindings.map((b) => {
                const bMode = b.config?.mode ?? 'inline_faq'
                const isFaq = b.kind === 'knowledge' && bMode === 'inline_faq'
                const n = Array.isArray(b.config?.entries) ? b.config.entries.length : 0
                return (
                  <button
                    type="button"
                    key={b.id}
                    className={`list-item ${id === b.id ? 'active' : ''} ${
                      b.status === 'active' ? '' : 'muted'
                    }`}
                    onClick={() => load(b)}
                  >
                    <span className="li-mark" style={{ '--mark-h': markHue(b.id) }}>
                      {b.id.trim().charAt(0)}
                    </span>
                    <span className="li-body">
                      <span className="li-main">
                        <span className="li-id">{b.id}</span>
                        <span className="li-badges">
                          {b.status !== 'active' && <span className="badge warn">disabled</span>}
                          {/* An inline_faq with no entries matches nothing, so the
                              Inform node fails closed to repair. Worth flagging. */}
                          {isFaq &&
                            (n === 0 ? (
                              <span className="badge warn">empty</span>
                            ) : (
                              <span className="badge">{n}</span>
                            ))}
                        </span>
                      </span>
                      <span className="li-sub">
                        {b.kind}
                        {b.kind === 'knowledge' ? ` · ${bMode}` : ''}
                      </span>
                    </span>
                  </button>
                )
              })}
              {!allBindings.length && (
                <div className="list-empty">
                  No bindings yet.
                  <br />
                  Use “New binding” to add one.
                </div>
              )}
              {!!allBindings.length && !shownBindings.length && (
                <div className="list-empty">No binding matches “{q}”.</div>
              )}
            </div>
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
                {id && list.data?.bindings?.some((b) => b.id === id) && (
                  <button
                    className={status === 'active' ? 'btn danger' : 'btn secondary'}
                    onClick={() => {
                      const b = list.data.bindings.find((x) => x.id === id)
                      void setStatus(b, status === 'active' ? 'disabled' : 'active')
                    }}
                    title={
                      status === 'active'
                        ? 'Stop this binding answering. Reversible.'
                        : 'Allow Inform nodes to use this binding again.'
                    }
                  >
                    {status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                )}
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
                  setStatusField(v)
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
              hint="These fields are how the bot finds the answer — not just the words. Intents, department, product and aliases stay on the entry when you save."
              actions={
                <button
                  className="btn secondary sm"
                  onClick={() => {
                    setEntries((xs) => [...xs, emptyFaqEntry(xs.length + 1)])
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
                    <div className="row">
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
                      <TextField
                        label="Department"
                        value={e.department ?? ''}
                        onChange={(v) =>
                          setEntry(i, {
                            department: v,
                          })
                        }
                        placeholder="sales"
                      />
                      <TextField
                        label="Product"
                        value={e.product ?? ''}
                        onChange={(v) =>
                          setEntry(i, {
                            product: v,
                          })
                        }
                        placeholder="Media Gateway"
                      />
                    </div>
                    <StringList
                      label="Intents"
                      values={e.intents ?? []}
                      onChange={(v) =>
                        setEntry(i, {
                          intents: acceptIntents(v),
                        })
                      }
                      placeholder="media_gateway"
                      desc="Must match an intent id on the profile that will use this binding. Use lowercase letters, digits and underscore."
                    />
                    <StringList
                      label="Aliases"
                      values={e.aliases ?? []}
                      onChange={(v) =>
                        setEntry(i, {
                          aliases: v,
                        })
                      }
                      placeholder="media gate bhege"
                      desc="Noisy or roman speech-to-text variants of the product or question."
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

      <Modal
        open={creating}
        title="New binding"
        hint="Created active with an empty config. Add FAQ entries in the editor and press Save binding."
        onClose={() => setCreating(false)}
        onSubmit={createBinding}
        busy={busy}
      >
        <TextField
          label="Binding id"
          value={newId}
          onChange={setNewId}
          placeholder="product-faq"
          mono
          desc="Inform nodes reference this id, and the flow must list it in binding_refs."
        />
        <TextField
          label="Name"
          value={newName}
          onChange={setNewName}
          placeholder="Coral product FAQ"
          desc="Shown in listings. Defaults to the id."
        />
        <div className="row">
          <SelectField
            label="Kind"
            value={newKind}
            onChange={setNewKind}
            options={catalog?.binding_kinds ?? ['knowledge', 'crm']}
            allowEmpty={false}
          />
          {newKind === 'knowledge' && (
            <SelectField
              label="Knowledge mode"
              value={newMode}
              onChange={setNewMode}
              options={catalog?.knowledge_modes ?? ['inline_faq', 'http_retrieve']}
              allowEmpty={false}
            />
          )}
        </div>
        {newKind === 'knowledge' && newMode === 'http_retrieve' && (
          <p className="inline-note">
            <strong>Not served yet.</strong> The kernel accepts <code>http_retrieve</code> at
            publish but fails closed at runtime — <code>inform.go</code> returns an error rather
            than calling out, so the Inform node takes its repair edge. Use <code>inline_faq</code>{' '}
            for anything that has to answer a live caller.
          </p>
        )}
        <p className="inline-note">
          Never put an <code>api_key</code> in a binding config — the server rejects it. Vendor keys
          belong in Engines → credentials.
        </p>
      </Modal>
    </div>
  )
}
