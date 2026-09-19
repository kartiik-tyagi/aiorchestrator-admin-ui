/**
 * Meeting Intelligence HTTP client (`/mi/v1`).
 *
 * Probe (2026-09-19, this binary):
 *   GET /mi/v1/meta                 → 404  (no Meta screen)
 *   GET /mi/v1/profiles/{id}/actions → 404  (hide ledger until a later probe is 200)
 *
 * V1 MI is open — do not send the Call Center Bearer token or tenant_id.
 */
import { ApiError } from '../client.js'

const enc = encodeURIComponent

async function request(method, path, body) {
  const headers = { Accept: 'application/json' }
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
    const message =
      (err && typeof err === 'object' && err.message) ||
      (typeof err === 'string' ? err : null) ||
      res.statusText ||
      `HTTP ${res.status}`
    throw new ApiError(message, res.status, err?.code, err?.details)
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

  listMeetings: () => request('GET', '/mi/v1/meetings'),
  createMeeting: (b) => request('POST', '/mi/v1/meetings', b),
  getMeeting: (id) => request('GET', `/mi/v1/meetings/${enc(id)}`),
  startCapture: (id, b) =>
    request('POST', `/mi/v1/meetings/${enc(id)}/start-capture`, b || {}),
  endMeeting: (id, b) => request('POST', `/mi/v1/meetings/${enc(id)}/end`, b || {}),
  cancelMeeting: (id, b) => request('POST', `/mi/v1/meetings/${enc(id)}/cancel`, b || {}),
  pushTranscripts: (id, b) =>
    request('POST', `/mi/v1/meetings/${enc(id)}/transcripts`, b),
  getTranscript: (id) => request('GET', `/mi/v1/meetings/${enc(id)}/transcript`),
  regenerate: (id, b) => request('POST', `/mi/v1/meetings/${enc(id)}/regenerate`, b || {}),
  getDraft: (id) => request('GET', `/mi/v1/meetings/${enc(id)}/draft`),
  patchDraft: (id, b) => request('PATCH', `/mi/v1/meetings/${enc(id)}/draft`, b),
  approvePreview: (id, b) => request('POST', `/mi/v1/meetings/${enc(id)}/approve`, b || {}),
  approveConfirm: (id, b) =>
    request('POST', `/mi/v1/meetings/${enc(id)}/approve/confirm`, b || {}),
  getOfficial: (id) => request('GET', `/mi/v1/meetings/${enc(id)}/official`),
  getOfficialHistory: (id) =>
    request('GET', `/mi/v1/meetings/${enc(id)}/official/history`),
  exportMeeting: (id) => request('GET', `/mi/v1/meetings/${enc(id)}/export`),
  meetingAsk: (id, b) => request('POST', `/mi/v1/meetings/${enc(id)}/ask`, b),
  createMeetingAskSession: (id, b) =>
    request('POST', `/mi/v1/meetings/${enc(id)}/ask/sessions`, b || {}),

  getAskSession: (id) => request('GET', `/mi/v1/ask/sessions/${enc(id)}`),
  postAskTurn: (id, b) => request('POST', `/mi/v1/ask/sessions/${enc(id)}/turns`, b),
  retentionPurge: (b) => request('POST', '/mi/v1/retention/purge', b || {}),
}
