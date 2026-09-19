/**
 * Control API client.
 *
 * Auth: the server only enforces Bearer when its AuthToken is non-empty
 * (internal/control/server.go authMiddleware), which is populated from the
 * CONTROL_AUTH_TOKEN env var or the `control.auth_token` system setting. When
 * neither is set the API is fully open. We always send the token if the
 * operator saved one, so this UI works either way.
 */

const TOKEN_KEY = 'orch_admin_token'
const TENANT_KEY = 'orch_admin_tenant'
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}
export function setToken(v) {
  try {
    const t = v.trim()
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private mode — token simply won't persist */
  }
}
export function getTenant() {
  try {
    return localStorage.getItem(TENANT_KEY) || 'default'
  } catch {
    return 'default'
  }
}
export function setTenant(v) {
  try {
    localStorage.setItem(TENANT_KEY, v.trim() || 'default')
  } catch {
    /* ignore */
  }
}

/** Error carrying the server's structured envelope so pages can show details. */
export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
  /** Flattened "key=value" detail list — the publish validators put the useful bits here. */
  get detailText() {
    if (!this.details) return ''
    return Object.entries(this.details)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(' · ')
  }
}
async function request(method, path, body, rawContentType) {
  const headers = {
    Accept: 'application/json',
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const init = {
    method,
    headers,
  }
  if (body !== undefined) {
    if (rawContentType) {
      headers['Content-Type'] = rawContentType
      init.body = body
    } else {
      headers['Content-Type'] = 'application/json'
      init.body = typeof body === 'string' ? body : JSON.stringify(body)
    }
  }
  let res
  try {
    res = await fetch(path, init)
  } catch (e) {
    throw new ApiError(
      `Cannot reach the orchestrator. Is it running on :8011? (${e.message})`,
      0,
      'network',
    )
  }
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = {
        raw: text,
      }
    }
  }
  if (!res.ok) {
    const env = data
    const err = env?.error
    throw new ApiError(
      err?.message || res.statusText || `HTTP ${res.status}`,
      res.status,
      err?.code,
      err?.details,
    )
  }
  return data
}
const q = (params) => {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  const s = sp.toString()
  return s ? `?${s}` : ''
}
const enc = encodeURIComponent
export const api = {
  /* ---- platform ---- */
  health: () => request('GET', '/v1/health'),
  catalog: () => request('GET', '/v1/meta/catalog'),
  gateways: () => request('GET', '/v1/gateways'),
  platformStatus: () => request('GET', '/v1/platform/status'),
  /* ---- engines & credentials ---- */
  getEngines: (tenant = getTenant()) =>
    request(
      'GET',
      `/v1/tenant/engines${q({
        tenant_id: tenant,
      })}`,
    ),
  putEngines: (b, tenant = getTenant()) =>
    request(
      'PUT',
      `/v1/tenant/engines${q({
        tenant_id: tenant,
      })}`,
      b,
    ),
  listCredentials: (tenant = getTenant()) =>
    request(
      'GET',
      `/v1/tenant/credentials${q({
        tenant_id: tenant,
      })}`,
    ),
  deleteCredential: (gatewayId, tenant = getTenant()) =>
    request('DELETE', `/v1/tenant/credentials/${enc(gatewayId)}${q({ tenant_id: tenant })}`),
  putCredential: (gatewayId, apiKey, tenant = getTenant()) =>
    request(
      'PUT',
      `/v1/tenant/credentials/${enc(gatewayId)}${q({
        tenant_id: tenant,
      })}`,
      {
        api_key: apiKey,
      },
    ),
  /* ---- settings & fallback ---- */
  listSettings: (tenant = getTenant()) =>
    request(
      'GET',
      `/v1/tenant/settings${q({
        tenant_id: tenant,
      })}`,
    ),
  putSetting: (key, value, tenant = getTenant()) =>
    request(
      'PUT',
      `/v1/tenant/settings/${enc(key)}${q({
        tenant_id: tenant,
      })}`,
      {
        value,
      },
    ),
  listFallback: (tenant = getTenant()) =>
    request(
      'GET',
      `/v1/tenant/fallback${q({
        tenant_id: tenant,
      })}`,
    ),
  putFallback: (scenario, wav, tenant = getTenant()) =>
    request(
      'PUT',
      `/v1/tenant/fallback/${enc(scenario)}${q({
        tenant_id: tenant,
      })}`,
      wav,
      'audio/wav',
    ),
  deleteFallback: (scenario, tenant = getTenant()) =>
    request(
      'DELETE',
      `/v1/tenant/fallback/${enc(scenario)}${q({
        tenant_id: tenant,
      })}`,
    ),
  /* ---- profiles ---- */
  listProfiles: () => request('GET', '/v1/profiles'),
  createProfile: (b) => request('POST', '/v1/profiles', b),
  getProfileVersion: (id, ver = 'latest') =>
    request('GET', `/v1/profiles/${enc(id)}/versions/${enc(String(ver))}`),
  deleteProfile: (id) => request('DELETE', `/v1/profiles/${enc(id)}`),
  publishProfile: (id, doc) => request('POST', `/v1/profiles/${enc(id)}/versions`, doc),
  /* ---- flows ---- */
  listFlows: (tenant = getTenant()) =>
    request(
      'GET',
      `/v1/flows${q({
        tenant_id: tenant,
      })}`,
    ),
  getFlow: (id) => request('GET', `/v1/flows/${enc(id)}`),
  createFlow: (b) => request('POST', '/v1/flows', b),
  deleteFlow: (id) => request('DELETE', `/v1/flows/${enc(id)}`),
  getFlowDraft: (id) => request('GET', `/v1/flows/${enc(id)}/draft`),
  putFlowDraft: (id, doc) => request('PUT', `/v1/flows/${enc(id)}/draft`, doc),
  publishFlow: (id, doc) => request('POST', `/v1/flows/${enc(id)}/versions`, doc),
  getFlowVersion: (id, ver) => request('GET', `/v1/flows/${enc(id)}/versions/${enc(String(ver))}`),
  /* ---- bindings ---- */
  listBindings: (tenant = getTenant(), kind) =>
    request(
      'GET',
      `/v1/bindings${q({
        tenant_id: tenant,
        kind,
      })}`,
    ),
  getBinding: (id) => request('GET', `/v1/bindings/${enc(id)}`),
  putBinding: (id, b) => request('PUT', `/v1/bindings/${enc(id)}`, b),
  deleteBinding: (id) => request('DELETE', `/v1/bindings/${enc(id)}`),
  /* ---- sessions: used only by the pin smoke test (A.6 §5.2) ---- */
  createSession: (b) => request('POST', '/v1/sessions', b),
  answerSession: (id, b) => request('POST', `/v1/sessions/${enc(id)}/answer`, b || {}),
  injectText: (id, text) => request('POST', `/v1/sessions/${enc(id)}/inject`, { text }),
  getTranscript: (id) => request('GET', `/v1/sessions/${enc(id)}/transcript`),
  stopSession: (id, reason) =>
    request('POST', `/v1/sessions/${enc(id)}/stop`, { reason: reason || 'operator' }),

  /* ---- answer pins ---- */
  getAnswerPins: (tenant = getTenant()) =>
    request(
      'GET',
      `/v1/tenant/answer-pins${q({
        tenant_id: tenant,
      })}`,
    ),
  putAnswerPins: (pins, tenant = getTenant()) =>
    request(
      'PUT',
      `/v1/tenant/answer-pins${q({
        tenant_id: tenant,
      })}`,
      {
        pins,
      },
    ),
}
