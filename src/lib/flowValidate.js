/**
 * Client-side mirror of internal/flow/validate.go Validate().
 *
 * The server is still the gate — publish always re-validates. This exists so the
 * builder can show what is wrong *before* the operator hits publish, and so we
 * never encourage an illegal draft (doc 13 anti-patterns).
 *
 * Every rule below maps 1:1 to a check in the Go validator; keep them in sync.
 */

import { FLOW_SCHEMA_ID } from '../api/types'
const TOOL_VERBS = ['transfer', 'hangup']
export function validateFlow(doc, catalog) {
  const issues = []
  const err = (message, ref) =>
    issues.push({
      level: 'error',
      message,
      ref,
    })
  const warn = (message, ref) =>
    issues.push({
      level: 'warning',
      message,
      ref,
    })
  const nodeTypes = catalog?.node_types ?? []
  const edgeKinds = catalog?.edge_kinds ?? []
  const dispositions = catalog?.disposition_final ?? []
  if (doc.schema_id !== FLOW_SCHEMA_ID) err(`schema_id must be ${FLOW_SCHEMA_ID}`)
  if (!doc.default_locale?.trim()) err('default_locale required')

  /* ---- nodes ---- */
  const byId = new Map()
  let entryCount = 0
  doc.nodes.forEach((n, i) => {
    const id = n.id?.trim()
    if (!id) {
      err(`node #${i + 1} has no id`)
      return
    }
    if (byId.has(id)) err(`duplicate node id "${id}"`, id)
    if (nodeTypes.length && !nodeTypes.includes(n.type)) err(`unknown node type "${n.type}"`, id)
    if (n.type === 'Entry') entryCount++
    if (n.type === 'Tool' && !TOOL_VERBS.includes((n.tool ?? '').trim()))
      err(`Tool node "${id}" needs tool = transfer or hangup`, id)
    if (n.type === 'Inform' && !n.binding_ref?.trim())
      err(`Inform node "${id}" needs a binding_ref`, id)
    byId.set(id, n)
  })
  if (entryCount === 0) err('an Entry node is required')
  if (entryCount > 1) err(`exactly one Entry node required (found ${entryCount})`)
  const entryId = doc.entry_node_id?.trim()
  if (!entryId) err('entry_node_id required')
  else {
    const en = byId.get(entryId)
    if (!en) err(`entry_node_id "${entryId}" does not match any node`)
    else if (en.type !== 'Entry')
      err(`entry_node_id "${entryId}" must point at the Entry node`, entryId)
  }

  /* ---- Inform binding_ref must also be declared in binding_refs ---- */
  const refSet = new Set((doc.binding_refs ?? []).map((r) => r.trim()).filter(Boolean))
  for (const n of doc.nodes) {
    if (n.type !== 'Inform') continue
    const ref = (n.binding_ref ?? '').trim()
    if (ref && !refSet.has(ref))
      err(`Inform node "${n.id}" uses binding_ref "${ref}" which is not in binding_refs`, n.id)
  }

  /* ---- edges ---- */
  const edgeIds = new Set()
  doc.edges.forEach((e, i) => {
    const id = e.id?.trim()
    if (!id) {
      err(`edge #${i + 1} has no id`)
      return
    }
    if (edgeIds.has(id)) err(`duplicate edge id "${id}"`, id)
    edgeIds.add(id)
    if (edgeKinds.length && !edgeKinds.includes(e.kind)) err(`unknown edge kind "${e.kind}"`, id)
    if (!byId.has(e.from)) err(`edge "${id}" leaves unknown node "${e.from}"`, id)
    if (!byId.has(e.to)) err(`edge "${id}" points at unknown node "${e.to}"`, id)
  })

  /* ---- prompts: every prompt_ref needs default_locale text ---- */
  for (const n of doc.nodes) {
    const ref = (n.prompt_ref ?? '').trim()
    if (!ref) continue
    const locales = doc.prompts?.[ref]
    if (!locales) {
      err(`node "${n.id}" references prompt "${ref}" which is not defined`, n.id)
      continue
    }
    if (!locales[doc.default_locale]?.trim())
      err(`prompt "${ref}" has no text for the default locale ${doc.default_locale}`, n.id)
  }

  /* ---- matrix ---- */
  const matrixByIntent = new Map()
  ;(doc.matrix ?? []).forEach((row, i) => {
    const intent = row.intent?.trim()
    if (!intent) {
      err(`matrix row #${i + 1} needs an intent`)
      return
    }
    if (matrixByIntent.has(intent)) err(`duplicate matrix intent "${intent}"`, intent)
    if (!row.owner?.trim() || !row.target?.trim())
      err(`matrix intent "${intent}" needs both owner and target`, intent)
    const action = (row.action ?? '').trim()
    if (!action) err(`matrix intent "${intent}" needs an action`, intent)
    else if (action !== 'transfer')
      err(`matrix action must be "transfer" in V1 (intent "${intent}")`, intent)
    if (!row.number?.trim()) err(`matrix intent "${intent}" needs a number for transfer`, intent)
    const code = (row.disposition_code ?? '').trim()
    if (code && dispositions.length && !dispositions.includes(code))
      err(`matrix intent "${intent}" has non-allowlisted disposition_code "${code}"`, intent)
    matrixByIntent.set(intent, row)
  })

  /* ---- transfer Tools must resolve to a matrix row ---- */
  let transferTools = 0
  for (const n of doc.nodes) {
    if (n.type !== 'Tool' || (n.tool ?? '').trim() !== 'transfer') continue
    transferTools++
    let intent = (n.matrix_intent ?? '').trim()
    if (!intent) {
      // Go falls back to the first outgoing edge carrying matrix_intent.
      const e = doc.edges.find((x) => x.from === n.id && (x.matrix_intent ?? '').trim())
      intent = (e?.matrix_intent ?? '').trim()
    }
    if (!intent) {
      err(`transfer Tool "${n.id}" needs a matrix_intent`, n.id)
      continue
    }
    const row = matrixByIntent.get(intent)
    if (!row) {
      err(`transfer Tool "${n.id}" uses intent "${intent}" which is not in the matrix`, n.id)
      continue
    }
    if (!row.number?.trim())
      err(`matrix row "${intent}" has no number for transfer Tool "${n.id}"`, n.id)
  }
  if (transferTools > 0 && (doc.matrix ?? []).length === 0)
    err('a transfer Tool requires a non-empty matrix')

  /* ---- warnings: unreachable nodes (server does not check; operators care) ---- */
  if (entryId && byId.has(entryId)) {
    const seen = new Set([entryId])
    const queue = [entryId]
    while (queue.length) {
      const cur = queue.shift()
      for (const e of doc.edges) {
        if (e.from === cur && byId.has(e.to) && !seen.has(e.to)) {
          seen.add(e.to)
          queue.push(e.to)
        }
      }
    }
    for (const n of doc.nodes) {
      if (!seen.has(n.id)) warn(`node "${n.id}" is unreachable from Entry`, n.id)
    }
  }
  return issues
}

/**
 * Locale coverage warnings, mirroring flow.PromptLocaleWarnings. Non-blocking —
 * the server returns the same shape in the publish response.
 */
export function localeGaps(doc, ttsLocales) {
  const out = []
  for (const [ref, locales] of Object.entries(doc.prompts ?? {})) {
    const missing = ttsLocales.filter((l) => !locales?.[l]?.trim())
    if (missing.length)
      out.push({
        prompt_ref: ref,
        missing,
      })
  }
  return out
}
