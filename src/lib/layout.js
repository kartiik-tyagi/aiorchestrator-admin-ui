/**
 * Auto-layout for the graph canvas.
 *
 * coral.flow.v1 carries no node coordinates, so a freshly loaded flow has to be
 * placed somewhere sensible. We do a layered (Sugiyama-ish) pass: BFS depth from
 * the Entry node gives the column, order within a column gives the row. Good
 * enough to read a 19-node/65-edge desk flow at a glance, with no extra dep.
 *
 * Once placed, positions are persisted into doc.cx.layout — `cx` is declared in
 * the Go Document but never read by the runtime, so it round-trips through draft
 * save and publish without affecting validation or behaviour.
 */

const COL_W = 235
const ROW_H = 104
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
  const byCol = new Map()
  for (const id of ids) {
    const d = depth.get(id) ?? 0
    if (!byCol.has(d)) byCol.set(d, [])
    byCol.get(d).push(id)
  }
  const pos = {}
  const tallest = Math.max(...[...byCol.values()].map((c) => c.length))
  for (const [col, members] of byCol) {
    // Vertically centre each column so the graph reads along a spine.
    const offset = ((tallest - members.length) * ROW_H) / 2
    members.forEach((id, row) => {
      pos[id] = {
        x: PAD_X + col * COL_W,
        y: PAD_Y + offset + row * ROW_H,
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
  for (const [id, p] of Object.entries(layout))
    rounded[id] = {
      x: Math.round(p.x),
      y: Math.round(p.y),
    }
  return {
    ...doc,
    cx: {
      ...(doc.cx ?? {}),
      layout: rounded,
    },
  }
}
