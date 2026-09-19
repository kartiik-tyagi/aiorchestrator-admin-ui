/**
 * Auto-layout for the graph canvas.
 *
 * coral.flow.v1 carries no node coordinates. The kernel rejects any non-empty
 * `cx` (CC.2 / validateCXRejected). Positions live only in this browser under
 * localStorage key orch_cc_layout:<flowId>.
 *
 * Vertical: a conversation reads top-to-bottom. BFS depth from Entry is the
 * row; siblings spread across it. Good enough to read a large desk flow.
 */

const COL_W = 240
const ROW_H = 150
const PAD_X = 60
const PAD_Y = 60

export function layoutStorageKey(flowId) {
  return `orch_cc_layout:${flowId}`
}

export function withoutCx(doc) {
  if (!doc || typeof doc !== 'object') return doc
  const { cx: _cx, ...rest } = doc
  return rest
}

function sanitizeLayout(layout, liveIds) {
  const live = liveIds ? new Set(liveIds) : null
  const out = {}
  if (!layout || typeof layout !== 'object') return out
  for (const [id, p] of Object.entries(layout)) {
    if (live && !live.has(id)) continue
    if (p && typeof p.x === 'number' && typeof p.y === 'number') {
      out[id] = {
        x: Math.round(p.x),
        y: Math.round(p.y),
      }
    }
  }
  return out
}

export function readLocalLayout(flowId) {
  if (!flowId) return {}
  try {
    const raw = localStorage.getItem(layoutStorageKey(flowId))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function writeLocalLayout(flowId, layout, liveIds) {
  if (!flowId) return
  try {
    localStorage.setItem(layoutStorageKey(flowId), JSON.stringify(sanitizeLayout(layout, liveIds)))
  } catch {
    /* private mode or quota — the document save must still succeed */
  }
}

export function remapLocalLayout(flowId, oldId, newId) {
  if (!flowId || !oldId || !newId || oldId === newId) return
  const cur = readLocalLayout(flowId)
  if (!cur[oldId]) return
  const { [oldId]: p, ...rest } = cur
  writeLocalLayout(flowId, { ...rest, [newId]: p })
}

export function autoLayout(doc) {
  const ids = doc.nodes.map((n) => n.id).filter(Boolean)
  if (!ids.length) return {}
  const outgoing = new Map()
  for (const id of ids) outgoing.set(id, [])
  for (const e of doc.edges) {
    if (outgoing.has(e.from) && ids.includes(e.to)) outgoing.get(e.from).push(e.to)
  }
  const entry = doc.entry_node_id && ids.includes(doc.entry_node_id) ? doc.entry_node_id : ids[0]

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

/**
 * localStorage first, then leftover doc.cx.layout (migrate once if LS empty),
 * then auto-layout for missing ids. Pass ignoreStored for Auto-layout.
 */
export function resolveLayout(doc, flowId, opts = {}) {
  const ids = new Set((doc?.nodes ?? []).map((n) => n.id).filter(Boolean))
  if (opts.ignoreStored) {
    return autoLayout(withoutCx(doc) ?? doc)
  }
  let stored = sanitizeLayout(readLocalLayout(flowId), ids)
  const fromCx = sanitizeLayout(doc?.cx?.layout, ids)
  if (!Object.keys(stored).length && Object.keys(fromCx).length) {
    writeLocalLayout(flowId, fromCx, ids)
    stored = fromCx
  }
  const known = {}
  let missing = false
  for (const id of ids) {
    if (stored[id]) known[id] = stored[id]
    else if (fromCx[id]) known[id] = fromCx[id]
    else missing = true
  }
  if (!missing && Object.keys(known).length === ids.size) return known
  const auto = autoLayout(withoutCx(doc) ?? doc)
  return {
    ...auto,
    ...known,
  }
}
