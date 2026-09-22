import { useEffect, useState } from 'react'
import { useCatalog } from '../../api/catalog'
import {
  CheckField,
  ChipMulti,
  Field,
  NumberField,
  SelectField,
  StringList,
  TextField,
  ToggleField,
} from '../../components/ui'
import { INTERRUPT_MODES, SESSION_TEMPLATE_KEYS } from '../../api/types.js'
import { CHOICE_KINDS, LISTEN_TYPES, intentSuggestions } from '../../lib/flowGraph'
import Connections from './Connections'
import DecideEditor from './DecideEditor'
import FlowPolicy from './FlowPolicy'
import SlotEditor from './SlotEditor'
import { NODE_COLOR } from './GraphNode'
import { PanelSection } from './PanelSection'
import {
  IconAlert,
  IconArrowOut,
  IconGear,
  IconLink,
  IconLocate,
  IconMessage,
  IconRepeat,
  IconSliders,
  IconTable,
  IconTrash,
} from './icons'

// Node types whose prompt_ref the cursor actually reads (Speak line, Tool
// closing line, Listen re-ask). Others only show the field if one is set.
const PROMPTED_TYPES = ['Speak', 'Tool', ...LISTEN_TYPES]

/**
 * Right-hand properties panel. Shows the selected node or edge, or the flow's
 * document-level settings when nothing is selected.
 *
 * Every enum here binds to GET /v1/meta/catalog (doc 13 OD-13-3) — the UI must
 * never offer a node type, edge kind, tool or disposition the kernel rejects.
 */

/**
 * Text field for an identifier.
 *
 * Ids cannot be edited live: every keystroke would rename the node, rewrite all
 * its edges, and — because the canvas tracks the selection by id — instantly
 * deselect the thing you are typing into. So this keeps a local draft and only
 * commits on blur or Enter, with Escape to abandon and inline validation so a
 * rejected rename explains itself instead of silently doing nothing.
 */
function IdField({ label, value, onCommit, validate, desc }) {
  const [draft, setDraft] = useState(value)
  const [err, setErr] = useState('')

  useEffect(() => {
    setDraft(value)
    setErr('')
  }, [value])

  const commit = () => {
    const next = draft.trim()
    if (next === value) {
      setErr('')
      return
    }
    const problem = validate(next)
    if (problem) {
      setErr(problem)
      return
    }
    setErr('')
    onCommit(next)
  }

  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="text"
        className="mono"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setDraft(value)
            setErr('')
          }
          // Delete/Backspace must not reach the canvas shortcut while typing.
          e.stopPropagation()
        }}
        aria-invalid={err ? 'true' : undefined}
        style={err ? { borderColor: 'var(--err)' } : undefined}
      />
      {err ? (
        <p className="desc" style={{ color: 'var(--err)' }}>
          {err}
        </p>
      ) : (
        desc && <p className="desc">{desc}</p>
      )}
    </div>
  )
}

/**
 * Per-locale text for one prompt_ref.
 *
 * The kernel resolves a prompt by looking up `prompts[ref][active_language]`,
 * so a ref on its own is only half the setting — without text the lookup fails.
 * Editing the id and editing the words therefore always appear together.
 *
 * Eleven textareas is most of a screen and most flows speak two languages, so
 * only the default locale and locales that already have text are shown; the
 * rest are one click away.
 */
function PromptLocaleEditor({ promptRef, doc, setDoc, locales, label }) {
  const promptLocales = doc.prompts[promptRef] ?? {}
  const [showAll, setShowAll] = useState(false)
  const shown = locales.filter(
    (loc) => showAll || loc === doc.default_locale || (promptLocales[loc] ?? '') !== '',
  )
  const hidden = locales.length - shown.length
  const insertToken = (loc, token) => {
    const cur = promptLocales[loc] ?? ''
    setDoc((d) => ({
      ...d,
      prompts: {
        ...d.prompts,
        [promptRef]: {
          ...(d.prompts[promptRef] ?? {}),
          [loc]: `${cur}${token}`,
        },
      },
    }))
  }
  return (
    <Field
      label={label ?? `Prompt text — ${promptRef}`}
      desc={`Templates: {{slot.<key>}} or {{session.${SESSION_TEMPLATE_KEYS.join('|')}}}. Unknown session.* fails publish.`}
    >
      {shown.map((loc) => (
        <div className="locale-row" key={loc}>
          <code className={loc === doc.default_locale ? 'default' : undefined}>{loc}</code>
          <div style={{ flex: 1 }}>
            <textarea
              rows={2}
              value={promptLocales[loc] ?? ''}
              placeholder={
                loc === doc.default_locale
                  ? 'required — e.g. Hello {{slot.customer_name}}'
                  : 'optional'
              }
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  prompts: {
                    ...d.prompts,
                    [promptRef]: {
                      ...(d.prompts[promptRef] ?? {}),
                      [loc]: e.target.value,
                    },
                  },
                }))
              }
            />
            <div className="chips" style={{ marginTop: 4 }}>
              {SESSION_TEMPLATE_KEYS.map((k) => (
                <span
                  key={k}
                  className="chip"
                  style={{ cursor: 'pointer' }}
                  onClick={() => insertToken(loc, `{{session.${k}}}`)}
                  title={`Insert {{session.${k}}}`}
                >
                  session.{k}
                </span>
              ))}
              <span
                className="chip"
                style={{ cursor: 'pointer' }}
                onClick={() => insertToken(loc, '{{slot.')}
                title="Start a slot template"
              >
                slot.…
              </span>
            </div>
          </div>
        </div>
      ))}
      {(hidden > 0 || showAll) && (
        <button type="button" className="link-btn" onClick={() => setShowAll((v) => !v)}>
          {showAll
            ? 'Show only locales with text'
            : `+ ${hidden} more locale${hidden > 1 ? 's' : ''}`}
        </button>
      )}
    </Field>
  )
}

/**
 * `repair.unclear_prompt_ref` — the line the bot re-asks with when it could not
 * place what the caller said.
 *
 * This field used to take an id and nothing else, which is a trap: neither
 * validator checks it (the Go publish loop only reads `node.prompt_ref`, and
 * `node.repair` stays raw JSON until runtime), so a ref with no prompt behind
 * it publishes clean and then throws `prompt_ref %q missing` the first time a
 * caller is unclear — which fails the turn, plays the operator fallback and
 * releases the call.
 *
 * There is no prompt generation anywhere in the kernel to lean on. The nearest
 * thing, `speak_render: smart`, only paraphrases text that already exists into
 * another locale, and repair prompts never even reach it: `repairLocked` calls
 * the plain configured resolver, not the smart one. So the words have to come
 * from a human — either reused from a prompt this flow already defines, or
 * written here.
 *
 * Remounted per node by its caller, so the mode resets with the selection.
 */
function RepairPromptField({ node, doc, setDoc, locales, patchNode }) {
  const ref = (node.repair?.unclear_prompt_ref ?? '').trim()
  const defined = Object.keys(doc.prompts ?? {})
  const missing = ref !== '' && !doc.prompts?.[ref]

  // Start in "write" when the ref is dangling — that is the state that needs
  // fixing, and dropping the user straight into the editor says so.
  const [write, setWrite] = useState(missing)

  const setRef = (v) =>
    patchNode(node.id, {
      repair: {
        ...(node.repair ?? {}),
        unclear_prompt_ref: v,
      },
    })

  const toggle = (next) => {
    if (next && !ref) setRef(`p_${node.id}_unclear`)
    setWrite(next)
  }

  const preview = ref ? (doc.prompts?.[ref]?.[doc.default_locale] ?? '').trim() : ''
  // In write mode an empty prompt is simply not filled in yet, so the loud
  // "does not exist" warning would fire the moment the switch is flipped. What
  // matters there is the same thing publish cares about: default-locale text.
  const needsText = write && ref !== '' && preview === ''

  return (
    <>
      <ToggleField
        label="Unclear prompt"
        checked={write}
        onChange={toggle}
        onLabel="Write the wording here"
        offLabel="Reuse a prompt this flow already has"
        desc={
          write
            ? 'The text below is what the caller hears on a re-ask. Nothing generates it for you — the default locale is required to publish.'
            : 'Points at an existing prompt. Leave it unset and the node re-asks with its own prompt_ref instead.'
        }
      />

      {write ? (
        <>
          <TextField
            label="unclear_prompt_ref"
            value={ref}
            onChange={setRef}
            mono
            desc="Key this wording is stored under in the prompts table."
          />
          {ref && (
            <PromptLocaleEditor promptRef={ref} doc={doc} setDoc={setDoc} locales={locales} />
          )}
        </>
      ) : (
        <>
          <SelectField
            label="unclear_prompt_ref"
            value={ref}
            onChange={setRef}
            // Carry a dangling ref as an option, or the select renders blank and
            // reads as "none" while the warning below names a prompt.
            options={missing ? [...defined, ref] : defined}
            emptyLabel="— none: re-ask with this node's own prompt —"
          />
          {ref && preview && (
            <p className="desc" style={{ marginTop: '-0.4rem' }}>
              <span className="mono">{doc.default_locale}</span>: “{preview}”
            </p>
          )}
        </>
      )}

      {missing && !write && (
        <p className="inline-note" style={{ borderLeftColor: 'var(--err)' }}>
          <strong>No prompt named “{ref}”.</strong> The kernel publishes this without complaint and
          then fails the call on the first unclear reply. Write the text, or pick a prompt that
          exists.
        </p>
      )}
      {needsText && (
        <p className="inline-note" style={{ borderLeftColor: 'var(--warn)' }}>
          Needs text for <code>{doc.default_locale}</code> before this flow can publish.
        </p>
      )}
    </>
  )
}

/** Compact header for whatever the panel is showing: type, name, quick actions. */
function HeaderCard({ color, kicker, title, sub, children }) {
  return (
    <div className="insp-card" style={{ '--type-color': color }}>
      <div className="insp-card-main">
        <span className="insp-kicker">{kicker}</span>
        <span className="insp-title">{title}</span>
        {sub && <span className="insp-sub">{sub}</span>}
      </div>
      {children && <div className="insp-card-actions">{children}</div>}
    </div>
  )
}

/** Problems that belong to the thing on screen, so they are not only in the global list. */
function OwnIssues({ issues }) {
  if (!issues.length) return null
  return (
    <ul className="own-issues">
      {issues.map((i, k) => (
        <li key={k} className={i.level}>
          <IconAlert size={12} />
          <span>{i.message}</span>
        </li>
      ))}
    </ul>
  )
}

function NodeChip({ id, node, onClick }) {
  return (
    <button
      type="button"
      className={`node-chip ${node ? '' : 'broken'}`}
      onClick={() => node && onClick?.(id)}
      title={node ? `Go to ${id}` : `No node named "${id}"`}
    >
      <span
        className="chip-swatch"
        style={{ background: node ? NODE_COLOR[node.type] : 'var(--err)' }}
      />
      <span className="chip-id">{id}</span>
    </button>
  )
}

export default function Inspector({
  doc,
  setDoc,
  selNode,
  selEdge,
  onDeleteNode,
  onDeleteEdge,
  onNodeRenamed,
  onEdgeRenamed,
  focusIntent,
  bindingIds,
  layout,
  issues = [],
  onCreateEdge,
  onFocusNode,
  onHoverEdge,
  allowedIntentIds = [],
  catalogProfileId = '',
  onCatalogProfileId,
  profileIds = [],
  apiIntegrationIds = [],
  onEnsureApiToolResults,
}) {
  const { catalog } = useCatalog()
  const nodeIds = doc.nodes.map((n) => n.id)
  const locales = catalog?.tts_locales_v1 ?? ['en-IN']
  const kinds = catalog?.edge_kinds ?? []
  const interruptModes = catalog?.interrupt_modes?.length
    ? catalog.interrupt_modes
    : INTERRUPT_MODES
  const flowInterruptModes = catalog?.flow_interrupt_modes?.length
    ? catalog.flow_interrupt_modes
    : INTERRUPT_MODES
  const promptKeys = Object.keys(doc.prompts ?? {})
  const byId = new Map(doc.nodes.map((n) => [n.id, n]))
  const patchNode = (id, p) =>
    setDoc((d) => ({
      ...d,
      nodes: d.nodes.map((n) => {
        if (n.id !== id) return n
        const next = { ...n, ...p }
        for (const [k, v] of Object.entries(p)) {
          if (v === undefined) delete next[k]
        }
        return next
      }),
    }))
  const patchListenPolicy = (n, p) => {
    const next = { ...(n.listen_policy ?? {}), ...p }
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === '') delete next[k]
    }
    patchNode(n.id, { listen_policy: Object.keys(next).length ? next : undefined })
  }
  const globalEdges = doc.edges.filter((e) => (e.kind ?? '') === 'global')
  const globalMatchers = [
    ...new Set(
      (doc.globals ?? [])
        .map((id) => doc.edges.find((e) => e.id === id))
        .filter(Boolean)
        .map((e) => (e.intent || e.option || '').trim())
        .filter(Boolean),
    ),
  ]
  const patchEdge = (id, p) =>
    setDoc((d) => ({
      ...d,
      edges: d.edges.map((e) =>
        e.id === id
          ? {
              ...e,
              ...p,
            }
          : e,
      ),
    }))

  /** Renaming a node has to carry every reference with it. */
  const renameNode = (oldId, newId) => {
    const id = newId.trim()
    if (!id || id === oldId || nodeIds.includes(id)) return
    setDoc((d) => ({
      ...d,
      entry_node_id: d.entry_node_id === oldId ? id : d.entry_node_id,
      nodes: d.nodes.map((n) =>
        n.id === oldId
          ? {
              ...n,
              id,
            }
          : n,
      ),
      edges: d.edges.map((e) => ({
        ...e,
        from: e.from === oldId ? id : e.from,
        to: e.to === oldId ? id : e.to,
      })),
    }))
  }

  /* ------------------------------------------------------------ node panel */
  if (selNode) {
    const n = selNode
    const outCount = doc.edges.filter((e) => e.from === n.id).length
    const inCount = doc.edges.filter((e) => e.to === n.id).length
    const hasRepair = !!n.repair && Object.keys(n.repair).length > 0
    const showRepair = LISTEN_TYPES.includes(n.type) || hasRepair
    const showPrompt = PROMPTED_TYPES.includes(n.type) || !!n.prompt_ref
    const sub =
      n.type === 'Tool'
        ? `${n.tool || 'no verb'}${n.matrix_intent ? ` → ${n.matrix_intent}` : ''}`
        : n.type === 'Inform'
          ? n.binding_ref || 'no binding'
          : n.prompt_ref || null
    return (
      <>
        <HeaderCard
          color={NODE_COLOR[n.type] ?? 'var(--border-3)'}
          kicker={
            <>
              {n.type}
              {doc.entry_node_id === n.id && <span className="gentry">ENTRY</span>}
            </>
          }
          title={n.id}
          sub={sub}
        >
          <button
            type="button"
            className="icon-btn"
            onClick={() => onFocusNode?.(n.id)}
            title="Show on canvas"
            aria-label="Show on canvas"
          >
            <IconLocate size={14} />
          </button>
          <button
            type="button"
            className="icon-btn danger"
            onClick={() => onDeleteNode(n.id)}
            title="Delete node (Del)"
            aria-label="Delete node"
          >
            <IconTrash size={14} />
          </button>
        </HeaderCard>
        <OwnIssues issues={issues.filter((i) => i.ref === n.id)} />

        <PanelSection
          id="connections"
          title="Connections"
          icon={<IconLink size={14} />}
          meta={
            <span className="io-meta">
              <span title="Connects to">{outCount} out</span>
              <span title="Connected from">{inCount} in</span>
            </span>
          }
        >
          <Connections
            key={n.id}
            node={n}
            doc={doc}
            setDoc={setDoc}
            kinds={kinds}
            layout={layout}
            locales={locales}
            onCreateEdge={onCreateEdge}
            onDeleteEdge={onDeleteEdge}
            onFocusNode={onFocusNode}
            onHoverEdge={onHoverEdge}
          />
        </PanelSection>

        <PanelSection id="properties" title="Properties" icon={<IconSliders size={14} />}>
          <IdField
            label="Node id"
            value={n.id}
            validate={(next) => {
              if (!next) return 'Node id cannot be empty'
              if (next !== n.id && nodeIds.includes(next)) return `"${next}" is already a node id`
              return null
            }}
            onCommit={(next) => {
              renameNode(n.id, next)
              onNodeRenamed?.(n.id, next)
            }}
            desc="Press Enter or click away to apply. Renaming updates every edge, the entry pointer and the saved layout."
          />
          <SelectField
            label="Type"
            value={n.type}
            onChange={(v) =>
              patchNode(n.id, {
                type: v,
              })
            }
            options={catalog?.node_types ?? []}
            allowEmpty={false}
          />

          {n.type === 'Tool' && (
            <>
              <SelectField
                label="Tool verb"
                value={n.tool ?? ''}
                onChange={(v) => {
                  const p = {
                    tool: v,
                  }
                  if (v === 'api') {
                    p.interrupt = n.interrupt || 'off'
                    if (n.matrix_intent) p.matrix_intent = undefined
                  }
                  if (v !== 'api' && n.api_id) p.api_id = undefined
                  patchNode(n.id, p)
                }}
                options={catalog?.tools ?? ['transfer', 'hangup', 'api']}
                desc={
                  n.tool === 'api'
                    ? 'Tool(api) is non-terminal: HTTP runs, slots update, then a tool_result edge continues the graph.'
                    : 'transfer / hangup arm irreversibly: barge off → closing line → execute (terminal).'
                }
              />
              {n.tool === 'transfer' && (
                <SelectField
                  label="matrix_intent"
                  value={n.matrix_intent ?? ''}
                  onChange={(v) =>
                    patchNode(n.id, {
                      matrix_intent: v,
                    })
                  }
                  options={doc.matrix.map((m) => m.intent)}
                  desc="Destination comes from the routing matrix — never typed on the node."
                />
              )}
              {n.tool === 'api' && (
                <>
                  <SelectField
                    label="api_id"
                    value={n.api_id ?? ''}
                    onChange={(v) =>
                      patchNode(n.id, {
                        api_id: v || undefined,
                      })
                    }
                    options={apiIntegrationIds}
                    desc={
                      apiIntegrationIds.length
                        ? 'Must match an api_integrations id on the bound profile.'
                        : 'Bind a profile with api_integrations (flow settings), or add integrations on that profile first.'
                    }
                  />
                  <p className="desc" style={{ marginTop: 0 }}>
                    prompt_ref on Tool(api) is an optional wait/filler line before HTTP. Leave empty
                    to call immediately after ARM.
                  </p>
                  <div className="actions tight">
                    <button
                      type="button"
                      className="btn secondary sm"
                      onClick={() => onEnsureApiToolResults?.(n.id)}
                    >
                      Ensure success / fail / error edges
                    </button>
                  </div>
                  <p className="desc">
                    Required: three outgoing edges kind=tool_result with option success, fail, and
                    error.
                  </p>
                </>
              )}
            </>
          )}

          {n.type === 'Inform' && (
            <SelectField
              label="binding_ref"
              value={n.binding_ref ?? ''}
              onChange={(v) =>
                setDoc((d) => ({
                  ...d,
                  nodes: d.nodes.map((x) => (x.id === n.id ? { ...x, binding_ref: v } : x)),
                  // Keep binding_refs in step, or publish fails validation — the
                  // operator should not have to leave the node to declare it.
                  binding_refs:
                    v && !(d.binding_refs ?? []).includes(v)
                      ? [...(d.binding_refs ?? []), v]
                      : d.binding_refs,
                }))
              }
              options={bindingIds}
              desc="Picking one also adds it to the flow's binding_refs list."
            />
          )}

          {n.type === 'Entry' && doc.entry_node_id !== n.id && (
            <div className="actions tight">
              <button
                className="btn secondary sm"
                onClick={() =>
                  setDoc((d) => ({
                    ...d,
                    entry_node_id: n.id,
                  }))
                }
              >
                Make this the entry node
              </button>
            </div>
          )}
        </PanelSection>

        {(['Speak', 'Inform'].includes(n.type) || n.interrupt || n.mandatory_delivery != null) && (
          <PanelSection id="interrupt" title="Interrupt / Delivery" icon={<IconSliders size={14} />}>
            <SelectField
              label="interrupt"
              value={n.interrupt ?? ''}
              onChange={(v) =>
                patchNode(n.id, {
                  interrupt: v || undefined,
                  interrupt_after_ms: v === 'after_ms' ? n.interrupt_after_ms : undefined,
                })
              }
              options={interruptModes}
              emptyLabel="— omit (inherit) —"
            />
            {n.interrupt === 'after_ms' && (
              <NumberField
                label="interrupt_after_ms"
                value={n.interrupt_after_ms}
                onChange={(v) => patchNode(n.id, { interrupt_after_ms: v })}
              />
            )}
            <CheckField
              label="mandatory_delivery"
              checked={n.mandatory_delivery === true}
              onChange={(v) => patchNode(n.id, { mandatory_delivery: v ? true : undefined })}
              desc="Forces barge off for this line. Cannot combine with interrupt on or after_ms."
            />
          </PanelSection>
        )}

        {(LISTEN_TYPES.includes(n.type) || n.listen_policy) && (
          <PanelSection id="listen-policy" title="Listen policy" icon={<IconRepeat size={14} />}>
            <NumberField
              label="timeout_ms"
              value={n.listen_policy?.timeout_ms}
              onChange={(v) => patchListenPolicy(n, { timeout_ms: v })}
            />
            <NumberField
              label="retries"
              value={n.listen_policy?.retries}
              onChange={(v) => patchListenPolicy(n, { retries: v })}
            />
            <SelectField
              label="repair_edge_id"
              value={n.listen_policy?.repair_edge_id ?? ''}
              onChange={(v) => patchListenPolicy(n, { repair_edge_id: v || undefined })}
              options={doc.edges.filter((e) => e.from === n.id).map((e) => e.id)}
              emptyLabel="— none —"
            />
            <SelectField
              label="exhausted_edge_id"
              value={n.listen_policy?.exhausted_edge_id ?? ''}
              onChange={(v) => patchListenPolicy(n, { exhausted_edge_id: v || undefined })}
              options={doc.edges.filter((e) => e.from === n.id).map((e) => e.id)}
              emptyLabel="— none —"
              desc="Editing listen_policy does not remove the repair object on this node."
            />
          </PanelSection>
        )}

        {LISTEN_TYPES.includes(n.type) && (
          <PanelSection id="intents" title="Intents" icon={<IconMessage size={14} />}>
            <ChipMulti
              label="allowed_intents"
              options={[
                ...new Set([
                  ...allowedIntentIds,
                  ...(n.allowed_intents ?? []),
                ]),
              ]}
              selected={n.allowed_intents ?? []}
              onChange={(v) => patchNode(n.id, { allowed_intents: v.length ? v : undefined })}
              desc="Catalog ids from the selected profile. Global-scope intents stay out of this list."
            />
            <ChipMulti
              label="global_intents"
              options={[...new Set([...globalMatchers, ...(n.global_intents ?? [])])]}
              selected={n.global_intents ?? []}
              onChange={(v) => patchNode(n.id, { global_intents: v.length ? v : undefined })}
              desc="Matchers of edges listed on the flow globals. Empty until you opt this listen step in."
            />
          </PanelSection>
        )}

        {n.type === 'ListenSlot' && (
          <PanelSection id="slot" title="Slot" icon={<IconSliders size={14} />}>
            <SlotEditor
              slot={n.slot}
              onChange={(slot) => patchNode(n.id, { slot })}
              catalog={catalog}
            />
          </PanelSection>
        )}

        {n.type === 'Decide' && (
          <PanelSection id="decide" title="Decide" icon={<IconGear size={14} />}>
            <DecideEditor
              node={n}
              doc={doc}
              onChange={(decide) => patchNode(n.id, { decide })}
            />
          </PanelSection>
        )}

        {showPrompt && (
          <PanelSection
            id="prompt"
            title="Prompt"
            icon={<IconMessage size={14} />}
            meta={n.prompt_ref ? <code>{n.prompt_ref}</code> : 'none'}
          >
            <TextField
              label="prompt_ref"
              value={n.prompt_ref ?? ''}
              onChange={(v) =>
                patchNode(n.id, {
                  prompt_ref: v,
                })
              }
              mono
              suggestions={promptKeys}
              desc="Key into the prompts table — pick an existing one to reuse its wording. Needs text in the default locale to publish."
            />
            {n.prompt_ref && (
              <PromptLocaleEditor
                key={n.prompt_ref}
                promptRef={n.prompt_ref}
                doc={doc}
                setDoc={setDoc}
                locales={locales}
                label="Wording per locale"
              />
            )}
          </PanelSection>
        )}

        {/* Repair is a listen-node policy (flow.RepairPolicy); on any other
            node the fields did nothing. Still shown if a document carries one. */}
        {showRepair && (
          <PanelSection
            id="repair"
            title="Repair policy"
            icon={<IconRepeat size={14} />}
            meta={n.repair?.max_retries != null ? `${n.repair.max_retries} retries` : null}
          >
            <NumberField
              label="max_retries"
              value={n.repair?.max_retries}
              onChange={(v) =>
                patchNode(n.id, {
                  repair: {
                    ...(n.repair ?? {}),
                    max_retries: v,
                  },
                })
              }
              desc="How many times this node re-asks before the repair ladder exhausts."
            />
            <RepairPromptField
              key={n.id}
              node={n}
              doc={doc}
              setDoc={setDoc}
              locales={locales}
              patchNode={patchNode}
            />
          </PanelSection>
        )}
      </>
    )
  }

  /* ------------------------------------------------------------ edge panel */
  if (selEdge) {
    const e = selEdge
    const fromNode = byId.get(e.from)
    const choice = CHOICE_KINDS.includes(e.kind)
    const showMatrix =
      (fromNode?.type === 'Tool' && fromNode.tool === 'transfer') || !!e.matrix_intent
    return (
      <div key={e.id}>
        <HeaderCard
          color="var(--accent)"
          kicker={<span className={`kind-pill k-${e.kind}`}>{e.kind}</span>}
          title={
            <span className="insp-route">
              <NodeChip id={e.from} node={fromNode} onClick={onFocusNode} />
              <IconArrowOut size={13} />
              <NodeChip id={e.to} node={byId.get(e.to)} onClick={onFocusNode} />
            </span>
          }
          sub={choice ? e.intent || e.option || `needs ${e.kind}` : null}
        >
          <button
            type="button"
            className="icon-btn danger"
            onClick={() => onDeleteEdge(e.id)}
            title="Delete connection (Del)"
            aria-label="Delete connection"
          >
            <IconTrash size={14} />
          </button>
        </HeaderCard>
        <OwnIssues issues={issues.filter((i) => i.ref === e.id)} />

        <PanelSection id="edge" title="Connection" icon={<IconLink size={14} />}>
          <IdField
            label="Edge id"
            value={e.id}
            validate={(next) => {
              if (!next) return 'Edge id cannot be empty'
              if (next !== e.id && doc.edges.some((x) => x.id === next))
                return `"${next}" is already an edge id`
              return null
            }}
            onCommit={(next) => {
              patchEdge(e.id, { id: next })
              onEdgeRenamed?.(next)
            }}
            desc="Press Enter or click away to apply."
          />
          <SelectField
            label="Kind"
            value={e.kind}
            onChange={(v) =>
              patchEdge(e.id, {
                kind: v,
              })
            }
            options={kinds}
            allowEmpty={false}
            desc="The closed set of legal moves. The LLM may only pick from edges leaving the current node."
          />
          <div className="conn-grid">
            <SelectField
              label="From"
              value={e.from}
              onChange={(v) =>
                patchEdge(e.id, {
                  from: v,
                })
              }
              options={nodeIds}
              allowEmpty={false}
            />
            <SelectField
              label="To"
              value={e.to}
              onChange={(v) =>
                patchEdge(e.id, {
                  to: v,
                })
              }
              options={nodeIds}
              allowEmpty={false}
            />
          </div>
          {(choice || !!e.intent || !!e.option) && (
            <>
              <TextField
                label="intent"
                value={e.intent ?? ''}
                onChange={(v) =>
                  patchEdge(e.id, {
                    intent: v,
                  })
                }
                mono
                suggestions={intentSuggestions(doc, fromNode, locales)}
                autoFocus={focusIntent && e.kind === 'intent'}
                desc="Label the classifier matches against for intent edges."
              />
              <TextField
                label="option"
                value={e.option ?? ''}
                onChange={(v) =>
                  patchEdge(e.id, {
                    option: v,
                  })
                }
                autoFocus={focusIntent && e.kind === 'option'}
                desc="What the caller might say for this branch, in plain words."
              />
            </>
          )}
          {showMatrix && (
            <SelectField
              label="matrix_intent"
              value={e.matrix_intent ?? ''}
              onChange={(v) =>
                patchEdge(e.id, {
                  matrix_intent: v,
                })
              }
              options={doc.matrix.map((m) => m.intent)}
              desc="Fallback source of a transfer destination when the Tool node has none."
            />
          )}
        </PanelSection>
      </div>
    )
  }

  /* -------------------------------------------------------- document panel */
  const setMatrix = (i, p) =>
    setDoc((d) => ({
      ...d,
      matrix: d.matrix.map((m, n) =>
        n === i
          ? {
              ...m,
              ...p,
            }
          : m,
      ),
    }))
  // A repair prompt is referenced too — counting only prompt_ref listed it as
  // unused and offered to delete it out from under a node's repair policy.
  const unused = Object.keys(doc.prompts).filter(
    (k) => !doc.nodes.some((n) => n.prompt_ref === k || (n.repair?.unclear_prompt_ref ?? '') === k),
  )
  return (
    <>
      <HeaderCard
        color="var(--border-3)"
        kicker="Flow document"
        title={`${doc.nodes.length} nodes · ${doc.edges.length} connections`}
        sub={`${Object.keys(doc.prompts).length} prompts · ${doc.matrix.length} matrix rows. Select a node or connection to edit it.`}
      />

      <PanelSection id="flow-settings" title="Flow settings" icon={<IconGear size={14} />}>
        <SelectField
          label="Entry node"
          value={doc.entry_node_id}
          onChange={(v) =>
            setDoc((d) => ({
              ...d,
              entry_node_id: v,
            }))
          }
          options={doc.nodes.filter((n) => n.type === 'Entry').map((n) => n.id)}
          allowEmpty={false}
          desc="Exactly one Entry node is allowed, and this must point at it."
        />

        <SelectField
          label="Default locale"
          value={doc.default_locale}
          onChange={(v) =>
            setDoc((d) => ({
              ...d,
              default_locale: v,
            }))
          }
          options={locales}
          allowEmpty={false}
          desc="Every prompt must have text in this locale to publish."
        />

        <StringList
          label="binding_refs"
          values={doc.binding_refs}
          onChange={(v) =>
            setDoc((d) => ({
              ...d,
              binding_refs: v,
            }))
          }
          placeholder={bindingIds[0] ?? 'binding id'}
          desc={`Bindings this flow may Inform from. Available: ${bindingIds.join(', ') || 'none'}`}
        />

        <SelectField
          label="Bound profile (intents + Tool api)"
          value={catalogProfileId}
          onChange={(v) => onCatalogProfileId?.(v)}
          options={profileIds}
          desc="Intent chips and Tool api_id list come from this profile. Also sent as profile_id when publishing Tool api flows. Stored in this browser only."
        />
      </PanelSection>

      <PanelSection
        id="globals"
        title="Always-on globals"
        icon={<IconLink size={14} />}
        meta={(doc.globals ?? []).length}
      >
        <p className="desc" style={{ marginTop: 0 }}>
          Always available on opted-in listen steps — not unused edge kinds. An edge must be
          kind=global and carry an intent or option.
        </p>
        <div className="chips">
        {globalEdges.map((e) => {
          const matcher = (e.intent || e.option || '').trim() || '(needs intent or option)'
          const on = (doc.globals ?? []).includes(e.id)
          return (
            <span
              key={e.id}
              className={`chip ${on ? 'on' : ''}`}
              onClick={() =>
                setDoc((d) => {
                  const cur = d.globals ?? []
                  const next = on ? cur.filter((id) => id !== e.id) : [...cur, e.id]
                  const copy = { ...d, globals: next }
                  if (!next.length) delete copy.globals
                  return copy
                })
              }
              title={matcher}
            >
              {e.id} · {matcher}
            </span>
          )
        })}
        </div>
        {!globalEdges.length && (
          <p className="desc">No kind=global edges yet. Draw one, then list it here.</p>
        )}
        {!!globalEdges.length && !(doc.globals ?? []).length && (
          <p className="desc">Global edges exist but are not armed on the flow.</p>
        )}
      </PanelSection>

      <PanelSection id="flow-policy" title="Conversation policy" icon={<IconGear size={14} />}>
        <FlowPolicy doc={doc} setDoc={setDoc} interruptModes={flowInterruptModes} />
      </PanelSection>

      <PanelSection
        id="matrix"
        title="Routing matrix"
        icon={<IconTable size={14} />}
        meta={doc.matrix.length}
      >
        <p className="desc" style={{ marginTop: 0 }}>
          Transfer destinations. A transfer Tool resolves its number through this table.
        </p>
        {doc.matrix.map((m, i) => (
          <div className="card sub" key={i}>
            <div className="row tight">
              <TextField
                label="intent"
                value={m.intent}
                onChange={(v) =>
                  setMatrix(i, {
                    intent: v,
                  })
                }
                mono
              />
              <TextField
                label="owner"
                value={m.owner}
                onChange={(v) =>
                  setMatrix(i, {
                    owner: v,
                  })
                }
              />
            </div>
            <div className="row tight">
              <TextField
                label="target"
                value={m.target}
                onChange={(v) =>
                  setMatrix(i, {
                    target: v,
                  })
                }
              />
              <TextField
                label="number"
                value={m.number}
                onChange={(v) =>
                  setMatrix(i, {
                    number: v,
                  })
                }
                mono
              />
            </div>
            <div className="row tight">
              <SelectField
                label="action"
                value={m.action}
                onChange={(v) =>
                  setMatrix(i, {
                    action: v,
                  })
                }
                options={catalog?.matrix_actions ?? ['transfer']}
                allowEmpty={false}
              />
              <SelectField
                label="disposition_code"
                value={m.disposition_code ?? ''}
                onChange={(v) =>
                  setMatrix(i, {
                    disposition_code: v,
                  })
                }
                options={catalog?.disposition_final ?? []}
              />
            </div>
            <div className="actions tight">
              <button
                className="btn danger sm"
                onClick={() =>
                  setDoc((d) => ({
                    ...d,
                    matrix: d.matrix.filter((_, n) => n !== i),
                  }))
                }
              >
                Remove row
              </button>
            </div>
          </div>
        ))}
        <div className="actions tight">
          <button
            className="btn secondary sm"
            onClick={() =>
              setDoc((d) => ({
                ...d,
                matrix: [
                  ...d.matrix,
                  {
                    intent: '',
                    owner: '',
                    target: '',
                    number: '',
                    action: 'transfer',
                    disposition_code: '',
                  },
                ],
              }))
            }
          >
            Add matrix row
          </button>
        </div>
      </PanelSection>

      {unused.length > 0 && (
        <PanelSection
          id="unused-prompts"
          title="Unused prompts"
          icon={<IconMessage size={14} />}
          meta={unused.length}
          tone="warn"
        >
          <p className="desc" style={{ marginTop: 0 }}>
            No node speaks or repairs with these. Edit a prompt's text by selecting the node that
            uses it.
          </p>
          {unused.map((k) => (
            <div className="unused-prompt" key={k}>
              <code>{k}</code>
              <button
                className="btn danger sm"
                onClick={() =>
                  setDoc((d) => {
                    const p = {
                      ...d.prompts,
                    }
                    delete p[k]
                    return {
                      ...d,
                      prompts: p,
                    }
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </PanelSection>
      )}
    </>
  )
}
