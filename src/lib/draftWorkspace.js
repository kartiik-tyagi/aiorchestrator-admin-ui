/**
 * Draft workspace state (wave 7.2): the loaded server draft, the reviewer's
 * working copy, undo/redo, and the save diff. Pure — the React hook in
 * useDraftWorkspace.js wires it to the API. Lives above the MoM tab so tab
 * switches never lose edits.
 */
import { asList, asMom } from './miDraft.js'

const HISTORY_LIMIT = 200
/** Keystrokes into the same field within this window are one undo step. */
const COALESCE_MS = 900

/** The editable projection of a draft package. */
export function workingFrom(draft) {
  if (!draft) return null
  return {
    mom: structuredClone(asMom(draft.mom)),
    decisions: structuredClone(asList(draft.decisions)),
    actions: structuredClone(asList(draft.actions)),
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export const initialState = {
  draft: null,
  working: null,
  past: [],
  future: [],
  lastKey: '',
  lastAt: 0,
  conflict: null,
}

export function reducer(state, action) {
  switch (action.type) {
    case 'loaded':
      // A fresh server state replaces everything, history included.
      return { ...initialState, draft: action.draft, working: workingFrom(action.draft) }
    case 'edit': {
      if (!state.working) return state
      const next = action.fn(structuredClone(state.working))
      if (same(next, state.working)) return state
      const coalesce = action.key && action.key === state.lastKey && action.at - state.lastAt < COALESCE_MS
      const past = coalesce ? state.past : [...state.past, state.working].slice(-HISTORY_LIMIT)
      return { ...state, working: next, past, future: [], lastKey: action.key || '', lastAt: action.at || 0 }
    }
    case 'undo': {
      if (!state.past.length) return state
      const prev = state.past[state.past.length - 1]
      return {
        ...state,
        working: prev,
        past: state.past.slice(0, -1),
        future: [state.working, ...state.future],
        lastKey: '',
      }
    }
    case 'redo': {
      if (!state.future.length) return state
      const [next, ...rest] = state.future
      return { ...state, working: next, past: [...state.past, state.working], future: rest, lastKey: '' }
    }
    case 'conflict':
      return { ...state, conflict: { theirs: action.theirs } }
    case 'keepMine':
      // Rebase the reviewer's copy onto the winning version; the next save
      // sends it with the new expected_version.
      return { ...state, draft: state.conflict?.theirs ?? state.draft, conflict: null }
    default:
      return state
  }
}

export function isDirty(state) {
  return !!state.working && !same(state.working, workingFrom(state.draft))
}

/**
 * PATCH body: only the top-level fields that changed, plus expected_version.
 * Returns null when nothing changed.
 */
export function patchBody(state) {
  if (!state.draft || !state.working) return null
  const base = workingFrom(state.draft)
  const body = {}
  for (const k of ['mom', 'decisions', 'actions']) {
    if (!same(state.working[k], base[k])) body[k] = state.working[k]
  }
  if (!Object.keys(body).length) return null
  body.expected_version = state.draft.version
  return body
}

/** Edit operations on the working copy (each returns a reducer `fn`). */
export const ops = {
  setSection: (i, field, value) => (w) => {
    const s = w.mom.sections?.[i]
    if (s) s[field] = value
    return w
  },
  setClaim: (kind, i, patch) => (w) => {
    if (w[kind]?.[i]) w[kind][i] = { ...w[kind][i], ...patch }
    return w
  },
  // New claims carry no id: the server assigns one and marks them reviewer_authored.
  addClaim: (kind) => (w) => {
    w[kind] = [...(w[kind] ?? []), { id: '', text: '', origin: 'reviewer_authored', evidence_spans: [] }]
    return w
  },
  removeClaim: (kind, i) => (w) => {
    w[kind] = (w[kind] ?? []).filter((_, idx) => idx !== i)
    return w
  },
  moveClaim: (kind, i, delta) => (w) => {
    const list = [...(w[kind] ?? [])]
    const j = i + delta
    if (j < 0 || j >= list.length) return w
    ;[list[i], list[j]] = [list[j], list[i]]
    w[kind] = list
    return w
  },
}

function sectionText(s) {
  return `${s?.title || s?.id || ''}\n${s?.body || ''}`.trim()
}

function claimsText(list) {
  return (list ?? []).map((c, i) => `${i + 1}. ${c.text || ''}${c.owner_display_name ? ` — ${c.owner_display_name}` : ''}${c.due_date ? ` (${c.due_date})` : ''}`).join('\n')
}

/** Blocks whose content differs between the reviewer's copy and the saved one. */
export function conflictRows(mine, theirsDraft) {
  const theirs = workingFrom(theirsDraft)
  if (!mine || !theirs) return []
  const rows = []
  const n = Math.max(mine.mom.sections?.length ?? 0, theirs.mom.sections?.length ?? 0)
  for (let i = 0; i < n; i++) {
    const a = sectionText(mine.mom.sections?.[i])
    const b = sectionText(theirs.mom.sections?.[i])
    if (a !== b) rows.push({ label: mine.mom.sections?.[i]?.title || theirs.mom.sections?.[i]?.title || `Section ${i + 1}`, mine: a, theirs: b })
  }
  for (const [key, label] of [
    ['decisions', 'Decisions'],
    ['actions', 'Action items'],
  ]) {
    const a = claimsText(mine[key])
    const b = claimsText(theirs[key])
    if (a !== b) rows.push({ label, mine: a, theirs: b })
  }
  return rows
}
