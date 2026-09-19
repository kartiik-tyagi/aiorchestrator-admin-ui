/** Draft / approve helpers. Bind to GET /draft + approve.go — do not invent section ids. */

export function asList(raw) {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw)
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  }
  return []
}

export function asMom(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw)
      return v && typeof v === 'object' ? v : { sections: [] }
    } catch {
      return { sections: [] }
    }
  }
  return { sections: [] }
}

/** Names every decisions[i] / actions[i] still flagged unsupported_ai. */
export function unsupportedFields(draft) {
  const out = []
  asList(draft?.decisions).forEach((c, i) => {
    if (c?.origin === 'unsupported_ai') {
      out.push({ path: `decisions[${i}]`, id: c.id, text: c.text })
    }
  })
  asList(draft?.actions).forEach((c, i) => {
    if (c?.origin === 'unsupported_ai') {
      out.push({ path: `actions[${i}]`, id: c.id, text: c.text })
    }
  })
  return out
}

export function opSentence(op) {
  const who = op?.proposed?.text || op?.prior?.text || op?.action_id || 'action'
  switch (op?.op) {
    case 'create':
      return `Create ledger action: ${who}`
    case 'update':
      return `Update ledger action ${op.action_id || ''}: ${who}`
    case 'close':
      return `Close ledger action ${op.action_id || ''}: ${who}`
    case 'leave_open':
      return `Leave open: ${op.prior?.text || op.action_id || who}`
    default:
      return null
  }
}
