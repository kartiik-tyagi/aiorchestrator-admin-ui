/**
 * Client-side mirror of internal/profile/validate.go Validate().
 * Server still gates on publish (422 profile_invalid); this just gets the
 * operator there faster and explains the rule in words.
 */

import {
  DATE_ORDER,
  INTENT_ACTIONS,
  INTENT_SCOPES,
  PROFILE_INTERRUPT_MODES,
} from '../api/types.js'

const LADDER_TIERS = ['clip', 'template', 'llm']
const INTENT_ID_RE = /^[a-z0-9][a-z0-9_]{0,63}$/
const DIAL_LIKE = /(?:^|[^0-9])\+?[0-9]{3,}(?:[^0-9]|$)/
function hasPersonaVoice(doc) {
  if (doc.persona?.voice_id?.trim()) return true
  return Object.values(doc.persona?.voice ?? {}).some((v) => v?.trim())
}
export function validateProfile(doc, gateways) {
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
  const m = doc.modes ?? {}
  if (!m.listen && !m.speak && !m.think && !m.talk) err('at least one mode must be on')
  if ((m.talk || m.speak) && !hasPersonaVoice(doc))
    err('persona.voice or persona.voice_id is required when talk or speak is on')
  const rate = doc.audio?.canonical_sample_rate_hz
  if (rate != null && rate !== 0 && (rate < 8000 || rate > 48000))
    err(`audio.canonical_sample_rate_hz out of range: ${rate} (8000–48000)`)
  if (doc.grounding?.required && !(doc.routers?.knowledge?.providers ?? []).length)
    err('grounding.required needs at least one knowledge provider')
  const beh = (doc.language?.behaviour ?? '').trim()
  if (beh && beh !== 'none' && !(doc.routers?.translate?.providers ?? []).length)
    err(
      `language.behaviour "${beh}" requires translate providers (use "none" if you do not translate)`,
    )
  for (const name of doc.skills?.allowed ?? []) {
    if (!doc.skills?.definitions?.[name])
      err(`skills.allowed lists "${name}" but skills.definitions has no entry for it`)
  }
  for (const [i, tok] of (doc.response?.ladder ?? []).entries()) {
    const t = tok.trim()
    if (!t || !LADDER_TIERS.includes(t))
      err(`response.ladder[${i}] "${tok}" is not one of clip | template | llm`)
  }
  const clips = doc.response?.clips ?? {}
  const checkCanned = (path, id) => {
    const v = (id ?? '').trim()
    if (v && !clips[v]) err(`${path} references clip "${v}" which is not defined in response.clips`)
  }
  checkCanned('fallback.listen_down.speak_canned', doc.fallback?.listen_down?.speak_canned)
  checkCanned('fallback.think_down.speak_canned', doc.fallback?.think_down?.speak_canned)
  checkCanned('fallback.speak_down.speak_canned', doc.fallback?.speak_down?.speak_canned)

  /* ---- every referenced gateway must exist AND be on the expected port ---- */
  if (gateways) {
    const portOf = new Map()
    for (const [port, list] of Object.entries(gateways.gateways ?? {})) {
      for (const g of list ?? []) portOf.set(g.id, port)
    }
    const check = (id, want, path) => {
      const got = portOf.get(id)
      if (!got) err(`gateway "${id}" is not registered (${path})`)
      else if (got !== want)
        err(`gateway "${id}" is a ${got} gateway, but ${path} needs a ${want} gateway`)
    }
    const r = doc.routers ?? {}
    for (const id of r.listen?.providers ?? []) check(id, 'listen', 'routers.listen.providers')
    for (const id of r.speak?.providers ?? []) check(id, 'speak', 'routers.speak.providers')
    for (const id of r.think?.providers ?? []) check(id, 'think', 'routers.think.providers')
    for (const id of r.knowledge?.providers ?? [])
      check(id, 'knowledge', 'routers.knowledge.providers')
    for (const id of r.translate?.providers ?? [])
      check(id, 'translate', 'routers.translate.providers')
    const kb = doc.knowledge?.http_kb?.gateway
    if (kb?.trim()) check(kb.trim(), 'knowledge', 'knowledge.http_kb.gateway')
    for (const [name, def] of Object.entries(doc.skills?.definitions ?? {})) {
      if (def.gateway?.trim())
        check(def.gateway.trim(), 'skill', `skills.definitions.${name}.gateway`)
    }
  }

  /* ---- warnings: legal, but usually a mistake ---- */
  if (!(doc.language?.allowed ?? []).length)
    warn('language.allowed is empty — the desk will not advertise any locale to callers')
  if (doc.speak_render === 'smart' && !(doc.routers?.think?.providers ?? []).length)
    warn('speak_render "smart" paraphrases via the Think gateway, but no think provider is set')
  if (hasPersonaVoice(doc)) {
    const speakGw = doc.routers?.speak?.providers?.[0]
    const map = doc.persona?.voice ?? {}
    if (speakGw && Object.keys(map).length && !map[speakGw] && !doc.persona?.voice_id?.trim())
      warn(`persona.voice has no entry for the bound speak gateway "${speakGw}"`)
  }

  const product = (doc.product ?? '').trim()
  if (product && product !== 'call_center')
    err(`product must be call_center or empty (got "${product}") — product_mismatch`)

  const seenIntent = new Set()
  for (const [i, row] of (doc.intent_catalog ?? []).entries()) {
    const id = (row?.id ?? '').trim()
    if (!id || !INTENT_ID_RE.test(id))
      err(`intent_catalog[${i}] id must match ^[a-z0-9][a-z0-9_]{0,63}$`)
    else if (seenIntent.has(id)) err(`intent_catalog duplicate id "${id}"`)
    else seenIntent.add(id)
    if (row?.scope && !INTENT_SCOPES.includes(row.scope))
      err(`intent "${id || i}" has unknown scope "${row.scope}"`)
    if (row?.action && !INTENT_ACTIONS.includes(row.action))
      err(`intent "${id || i}" has unknown action "${row.action}"`)
    if (row?.action === 'go_department' && !(row.department ?? '').trim())
      err(`intent "${id || i}" action go_department requires department`)
    for (const [field, val] of [
      ['department', row?.department],
      ['product', row?.product],
      ['description', row?.description],
    ]) {
      if (val && DIAL_LIKE.test(String(val)))
        err(`intent "${id || i}" ${field} looks like a dial number — numbers belong on the flow matrix`)
    }
    for (const ex of row?.examples ?? []) {
      if (ex && DIAL_LIKE.test(String(ex)))
        err(`intent "${id || i}" example looks like a dial number`)
    }
  }

  const ir = doc.conversation_policy?.interruption ?? {}
  for (const key of ['mode', 'welcome_mode']) {
    const v = (ir[key] ?? '').trim()
    if (v && !PROFILE_INTERRUPT_MODES.includes(v))
      err(`conversation_policy.interruption.${key} must be off|on|after_ms`)
  }
  if ((ir.mode === 'after_ms' || ir.welcome_mode === 'after_ms') && ir.welcome_grace_ms == null)
    err('conversation_policy.interruption.welcome_grace_ms is required when mode or welcome_mode is after_ms')
  const failMax = doc.conversation_policy?.failure?.safe_retry_max
  if (failMax != null && (failMax < 0 || failMax > 3))
    err('conversation_policy.failure.safe_retry_max must be 0–3')

  const a = doc.audio ?? {}
  if (a.inbound_target_rms != null && (a.inbound_target_rms <= 0 || a.inbound_target_rms > 0.5))
    err(`audio.inbound_target_rms out of range: ${a.inbound_target_rms} (0 < v <= 0.5)`)
  if (a.inbound_max_gain != null && (a.inbound_max_gain < 1 || a.inbound_max_gain > 16))
    err(`audio.inbound_max_gain out of range: ${a.inbound_max_gain} (1 <= v <= 16)`)
  if (a.inbound_noise_floor_rms != null && (a.inbound_noise_floor_rms < 0 || a.inbound_noise_floor_rms > 0.1))
    err(`audio.inbound_noise_floor_rms out of range: ${a.inbound_noise_floor_rms} (0 <= v <= 0.1)`)
  if (a.tts_peak_limit != null && (a.tts_peak_limit <= 0 || a.tts_peak_limit > 1))
    err(`audio.tts_peak_limit out of range: ${a.tts_peak_limit} (0 < v <= 1)`)

  const tts = doc.persona?.tts ?? {}
  if (tts.pace != null && !(Number.isFinite(tts.pace) && tts.pace > 0))
    err(`persona.tts.pace must be a finite number greater than 0 (got ${tts.pace})`)
  if (tts.temperature != null && !Number.isFinite(tts.temperature))
    err('persona.tts.temperature must be a finite number')

  /* ---- timezone / date_order / api_integrations (doc 23) ---- */
  const tz = (doc.timezone ?? '').trim()
  if (tz && (/\s/.test(tz) || tz.length > 64)) err('timezone must be an IANA name (no spaces)')
  const order = (doc.date_order ?? '').trim()
  if (order && !DATE_ORDER.includes(order))
    err(`date_order must be ${DATE_ORDER.join('|')} (got "${order}")`)

  const seenApi = new Set()
  for (const [i, api] of (doc.api_integrations ?? []).entries()) {
    const id = (api?.id ?? '').trim()
    if (!id) {
      err(`api_integrations[${i}] needs an id`)
      continue
    }
    if (seenApi.has(id)) err(`api_integrations duplicate id "${id}"`)
    else seenApi.add(id)
    const url = (api?.url ?? '').trim()
    if (url) {
      const insecure = /^http:\/\//i.test(url)
      const https = /^https:\/\//i.test(url)
      if (!https && !insecure) err(`api "${id}" url must be http(s)`, id)
      if (insecure && !api.allow_insecure_http)
        err(`api "${id}" uses http:// — set allow_insecure_http for lab only, or use https`, id)
    }
    const kind = (api?.kind ?? '').trim()
    const success = api?.success ?? {}
    if (kind === 'write') {
      const requires = success.success_requires ?? []
      const httpOk = success.http_ok ?? []
      const httpOnly204 =
        !!success.http_only && httpOk.length === 1 && Number(httpOk[0]) === 204
      if (!requires.length && !httpOnly204)
        err(
          `api "${id}" kind write needs success_requires (or http_only with http_ok [204] only)`,
          id,
        )
    }
  }

  return issues
}
