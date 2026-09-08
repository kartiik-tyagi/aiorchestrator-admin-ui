/**
 * Client-side mirror of internal/profile/validate.go Validate().
 * Server still gates on publish (422 profile_invalid); this just gets the
 * operator there faster and explains the rule in words.
 */

const LADDER_TIERS = ['clip', 'template', 'llm']
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
  return issues
}
