/**
 * Graph helpers shared by the canvas and the inspector's Connections panel, so
 * an edge drawn by dragging and an edge added from the sidebar follow the same
 * rules.
 */

export const LISTEN_TYPES = ['ListenChoice', 'ListenLanguage', 'ListenSlot']

/** Dashed on the canvas: the noisy, non-spine kinds. */
export const SECONDARY_KINDS = ['retry', 'repair', 'back', 'global']

/** Edge kinds that carry a caller-facing choice (intent / option text). */
export const CHOICE_KINDS = ['intent', 'option']

/** Display order in the Connections panel: spine first, recovery paths last. */
const KIND_ORDER = [
  'next',
  'intent',
  'option',
  'skip',
  'back',
  'retry',
  'repair',
  'tool_result',
  'global',
]
export const byKind = (a, b) => {
  const ia = KIND_ORDER.indexOf(a.kind)
  const ib = KIND_ORDER.indexOf(b.kind)
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
}

/**
 * The kind a freshly drawn edge most likely wants, so wiring a flow is not one
 * dropdown change per connection. Listen nodes branch on intents; Entry, Speak
 * and Inform advance on a single `next`, and an Inform that already has its
 * `next` is almost always getting its FAQ-miss `repair` edge.
 */
export function defaultEdgeKind(doc, fromId, kinds = []) {
  const from = doc.nodes.find((n) => n.id === fromId)
  const outs = doc.edges.filter((e) => e.from === fromId)
  const has = (k) => outs.some((e) => e.kind === k)
  let kind = 'next'
  if (from && LISTEN_TYPES.includes(from.type)) kind = 'intent'
  else if (from?.type === 'Inform' && has('next') && !has('repair')) kind = 'repair'
  return !kinds.length || kinds.includes(kind) ? kind : kinds[0]
}

export function nextEdgeId(edges, from, to) {
  const base = `e_${from}_${to}`
  if (!edges.some((e) => e.id === base)) return base
  let i = 2
  while (edges.some((e) => e.id === `${base}_${i}`)) i++
  return `${base}_${i}`
}

/** The words that identify an edge — its intent or option, whichever it carries. */
export function edgeChoice(e) {
  if (e.kind === 'option') return e.option || e.intent || ''
  return e.intent || e.option || ''
}

/** Canvas label for an edge. Intent edges show the intent itself — the kind is implied. */
export function edgeLabel(e) {
  const kind = e.kind ?? ''
  if (CHOICE_KINDS.includes(kind)) {
    const value = edgeChoice(e)
    if (!value) return { text: `${kind}: ?`, missing: true }
    return { text: kind === 'option' ? `option: ${value}` : value, missing: false }
  }
  return {
    text: [kind, e.intent || e.option || e.matrix_intent].filter(Boolean).join(' · '),
    missing: false,
  }
}

/**
 * Intents worth suggesting for an edge leaving `fromNode`. Intents recur across
 * a flow (main_menu, goodbye…), so offer the ones already in use; a language
 * gate branches on locale codes instead.
 */
export function intentSuggestions(doc, fromNode, locales = []) {
  if (fromNode?.type === 'ListenLanguage') return locales
  return [
    ...new Set(
      [...doc.edges.map((x) => x.intent), ...(doc.matrix ?? []).map((m) => m.intent)]
        .map((v) => (v ?? '').trim())
        .filter(Boolean),
    ),
  ].sort()
}

/** Nodes in canvas reading order (top to bottom, then left to right). */
export function inReadingOrder(nodes, layout = {}) {
  const at = new Map(nodes.map((n, i) => [n.id, i]))
  // Rows are bucketed so a node nudged a few pixels still reads as the same row.
  const key = (n) => {
    const p = layout[n.id]
    return p ? [Math.round(p.y / 60), p.x] : [Infinity, at.get(n.id)]
  }
  return [...nodes].sort((a, b) => {
    const [ra, xa] = key(a)
    const [rb, xb] = key(b)
    if (ra !== rb) return ra < rb ? -1 : 1
    if (xa !== xb) return xa - xb
    return at.get(a.id) - at.get(b.id)
  })
}
