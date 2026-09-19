import { api } from '../api/client.js'

export function blockerAction(code) {
  if (code === 'tenant_engines_missing' || code === 'tenant_engines_lookup_failed')
    return { to: '/CC/admin/engines', label: 'Bind engines' }
  if (String(code).startsWith('gateway_'))
    return { to: '/CC/admin/engines', label: 'Bind engines' }
  if (code === 'no_profiles') return { to: '/CC/admin/profiles', label: 'Publish a profile' }
  if (code === 'database_unreachable') return { to: '/CC/admin', label: 'Check the database' }
  return { to: '/CC/admin', label: 'Open dashboard' }
}

function bindingHasRetrieveKeys(b) {
  if (!b?.config) return false
  const cfg = b.config
  if ((cfg.mode ?? '') === 'http_retrieve' && (cfg.path || cfg.gateway_id)) return true
  return (cfg.entries ?? []).some(
    (e) => (e.intents ?? []).length > 0 || (e.aliases ?? []).length > 0,
  )
}

async function loadProfileDoc(id) {
  try {
    const draft = await api.getProfileDraft(id)
    return draft.document ?? draft.doc ?? null
  } catch {
    /* try latest */
  }
  try {
    const v = await api.getProfileVersion(id, 'latest')
    return v.document ?? v.doc ?? null
  } catch {
    return null
  }
}

/** Amber operator warnings — never treat these as publish blockers. */
export async function collectOperatorWarnings({ pins = [], flows = [] }) {
  const warns = []
  const seen = new Set()
  const add = (id, to, text) => {
    if (seen.has(id)) return
    seen.add(id)
    warns.push({ id, to, text })
  }

  for (const pin of pins) {
    const pid = (pin.profile_id ?? '').trim()
    if (!pid) continue
    const doc = await loadProfileDoc(pid)
    if (doc && !(doc.intent_catalog ?? []).length)
      add(
        `catalog:${pid}`,
        '/CC/admin/profiles',
        `Pin ${pid} has an empty intent catalog — the agent turn will be edge-only.`,
      )
  }

  const published = (flows ?? []).filter((f) => (f.current_version ?? 0) > 0)
  for (const f of published) {
    let doc = null
    try {
      const draft = await api.getFlowDraft(f.id)
      doc = draft?.doc ?? null
    } catch {
      continue
    }
    if (!doc) continue
    const informs = (doc.nodes ?? []).filter((n) => n.type === 'Inform')
    if (informs.length) {
      const refs = [
        ...new Set(
          [...(doc.binding_refs ?? []), ...informs.map((n) => n.binding_ref)].filter((x) =>
            (x ?? '').trim(),
          ),
        ),
      ]
      if (!refs.length) {
        add(
          `inform:${f.id}`,
          `/CC/admin/flows/${encodeURIComponent(f.id)}/builder`,
          `Published flow ${f.id} has Inform nodes but no binding.`,
        )
      } else {
        const bindings = await Promise.all(refs.map((id) => api.getBinding(id).catch(() => null)))
        if (!bindings.some(bindingHasRetrieveKeys))
          add(
            `retrieve:${f.id}`,
            `/CC/admin/bindings`,
            `Published flow ${f.id} Inform bindings have empty retrieve keys.`,
          )
      }
    }
    const hasGlobalEdges = (doc.edges ?? []).some((e) => (e.kind ?? '') === 'global')
    if (hasGlobalEdges && !(doc.globals ?? []).length)
      add(
        `globals:${f.id}`,
        `/CC/admin/flows/${encodeURIComponent(f.id)}/builder`,
        `Published flow ${f.id} has global edges but an empty globals list — the bot will never offer them.`,
      )
  }
  return warns
}
