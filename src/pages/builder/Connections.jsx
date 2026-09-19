import { useEffect, useMemo, useRef, useState } from 'react'
import { SelectField, TextField } from '../../components/ui'
import {
  CHOICE_KINDS,
  byKind,
  defaultEdgeKind,
  edgeChoice,
  inReadingOrder,
  intentSuggestions,
} from '../../lib/flowGraph'
import { NODE_COLOR } from './GraphNode'
import NodePicker from './NodePicker'
import { IconArrowIn, IconArrowOut, IconTrash } from './icons'

/**
 * The selected node's wiring, as two lists: what it connects to, and what
 * connects to it.
 *
 * On a fully wired flow the canvas is the worst place to read this — a Listen
 * node with fifteen intents is a fan of overlapping curves. Here each edge is
 * one row: kind, the intent that picks it, and the node at the other end.
 * Rows edit in place, the other node is one click away, and "Connect to…"
 * attaches a node without dragging a line across the canvas at all.
 *
 * Keyboard: pick a node and press Enter; the new edge opens with its intent
 * box focused. Enter moves intent → option → back to the picker, so a whole
 * fan-out can be typed without touching the mouse.
 *
 * Remounted per node by the inspector, so open rows reset with the selection.
 */
export default function Connections({
  node,
  doc,
  setDoc,
  kinds,
  layout,
  locales,
  onCreateEdge,
  onDeleteEdge,
  onFocusNode,
  onHoverEdge,
}) {
  const [openEdge, setOpenEdge] = useState(null)
  const [freshEdge, setFreshEdge] = useState(null)
  const rootRef = useRef(null)

  // Never leave a canvas highlight behind when the panel changes node.
  useEffect(() => () => onHoverEdge?.(null), [onHoverEdge])

  useEffect(() => {
    if (!freshEdge) return
    rootRef.current
      ?.querySelector(`[data-edge="${CSS.escape(freshEdge)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [freshEdge])

  const ordered = useMemo(() => inReadingOrder(doc.nodes, layout), [doc.nodes, layout])
  const byId = useMemo(() => new Map(doc.nodes.map((n) => [n.id, n])), [doc.nodes])
  const outs = doc.edges.filter((e) => e.from === node.id).sort(byKind)
  const ins = doc.edges.filter((e) => e.to === node.id).sort(byKind)
  const countBy = (edges, key) =>
    edges.reduce((m, e) => ({ ...m, [e[key]]: (m[e[key]] ?? 0) + 1 }), {})

  const add = (from, to, kind) => {
    const id = onCreateEdge(from, to, kind || undefined)
    if (!id) return
    setFreshEdge(id)
    const created = kind || defaultEdgeKind(doc, from, kinds)
    // Only choice edges have something left to fill in.
    setOpenEdge(CHOICE_KINDS.includes(created) ? id : null)
  }

  const patch = (id, p) =>
    setDoc((d) => ({ ...d, edges: d.edges.map((e) => (e.id === id ? { ...e, ...p } : e)) }))

  const focusPicker = (dir) =>
    window.requestAnimationFrame(() =>
      rootRef.current?.querySelector(`[data-picker="${dir}"] input`)?.focus(),
    )

  const terminal = node.type === 'End'

  return (
    <div className="conn" ref={rootRef}>
      <ConnGroup
        dir="out"
        title="Connects to"
        edges={outs}
        empty={
          terminal
            ? 'End is terminal — the call stops here, so nothing leaves it.'
            : 'Nothing yet. A caller reaching this node has nowhere to go.'
        }
      >
        {outs.map((e) => (
          <ConnRow
            key={e.id}
            edge={e}
            dir="out"
            other={byId.get(e.to)}
            otherId={e.to}
            doc={doc}
            kinds={kinds}
            locales={locales}
            open={openEdge === e.id}
            fresh={freshEdge === e.id}
            onToggle={() => {
              setFreshEdge(null)
              setOpenEdge(openEdge === e.id ? null : e.id)
            }}
            onClose={() => {
              setOpenEdge(null)
              focusPicker('out')
            }}
            patch={(p) => patch(e.id, p)}
            onDelete={() => onDeleteEdge(e.id)}
            onFocusNode={onFocusNode}
            onHover={onHoverEdge}
          />
        ))}
        {!terminal && (
          <AddConnection
            dir="out"
            nodes={ordered.filter((n) => n.id !== node.id)}
            already={countBy(outs, 'to')}
            kinds={kinds}
            autoKind={defaultEdgeKind(doc, node.id, kinds)}
            onPick={(id, kind) => add(node.id, id, kind)}
          />
        )}
      </ConnGroup>

      <ConnGroup
        dir="in"
        title="Connected from"
        edges={ins}
        empty={
          node.type === 'Entry'
            ? 'Calls start here, so nothing needs to lead in.'
            : 'Nothing leads here yet — callers can never reach this node.'
        }
      >
        {ins.map((e) => (
          <ConnRow
            key={e.id}
            edge={e}
            dir="in"
            other={byId.get(e.from)}
            otherId={e.from}
            doc={doc}
            kinds={kinds}
            locales={locales}
            open={openEdge === e.id}
            fresh={freshEdge === e.id}
            onToggle={() => {
              setFreshEdge(null)
              setOpenEdge(openEdge === e.id ? null : e.id)
            }}
            onClose={() => {
              setOpenEdge(null)
              focusPicker('in')
            }}
            patch={(p) => patch(e.id, p)}
            onDelete={() => onDeleteEdge(e.id)}
            onFocusNode={onFocusNode}
            onHover={onHoverEdge}
          />
        ))}
        <AddConnection
          dir="in"
          // End nodes cannot lead anywhere, so they are not offered as a source.
          nodes={ordered.filter((n) => n.id !== node.id && n.type !== 'End')}
          already={countBy(ins, 'from')}
          kinds={kinds}
          autoKind={null}
          onPick={(id, kind) => add(id, node.id, kind)}
        />
      </ConnGroup>
    </div>
  )
}

function ConnGroup({ dir, title, edges, empty, children }) {
  const Icon = dir === 'out' ? IconArrowOut : IconArrowIn
  return (
    <div className={`conn-group ${dir}`}>
      <div className="conn-group-head">
        <span className="conn-group-icon">
          <Icon size={12} />
        </span>
        <span>{title}</span>
        <span className="conn-count">{edges.length}</span>
      </div>
      {edges.length === 0 && <p className="conn-empty">{empty}</p>}
      <ul className="conn-list">{children}</ul>
    </div>
  )
}

function ConnRow({
  edge: e,
  dir,
  other,
  otherId,
  doc,
  kinds,
  locales,
  open,
  fresh,
  onToggle,
  onClose,
  patch,
  onDelete,
  onFocusNode,
  onHover,
}) {
  const choice = edgeChoice(e)
  const isChoice = CHOICE_KINDS.includes(e.kind)
  const source = dir === 'out' ? doc.nodes.find((n) => n.id === e.from) : other
  const showMatrix = (source?.type === 'Tool' && source.tool === 'transfer') || !!e.matrix_intent

  // Enter walks intent → option → done, so a fan-out can be typed straight through.
  const onEditKey = (ev) => {
    if (ev.key !== 'Enter' || !(ev.target instanceof HTMLInputElement)) return
    const label = ev.target.closest('.field')?.querySelector('label')?.textContent
    if (label === 'intent') {
      ev.preventDefault()
      ev.currentTarget.querySelector('[data-field="option"] input')?.focus()
    } else if (label === 'option') {
      ev.preventDefault()
      onClose()
    }
  }

  return (
    <li
      className={`conn-row ${open ? 'open' : ''} ${fresh ? 'fresh' : ''}`}
      data-edge={e.id}
      onMouseEnter={() => onHover?.(e.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className="conn-line">
        <button
          type="button"
          className="conn-main"
          onClick={onToggle}
          aria-expanded={open}
          title={`${e.kind}${choice ? `: ${choice}` : ''} — ${open ? 'close editor' : 'click to edit'}`}
        >
          <span className={`kind-pill k-${e.kind}`}>{e.kind}</span>
          {choice ? (
            <span className="conn-choice">{choice}</span>
          ) : isChoice ? (
            <span className="conn-choice missing">needs {e.kind}</span>
          ) : (
            <span className="conn-choice none">—</span>
          )}
        </button>
        <button
          type="button"
          className={`node-chip ${other ? '' : 'broken'}`}
          onClick={() => other && onFocusNode(other.id)}
          title={other ? `Go to ${other.id}` : `No node named "${otherId}"`}
        >
          <span className="chip-dir" aria-hidden="true">
            {dir === 'out' ? '→' : '←'}
          </span>
          <span
            className="chip-swatch"
            style={{ background: other ? NODE_COLOR[other.type] : 'var(--err)' }}
          />
          <span className="chip-id">{otherId}</span>
        </button>
        <button
          type="button"
          className="icon-btn danger"
          onClick={onDelete}
          aria-label={`Delete connection ${e.id}`}
          title="Delete connection"
        >
          <IconTrash size={13} />
        </button>
      </div>

      {open && (
        <div className="conn-edit" onKeyDown={onEditKey}>
          <div className="conn-grid">
            <SelectField
              label="Kind"
              value={e.kind}
              onChange={(v) => patch({ kind: v })}
              options={kinds}
              allowEmpty={false}
            />
            <SelectField
              label={dir === 'out' ? 'To' : 'From'}
              value={otherId}
              onChange={(v) => patch(dir === 'out' ? { to: v } : { from: v })}
              options={doc.nodes.map((n) => n.id)}
              allowEmpty={false}
            />
          </div>
          {(isChoice || !!e.intent || !!e.option) && (
            <>
              <div data-field="intent">
                <TextField
                  label="intent"
                  value={e.intent ?? ''}
                  onChange={(v) => patch({ intent: v })}
                  mono
                  suggestions={intentSuggestions(doc, source, locales)}
                  autoFocus={fresh && e.kind === 'intent'}
                  placeholder="what the classifier matches"
                />
              </div>
              <div data-field="option">
                <TextField
                  label="option"
                  value={e.option ?? ''}
                  onChange={(v) => patch({ option: v })}
                  autoFocus={fresh && e.kind === 'option'}
                  placeholder="what the caller might say"
                />
              </div>
            </>
          )}
          {showMatrix && (
            <SelectField
              label="matrix_intent"
              value={e.matrix_intent ?? ''}
              onChange={(v) => patch({ matrix_intent: v })}
              options={(doc.matrix ?? []).map((m) => m.intent)}
            />
          )}
          <div className="conn-edit-foot">
            <code title="Edge id">{e.id}</code>
            <button type="button" className="btn secondary sm" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function AddConnection({ dir, nodes, already, kinds, autoKind, onPick }) {
  const [kind, setKind] = useState('')
  return (
    <li className="conn-add" data-picker={dir}>
      <NodePicker
        nodes={nodes}
        already={already}
        placeholder={dir === 'out' ? 'Connect to a node…' : 'Connect from a node…'}
        onPick={(id) => onPick(id, kind)}
        addon={
          <label className="conn-kind" title="Kind of the new connection">
            <span>as</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              aria-label="Kind of new connection"
            >
              <option value="">{autoKind ? `auto · ${autoKind}` : 'auto'}</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        }
      />
    </li>
  )
}
