/**
 * Meeting Intelligence HTTP client (`/mi/v1`).
 *
 * Probe (2026-09-19, this binary):
 *   GET /mi/v1/meta                 → 404  (no Meta screen)
 *   GET /mi/v1/profiles/{id}/actions → 404  (hide ledger; re-probed 2026-09-19 still 404)
 *
 * V1 MI is open — do not send the Call Center Bearer token or tenant_id.
 */
import { ApiError } from '../client.js'

const enc = encodeURIComponent

async function request(method, path, body, extraHeaders) {
  const headers = { Accept: 'application/json', ...(extraHeaders ?? {}) }
  const init = { method, headers }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(path, init)
  } catch (e) {
    throw new ApiError(
      'Cannot reach Meeting Intelligence on :8011. Is the orchestrator running?',
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
      data = { raw: text }
    }
  }
  if (!res.ok) {
    const err = data?.error
    const code =
      (err && typeof err === 'object' && err.code) || (typeof err === 'string' ? err : undefined)
    const message =
      (err && typeof err === 'object' && err.message) ||
      data?.message ||
      (typeof err === 'string' ? err : null) ||
      res.statusText ||
      `HTTP ${res.status}`
    throw new ApiError(message, res.status, code, typeof err === 'object' ? err?.details : undefined)
  }
  return data
}

export const mi = {
  health: () => request('GET', '/mi/v1/health'),
  listProfiles: () => request('GET', '/mi/v1/profiles'),
  createProfile: (b) => request('POST', '/mi/v1/profiles', b),
  getProfile: (id) => request('GET', `/mi/v1/profiles/${enc(id)}`),
  putProfile: (id, b) => request('PUT', `/mi/v1/profiles/${enc(id)}`, b),
  putKbDoc: (id, docId, b) =>
    request('PUT', `/mi/v1/profiles/${enc(id)}/kb/${enc(docId)}`, b),
  listKb: (id) => request('GET', `/mi/v1/profiles/${enc(id)}/kb`),
  profileAsk: (id, b) => request('POST', `/mi/v1/profiles/${enc(id)}/ask`, b),
  createProfileAskSession: (id, b) =>
    request('POST', `/mi/v1/profiles/${enc(id)}/ask/sessions`, b || {}),

  listMeetings: (profileId) =>
    request('GET', `/mi/v1/meetings${profileId ? `?profile_id=${enc(profileId)}` : ''}`),
  createMeeting: (b) => request('POST', '/mi/v1/meetings', b),
  getMeeting: (id) => request('GET', `/mi/v1/meetings/${enc(id)}`),
  startCapture: (id, b) =>
    request('POST', `/mi/v1/meetings/${enc(id)}/start-capture`, b || {}),
  endMeeting: (id, b) => request('POST', `/mi/v1/meetings/${enc(id)}/end`, b || {}),
  cancelMeeting: (id, b) => request('POST', `/mi/v1/meetings/${enc(id)}/cancel`, b || {}),
  pushTranscripts: (id, b, hdrs = {}) =>
    request('POST', `/mi/v1/meetings/${enc(id)}/transcripts`, b, {
      ...(hdrs.idempotencyKey ? { 'Idempotency-Key': hdrs.idempotencyKey } : {}),
      ...(hdrs.ingestToken ? { 'X-MI-Ingest-Token': hdrs.ingestToken } : {}),
    }),
  getTranscript: (id, generation) =>
    request(
      'GET',
      `/mi/v1/meetings/${enc(id)}/transcript${generation != null ? `?generation=${enc(String(generation))}` : ''}`,
    ),
  regenerate: (id, b) => request('POST', `/mi/v1/meetings/${enc(id)}/regenerate`, b || {}),
  getDraft: (id) => request('GET', `/mi/v1/meetings/${enc(id)}/draft`),
  patchDraft: (id, b) => request('PATCH', `/mi/v1/meetings/${enc(id)}/draft`, b),
  approvePreview: (id, b) => request('POST', `/mi/v1/meetings/${enc(id)}/approve`, b || {}),
  approveConfirm: (id, b) =>
    request('POST', `/mi/v1/meetings/${enc(id)}/approve/confirm`, b || {}),
  getOfficial: (id) => request('GET', `/mi/v1/meetings/${enc(id)}/official`),
  getOfficialHistory: (id) =>
    request('GET', `/mi/v1/meetings/${enc(id)}/official/history`),
  exportMeeting: (id, q = {}) => {
    const qs = new URLSearchParams()
    if (q.format) qs.set('format', q.format)
    if (q.draft) qs.set('draft', '1')
    const tail = qs.toString()
    return request('GET', `/mi/v1/meetings/${enc(id)}/export${tail ? `?${tail}` : ''}`)
  },
  meetingAsk: (id, b) => request('POST', `/mi/v1/meetings/${enc(id)}/ask`, b),
  createMeetingAskSession: (id, b) =>
    request('POST', `/mi/v1/meetings/${enc(id)}/ask/sessions`, b || {}),

  getAskSession: (id) => request('GET', `/mi/v1/ask/sessions/${enc(id)}`),
  postAskTurn: (id, b) => request('POST', `/mi/v1/ask/sessions/${enc(id)}/turns`, b),
  retentionPurge: (b) => request('POST', '/mi/v1/retention/purge', b || {}),
}
