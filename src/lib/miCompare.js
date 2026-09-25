/**
 * Compare two MoM versions block by block (wave 7.5): sections by id,
 * decisions and actions by claim id. Content = { mom, decisions, actions }
 * from a draft, a draft revision, or an Official.
 */
import { asList, asMom } from './miDraft.js'
import { diffWords, hasChanges } from './textDiff.js'

const CLAIM_FIELDS = [
  ['owner', (c) => c.owner_display_name || c.owner_user_id || ''],
  ['due', (c) => c.due_date || ''],
]

function status(left, right, changed) {
  if (!left) return 'added'
  if (!right) return 'removed'
  return changed ? 'changed' : 'unchanged'
}

/** Pair items by key; items without a key pair by position. */
function pair(left, right, keyOf) {
  const byKey = new Map()
  left.forEach((l, i) => {
    const k = keyOf(l)
    if (k) byKey.set(k, i)
  })
  const used = new Set()
  const pairs = []
  let positional = false
  right.forEach((r, j) => {
    const k = keyOf(r)
    let i = k && byKey.has(k) ? byKey.get(k) : -1
    if (i === -1 && !k && j < left.length && !keyOf(left[j]) && !used.has(j)) {
      i = j
      positional = true
    }
    if (i !== -1) used.add(i)
    pairs.push({ left: i === -1 ? null : left[i], right: r })
  })
  left.forEach((l, i) => {
    if (!used.has(i)) pairs.push({ left: l, right: null })
  })
  return { pairs, positional }
}

function compareSections(a, b) {
  const { pairs } = pair(asMom(a).sections ?? [], asMom(b).sections ?? [], (s) => s.id)
  return pairs.map(({ left, right }) => {
    const title = diffWords(left?.title ?? '', right?.title ?? '')
    const body = diffWords(left?.body ?? '', right?.body ?? '')
    const changed = hasChanges(title) || hasChanges(body)
    return {
      key: `sec-${(right ?? left).id}`,
      label: right?.title || left?.title || (right ?? left).id,
      status: status(left, right, changed),
      title,
      body,
    }
  })
}

function compareClaims(a, b, kind) {
  const { pairs, positional } = pair(asList(a), asList(b), (c) => c.id)
  const blocks = pairs.map(({ left, right }, i) => {
    const text = diffWords(left?.text ?? '', right?.text ?? '')
    const fields = CLAIM_FIELDS.map(([name, get]) => ({
      name,
      before: left ? get(left) : '',
      after: right ? get(right) : '',
    })).filter((f) => left && right && f.before !== f.after)
    const changed = hasChanges(text) || fields.length > 0
    return {
      key: `${kind}-${(right ?? left).id || `pos${i}`}`,
      status: status(left, right, changed),
      text,
      fields,
    }
  })
  return { blocks, positional }
}

/** { sections, decisions, actions, positional, changes } */
export function compareContent(left, right) {
  const sections = compareSections(left?.mom, right?.mom)
  const dec = compareClaims(left?.decisions, right?.decisions, 'decisions')
  const act = compareClaims(left?.actions, right?.actions, 'actions')
  const all = [...sections, ...dec.blocks, ...act.blocks]
  return {
    sections,
    decisions: dec.blocks,
    actions: act.blocks,
    positional: dec.positional || act.positional,
    changes: all.filter((b) => b.status !== 'unchanged').length,
  }
}
