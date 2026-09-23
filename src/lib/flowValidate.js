/**
 * Client-side mirror of internal/flow/validate.go Validate().
 *
 * The server is still the gate — publish always re-validates. This exists so the
 * builder can show what is wrong *before* the operator hits publish, and so we
 * never encourage an illegal draft (doc 13 anti-patterns).
 *
 * Every rule below maps 1:1 to a check in the Go validator; keep them in sync.
 */

import {
  API_TOOL_RESULT_OPTIONS,
  FLOW_INTERRUPT_MODES,
  FLOW_SCHEMA_ID,
  SESSION_TEMPLATE_KEYS,
  SLOT_VALIDATORS,
  TOOL_VERBS as TOOL_VERBS_FALLBACK,
  WELL_KNOWN_SLOTS,
} from '../api/types.js'

const TEMPLATE_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g

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
  const toolVerbs = catalog?.tools?.length ? catalog.tools : TOOL_VERBS_FALLBACK
  const apiResultOpts = catalog?.api_tool_result_options?.length
    ? catalog.api_tool_result_options
    : API_TOOL_RESULT_OPTIONS
  const sessionKeys = new Set(SESSION_TEMPLATE_KEYS)
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
    if (n.type === 'Tool' && !toolVerbs.includes((n.tool ?? '').trim()))
      err(`Tool node "${id}" needs tool = transfer, hangup, or api`, id)
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
   * Graph-shape checks the Go publish validator does not always enforce, but
   * the cursor will fail mid-call (released call). Keep them here.
   *
   * Kernel truth (latest):
   *   - Entry / Speak / Inform: exactly one kind=next (soleNext)
   *   - ListenChoice / ListenLanguage: ≥1 option|intent (classifier allowlist)
   *   - ListenSlot: success advances via exactly one kind=next (commitSlotAndAdvance);
   *     option|intent are optional (confirm / shortcut edges), not required
   *   - listen_policy.repair_edge_id + exhausted_edge_id: two kind=repair edges
   *     are intentional (OOD vs silence). Do not warn for that pair.
   *   - Unreachable nodes: warn only — do not error on missing next/listen edges
   *     (slot-declaration stubs and retired Speaks)
   */
  const outOf = (id) => doc.edges.filter((e) => e.from === id)
  const countKind = (id, kind) => outOf(id).filter((e) => (e.kind ?? '') === kind).length

  const entryForReach = doc.entry_node_id?.trim()
  const reachable = new Set()
  if (entryForReach && byId.has(entryForReach)) {
    reachable.add(entryForReach)
    const queue = [entryForReach]
    while (queue.length) {
      const cur = queue.shift()
      for (const e of doc.edges) {
        if (e.from === cur && byId.has(e.to) && !reachable.has(e.to)) {
          reachable.add(e.to)
          queue.push(e.to)
        }
      }
    }
  }

  for (const n of doc.nodes) {
    const id = n.id?.trim()
    if (!id) continue
    const live = reachable.size === 0 || reachable.has(id)

    // Entry / Speak / Inform auto-advance through exactly one `next`.
    if (['Entry', 'Speak', 'Inform'].includes(n.type) && live) {
      const nexts = countKind(id, 'next')
      if (nexts === 0)
        err(`${n.type} node "${id}" needs exactly one "next" edge — the call fails here`, id)
      else if (nexts > 1)
        err(`${n.type} node "${id}" has ${nexts} "next" edges; exactly one is legal`, id)
    }

    // An Inform that misses in the binding falls to its repair edge.
    if (n.type === 'Inform' && live) {
      const repairs = countKind(id, 'repair')
      if (repairs === 0)
        err(
          `Inform node "${id}" needs one "repair" edge — without it any FAQ miss ends the call`,
          id,
        )
      else if (repairs > 1)
        err(`Inform node "${id}" has ${repairs} "repair" edges; exactly one is legal`, id)
    }

    if (n.type === 'ListenChoice' || n.type === 'ListenLanguage') {
      if (live) {
        const choices = outOf(id).filter((e) => ['option', 'intent'].includes(e.kind ?? '')).length
        if (choices === 0)
          err(
            `${n.type} node "${id}" has no "option" or "intent" edge — every reply will be unclear`,
            id,
          )
      }
    }

    if (n.type === 'ListenSlot' && live) {
      const nexts = countKind(id, 'next')
      if (nexts === 0)
        err(
          `ListenSlot node "${id}" needs exactly one "next" edge after a valid value — the call fails here`,
          id,
        )
      else if (nexts > 1)
        err(`ListenSlot node "${id}" has ${nexts} "next" edges; exactly one is legal`, id)
    }

    if (['ListenChoice', 'ListenLanguage', 'ListenSlot'].includes(n.type)) {
      const hasPolicy = n.repair && Object.keys(n.repair).length > 0
      const repairs = outOf(id).filter((e) => (e.kind ?? '') === 'repair')
      const repairIds = new Set(repairs.map((e) => e.id))
      const policyRepair = (n.listen_policy?.repair_edge_id ?? '').trim()
      const policyExhaust = (n.listen_policy?.exhausted_edge_id ?? '').trim()
      const policyRefs = [policyRepair, policyExhaust].filter(Boolean)

      if (live && hasPolicy && repairs.length === 0)
        err(
          `${n.type} node "${id}" sets a repair policy but has no "repair" edge — exhausting retries ends the call`,
          id,
        )

      for (const eid of policyRefs) {
        if (!repairIds.has(eid))
          err(
            `${n.type} node "${id}" listen_policy references "${eid}" but that outgoing repair edge is missing`,
            id,
          )
      }

      if (policyRefs.length >= 1) {
        // Dual repair (OOD + silence) is the supported listen_policy shape.
        const extras = repairs.filter((e) => !policyRefs.includes(e.id))
        if (extras.length)
          warn(
            `${n.type} node "${id}" has ${extras.length} repair edge(s) not listed in listen_policy — kernel ignores them when policy ids are set`,
            id,
          )
      } else if (repairs.length > 1) {
        warn(
          `${n.type} node "${id}" has ${repairs.length} repair edges without listen_policy ids — kernel picks via PreferExhaustEdge (OOD/silence not distinguished)`,
          id,
        )
      } else if (live && !hasPolicy && repairs.length === 0) {
        warn(
          `${n.type} node "${id}" has no repair policy — an unclear reply leaves the bot silent`,
          id,
        )
      }
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
    const cls = (spec.class ?? '').trim()
    if (cls && cls !== 'none' && cls !== 'confidential')
      err(`ListenSlot "${id}" slot.class must be none|confidential`, id)
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

  /* ---- Tool(api): api_id + three distinct tool_result options (doc 23) ---- */
  for (const n of doc.nodes) {
    if (n.type !== 'Tool' || (n.tool ?? '').trim() !== 'api') continue
    const apiId = (n.api_id ?? '').trim()
    if (!apiId) err(`api Tool "${n.id}" needs an api_id (profile api_integrations id)`, n.id)
    const seenOpt = new Set()
    for (const e of doc.edges) {
      if (e.from !== n.id || (e.kind ?? '') !== 'tool_result') continue
      const opt = (e.option ?? '').trim()
      if (!opt) {
        err(`tool_result edge "${e.id}" from api Tool "${n.id}" needs option success|fail|error`, e.id)
        continue
      }
      if (!apiResultOpts.includes(opt))
        err(`tool_result option "${opt}" on "${e.id}" must be one of ${apiResultOpts.join('|')}`, e.id)
      if (seenOpt.has(opt))
        err(`api Tool "${n.id}" has duplicate tool_result option "${opt}"`, e.id)
      seenOpt.add(opt)
    }
    for (const need of apiResultOpts) {
      if (!seenOpt.has(need))
        err(`api Tool "${n.id}" needs a tool_result edge with option "${need}"`, n.id)
    }
  }

  /* ---- Speak templates: allowlisted session.* only (slot.* always OK here) ---- */
  const scanText = (text, ref) => {
    if (!text || typeof text !== 'string') return
    TEMPLATE_RE.lastIndex = 0
    let m
    while ((m = TEMPLATE_RE.exec(text)) !== null) {
      const path = m[1]
      if (path.startsWith('slot.')) continue
      if (path.startsWith('session.')) {
        const key = path.slice('session.'.length)
        if (!sessionKeys.has(key))
          err(
            `unknown Speak template {{${path}}} — session keys are ${[...sessionKeys].join('|')}`,
            ref,
          )
        continue
      }
      err(`unknown Speak template {{${path}}} — use slot.* or session.* only`, ref)
    }
  }
  for (const [ref, locales] of Object.entries(doc.prompts ?? {})) {
    if (!locales || typeof locales !== 'object') continue
    for (const [loc, text] of Object.entries(locales)) scanText(text, `${ref}/${loc}`)
  }

  /* ---- conversation_policy + node interrupt (internal/flow/policy.go) ---- */
  const ge0 = (v) => v != null && Number(v) < 0
  const irModes = FLOW_INTERRUPT_MODES
  const pol = doc.conversation_policy
  if (pol && typeof pol === 'object') {
    const ir = pol.interruption ?? {}
    for (const key of ['mode', 'welcome_mode']) {
      const v = (ir[key] ?? '').trim()
      if (v && !irModes.includes(v))
        err(`conversation_policy.interruption.${key} must be inherit|off|on|after_ms`)
    }
    if ((ir.mode === 'after_ms' || ir.welcome_mode === 'after_ms') && ir.welcome_grace_ms == null)
      err('conversation_policy.interruption.welcome_grace_ms is required when mode or welcome_mode is after_ms')
    for (const [key, val] of [
      ['welcome_grace_ms', ir.welcome_grace_ms],
      ['min_barge_chars', ir.min_barge_chars],
      ['min_barge_ms', ir.min_barge_ms],
      ['cooldown_ms', ir.cooldown_ms],
    ]) {
      if (ge0(val)) err(`conversation_policy.interruption.${key} must be >= 0`)
    }
    const listen = pol.listen ?? {}
    if (ge0(listen.no_input_timeout_ms))
      err('conversation_policy.listen.no_input_timeout_ms must be >= 0')
    if (ge0(listen.retry_budget)) err('conversation_policy.listen.retry_budget must be >= 0')
    const ue = listen.utterance_endpointing ?? {}
    for (const key of ['end_silence_ms', 'min_speech_ms', 'max_hold_ms', 'barge_silence_ms']) {
      if (ge0(ue[key])) err(`conversation_policy.listen.utterance_endpointing.${key} must be >= 0`)
    }
    const failMax = pol.failure?.safe_retry_max
    if (failMax != null && (failMax < 0 || failMax > 3))
      err('conversation_policy.failure.safe_retry_max must be 0–3')
  }

  for (const n of doc.nodes) {
    const id = n.id?.trim()
    if (!id) continue
    const mode = (n.interrupt ?? '').trim()
    if (mode && !irModes.includes(mode))
      err(`node "${id}" interrupt must be inherit|off|on|after_ms`, id)
    if (mode === 'after_ms') {
      if (n.interrupt_after_ms == null)
        err(`node "${id}" needs interrupt_after_ms when interrupt is after_ms`, id)
      else if (ge0(n.interrupt_after_ms))
        err(`node "${id}" interrupt_after_ms must be >= 0`, id)
    } else if (n.interrupt_after_ms != null) {
      err(`node "${id}" interrupt_after_ms is only valid when interrupt is after_ms`, id)
    }
    const lp = n.listen_policy
    if (lp) {
      if (ge0(lp.timeout_ms)) err(`node "${id}" listen_policy.timeout_ms must be >= 0`, id)
      if (ge0(lp.retries)) err(`node "${id}" listen_policy.retries must be >= 0`, id)
    }
    const mandatory = n.mandatory_delivery === true
    const interruptOn = mode === 'on' || mode === 'after_ms'
    if (mandatory && interruptOn)
      err(`node "${id}" mandatory_delivery cannot combine with interrupt on|after_ms`, id)
    if (n.type === 'Tool' && interruptOn)
      err(`Tool node "${id}" cannot publish with interrupt on|after_ms`, id)
  }

  /* ---- warnings: unreachable nodes (server does not check; operators care) ---- */
  if (reachable.size) {
    for (const n of doc.nodes) {
      if (reachable.has(n.id)) continue
      // Intentional Decide allowlist stubs — never visited; key is what matters.
      if (n.type === 'ListenSlot' && String(n.id).startsWith('declare_')) continue
      warn(`node "${n.id}" is unreachable from Entry`, n.id)
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
