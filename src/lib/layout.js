/**
 * Auto-layout for the graph canvas.
 *
 * coral.flow.v1 carries no node coordinates, so a freshly loaded flow has to be
 * placed somewhere sensible. We do a layered (Sugiyama-ish) pass: BFS depth from
 * the Entry node gives the ROW, and order within that depth spreads across the
 * row. Good enough to read a 19-node/65-edge desk flow at a glance, no extra dep.
 *
 * Vertical: a conversation reads top-to-bottom, which matches how the flowcharts
 * in docs/06 are drawn and keeps deep flows inside the viewport width.
 *
 * Once placed, positions are persisted into doc.cx.layout — `cx` is declared in
 * the Go Document but never read by the runtime, so it round-trips through draft
 * save and publish without affecting validation or behaviour.
 */

const COL_W = 240 // horizontal gap between siblings at the same depth
const ROW_H = 150 // vertical gap between depths
const PAD_X = 60
const PAD_Y = 60
export function autoLayout(doc) {
  const ids = doc.nodes.map((n) => n.id).filter(Boolean)
  if (!ids.length) return {}
  const outgoing = new Map()
  for (const id of ids) outgoing.set(id, [])
  for (const e of doc.edges) {
    if (outgoing.has(e.from) && ids.includes(e.to)) outgoing.get(e.from).push(e.to)
  }
  const entry = doc.entry_node_id && ids.includes(doc.entry_node_id) ? doc.entry_node_id : ids[0]

  // BFS depth from entry. Back/retry edges can revisit, so first visit wins.
  const depth = new Map([[entry, 0]])
  const queue = [entry]
  while (queue.length) {
    const cur = queue.shift()
    const d = depth.get(cur) ?? 0
    for (const next of outgoing.get(cur) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, d + 1)
        queue.push(next)
      }
    }
  }

  // Anything unreachable is parked in a trailing column so it stays visible.
  const maxDepth = Math.max(0, ...depth.values())
  for (const id of ids) if (!depth.has(id)) depth.set(id, maxDepth + 1)
  const byDepth = new Map()
  for (const id of ids) {
    const d = depth.get(id) ?? 0
    if (!byDepth.has(d)) byDepth.set(d, [])
    byDepth.get(d).push(id)
  }
  const pos = {}
  const widest = Math.max(...[...byDepth.values()].map((c) => c.length))
  for (const [d, members] of byDepth) {
    // Centre each depth horizontally so the graph reads down a spine.
    const offset = ((widest - members.length) * COL_W) / 2
    members.forEach((i, idx) => {
      pos[i] = {
        x: PAD_X + offset + idx * COL_W,
        y: PAD_Y + d * ROW_H,
      }
    })
  }
  return pos
}

/** Stored layout for nodes that still exist, auto-placing anything new. */
export function resolveLayout(doc) {
  const stored = doc.cx?.layout ?? {}
  const ids = new Set(doc.nodes.map((n) => n.id))
  const known = {}
  let missing = false
  for (const id of ids) {
    const p = stored[id]
    if (p && typeof p.x === 'number' && typeof p.y === 'number') known[id] = p
    else missing = true
  }
  if (!missing && Object.keys(known).length === ids.size) return known
  const auto = autoLayout(doc)
  // Keep hand-placed nodes, auto-place the rest.
  return {
    ...auto,
    ...known,
  }
}
export function withLayout(doc, layout) {
  const rounded = {}
  // Only nodes that still exist — deleted and renamed ids otherwise pile up in
  // cx.layout forever, one stale entry per edit.
  const live = new Set(doc.nodes.map((n) => n.id))
  for (const [id, p] of Object.entries(layout)) {
    if (!live.has(id)) continue
    rounded[id] = {
      x: Math.round(p.x),
      y: Math.round(p.y),
    }
  }
  return {
    ...doc,
    cx: {
      ...(doc.cx ?? {}),
      layout: rounded,
    },
  }
}
