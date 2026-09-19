/**
 * Client-side mirror of internal/flow/validate.go Validate().
 *
 * The server is still the gate — publish always re-validates. This exists so the
 * builder can show what is wrong *before* the operator hits publish, and so we
 * never encourage an illegal draft (doc 13 anti-patterns).
 *
 * Every rule below maps 1:1 to a check in the Go validator; keep them in sync.
 */

import { FLOW_SCHEMA_ID, SLOT_VALIDATORS, WELL_KNOWN_SLOTS } from '../api/types.js'
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
  if (doc.cx != null && typeof doc.cx === 'object' && Object.keys(doc.cx).length > 0) {
    err('Layout is not part of the flow — remove cx. Canvas positions stay in this browser only.')
  }

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

  /* ---- repair.unclear_prompt_ref: same rule, and nothing else checks it ----
   *
   * The kernel's publish validator walks node.prompt_ref only — node.repair
   * stays raw JSON until a call parses it — so a dangling unclear_prompt_ref
   * publishes clean and then throws `prompt_ref missing` inside repairLocked()
   * on the first unclear reply, failing the turn and releasing the call. Catch
   * it here, because the server will not.
   */
  for (const n of doc.nodes) {
    const ref = (n.repair?.unclear_prompt_ref ?? '').trim()
    if (!ref) continue
    const locales = doc.prompts?.[ref]
    if (!locales) {
      err(
        `node "${n.id}" repairs with prompt "${ref}" which is not defined — this publishes but fails the call on the first unclear reply`,
        n.id,
      )
      continue
    }
    if (!locales[doc.default_locale]?.trim())
      err(`repair prompt "${ref}" has no text for the default locale ${doc.default_locale}`, n.id)
  }

  /* ---- edge shape per node type -------------------------------------------
   *
   * None of this is in the Go publish validator — it lives in the cursor and
   * only fires mid-call, where the failure mode is a released call rather than
   * a 422. Every rule below maps to a specific error the runtime can raise:
   *
   *   soleNext()          "no next edge from node" / "ambiguous next edges"
   *   soleRepair()        "no repair edge drawn for on_exhausted"
   *   allowlistedLocked() empty allowlist → every reply classifies unclear
   *
   * Checked here because the operator can still fix it cheaply.
   */
  const outOf = (id) => doc.edges.filter((e) => e.from === id)
  const countKind = (id, kind) => outOf(id).filter((e) => (e.kind ?? '') === kind).length
  const LISTEN_TYPES = ['ListenChoice', 'ListenLanguage', 'ListenSlot']

  for (const n of doc.nodes) {
    const id = n.id?.trim()
    if (!id) continue

    // Entry / Speak / Inform auto-advance through exactly one `next`.
    if (['Entry', 'Speak', 'Inform'].includes(n.type)) {
      const nexts = countKind(id, 'next')
      if (nexts === 0)
        err(`${n.type} node "${id}" needs exactly one "next" edge — the call fails here`, id)
      else if (nexts > 1)
        err(`${n.type} node "${id}" has ${nexts} "next" edges; exactly one is legal`, id)
    }

    // An Inform that misses in the binding falls to its repair edge. No repair
    // edge turns an ordinary FAQ miss into a released call.
    if (n.type === 'Inform') {
      const repairs = countKind(id, 'repair')
      if (repairs === 0)
        err(
          `Inform node "${id}" needs one "repair" edge — without it any FAQ miss ends the call`,
          id,
        )
      else if (repairs > 1)
        err(`Inform node "${id}" has ${repairs} "repair" edges; exactly one is legal`, id)
    }

    if (LISTEN_TYPES.includes(n.type)) {
      // The classifier only ever sees option/intent edges leaving this node.
      const choices = outOf(id).filter((e) => ['option', 'intent'].includes(e.kind ?? '')).length
      if (choices === 0)
        err(
          `${n.type} node "${id}" has no "option" or "intent" edge — every reply will be unclear`,
          id,
        )

      // repair policy present ⇒ the exhaust path must be drawn.
      const hasPolicy = n.repair && Object.keys(n.repair).length > 0
      const repairs = countKind(id, 'repair')
      if (hasPolicy && repairs === 0)
        err(
          `${n.type} node "${id}" sets a repair policy but has no "repair" edge — exhausting retries ends the call`,
          id,
        )
      else if (repairs > 1)
        err(`${n.type} node "${id}" has ${repairs} "repair" edges; exactly one is legal`, id)
      else if (!hasPolicy && repairs === 0)
        warn(
          `${n.type} node "${id}" has no repair policy — an unclear reply leaves the bot silent`,
          id,
        )
    }

  }

  /* ---- CC.5 Decide / ListenSlot ----------------------------------------- */
  const SLOT_KEY_RE = /^[a-z][a-z0-9_]*$/
  const declaredSlots = new Set(WELL_KNOWN_SLOTS)
  for (const n of doc.nodes) {
    if (n.type !== 'ListenSlot') continue
    const id = n.id?.trim()
    if (!id) continue
    const spec = n.slot
    if (!spec || typeof spec !== 'object') {
      err(`ListenSlot "${id}" needs a slot key and a validator.`, id)
      continue
    }
    const key = (spec.key ?? '').trim()
    const validator = (spec.validator ?? '').trim()
    if (!key || !SLOT_KEY_RE.test(key))
      err(`ListenSlot "${id}" slot.key must match ^[a-z][a-z0-9_]*$`, id)
    else declaredSlots.add(key)
    if (!SLOT_VALIDATORS.includes(validator))
      err(`ListenSlot "${id}" needs a slot key and a validator.`, id)
    if (validator === 'enum' && !(spec.enum ?? []).length)
      err(`ListenSlot "${id}" needs slot.enum when validator is enum`, id)
    if (validator === 'regex') {
      const pat = (spec.pattern ?? '').trim()
      if (!pat) err(`ListenSlot "${id}" needs slot.pattern when validator is regex`, id)
      else {
        try {
          new RegExp(pat)
        } catch {
          err(`ListenSlot "${id}" slot.pattern is not a valid regex`, id)
        }
      }
    }
  }

  const whenOps = (w) => {
    if (!w || typeof w !== 'object') return 0
    let n = 0
    if (w.eq != null) n++
    if (Array.isArray(w.in)) n++
    if (typeof w.exists === 'boolean') n++
    return n
  }
  const whenSig = (w) => {
    const slot = (w?.slot ?? '').trim()
    if (w?.eq != null) return `eq|${slot}|${String(w.eq).trim()}`
    if (Array.isArray(w.in)) return `in|${slot}|${w.in.join(',')}`
    if (typeof w.exists === 'boolean') return `exists|${slot}|${w.exists}`
    return `empty|${slot}`
  }
  for (const n of doc.nodes) {
    if (n.type !== 'Decide') continue
    const id = n.id?.trim()
    if (!id) continue
    const spec = n.decide
    if (!spec || typeof spec !== 'object') {
      err(`Decide "${id}" needs at least one rule and an else path.`, id)
      continue
    }
    const rules = spec.rules ?? []
    const elseId = (spec.else_edge_id ?? '').trim()
    const outIds = new Set(outOf(id).map((e) => e.id))
    if (!rules.length || !elseId) {
      err(`Decide "${id}" needs at least one rule and an else path.`, id)
      continue
    }
    if (!outIds.has(elseId))
      err(`Decide "${id}" else path is not an outgoing edge`, id)
    const seenWhen = new Set()
    rules.forEach((r, i) => {
      const eid = (r?.edge_id ?? '').trim()
      if (!eid) err(`Decide "${id}" rule ${i + 1} needs an outgoing edge`, id)
      else if (!outIds.has(eid)) err(`Decide "${id}" rule ${i + 1} edge is not outgoing`, id)
      const slot = (r?.when?.slot ?? '').trim()
      if (!slot) err(`Decide "${id}" rule ${i + 1} needs a slot`, id)
      else if (!declaredSlots.has(slot))
        err(`Decide "${id}" rule ${i + 1} slot "${slot}" is not a ListenSlot key or a well-known slot`, id)
      if (whenOps(r?.when) !== 1)
        err(`Decide "${id}" rule ${i + 1} must use exactly one of eq, in, or exists`, id)
      const sig = whenSig(r?.when)
      if (seenWhen.has(sig)) err(`Decide "${id}" has two rules that match the same when`, id)
      seenWhen.add(sig)
    })
  }

  /* ---- globals + allowed_intents (VA.2) --------------------------------- */
  const edgesById = new Map(doc.edges.filter((e) => e.id?.trim()).map((e) => [e.id.trim(), e]))
  const globalListed = new Set()
  const globalMatchers = new Set()
  const seenGlobalMatcher = new Map()
  for (const raw of doc.globals ?? []) {
    const gid = (raw ?? '').trim()
    if (!gid) continue
    const e = edgesById.get(gid)
    if (!e) {
      err(`globals lists "${gid}" but that edge does not exist`)
      continue
    }
    if ((e.kind ?? '') !== 'global')
      err(`globals edge "${gid}" must be kind global`, gid)
    const matcher = (e.intent ?? '').trim() || (e.option ?? '').trim()
    if (!matcher) err(`global edge "${gid}" needs an intent or option`, gid)
    else {
      const key = matcher.toLowerCase()
      if (seenGlobalMatcher.has(key))
        err(`duplicate global matcher "${matcher}" on "${gid}"`, gid)
      seenGlobalMatcher.set(key, gid)
      globalMatchers.add(key)
    }
    globalListed.add(gid)
  }
  for (const e of doc.edges) {
    if ((e.kind ?? '') === 'global' && !globalListed.has(e.id))
      warn('This global is not listed on the flow — the bot will never offer it.', e.id)
    if ((e.kind ?? '') === 'tool_result')
      warn(`edge "${e.id}" is kind "tool_result", which nothing in the runtime consumes`, e.id)
  }
  const LISTEN_FOR_INTENTS = new Set(['ListenChoice', 'ListenLanguage', 'ListenSlot'])
  for (const n of doc.nodes) {
    const id = n.id?.trim()
    if (!id) continue
    for (const gi of n.global_intents ?? []) {
      const m = (gi ?? '').trim().toLowerCase()
      if (!m) continue
      if (!globalMatchers.has(m))
        err(
          `node "${id}" global_intents "${gi}" has no matching global on the flow`,
          id,
        )
    }
    const allowed = n.allowed_intents ?? []
    if (!allowed.length) continue
    if (!LISTEN_FOR_INTENTS.has(n.type))
      err(`allowed_intents is only valid on ListenChoice, ListenLanguage, or ListenSlot`, id)
    const seenA = new Set()
    for (const raw of allowed) {
      const a = (raw ?? '').trim().toLowerCase()
      if (!a) {
        err(`node "${id}" has a blank allowed_intents entry`, id)
        continue
      }
      if (seenA.has(a)) err(`node "${id}" lists allowed_intents "${raw}" twice`, id)
      seenA.add(a)
    }
    for (const g of n.global_intents ?? []) {
      const gm = (g ?? '').trim().toLowerCase()
      if (gm && seenA.has(gm))
        err(
          `node "${id}" lists "${g}" in both allowed_intents and global_intents — globals belong in global_intents only`,
          id,
        )
    }
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
