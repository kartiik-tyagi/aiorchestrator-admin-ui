/**
 * Meeting Intelligence HTTP client (`/mi/v1`).
 *
 * Probe (2026-09-21, this binary on :8011):
 *   GET /mi/v1/health                                            → 200
 *   GET /mi/v1/meta                                              → 404  (no Meta screen)
 *   GET /mi/v1/profiles/{id}/actions                             → 404  (hide ledger)
 *   GET /mi/v1/profiles/{missing}/memory/inbox                   → 404 profile_not_found
 *   GET /mi/v1/kb/entities?profile_id=&entity_type=person        → 200
 *   GET /mi/v1/terminology?profile_id=                           → 200
 *   POST /mi/v1/meetings/{id}/insights/refresh                   → live (flags / draft gates)
 *
 * V1 MI is open — do not send the Call Center Bearer token or tenant_id.
 * Directory / inbox writes may require X-MI-KB-Token when the server sets MI_KB_TOKEN.
 */
import { ApiError } from '../client.js'

const enc = encodeURIComponent

/** @type {string} */
let kbToken = ''

/** Remember optional X-MI-KB-Token for directory / inbox writes (not CC Bearer). */
export function setMiKbToken(token) {
  kbToken = typeof token === 'string' ? token.trim() : ''
}

export function getMiKbToken() {
  return kbToken
}

function withKb(extraHeaders) {
  const h = { ...(extraHeaders ?? {}) }
  if (kbToken && !h['X-MI-KB-Token']) h['X-MI-KB-Token'] = kbToken
  return h
}

/**
 * @param {string} method
 * @param {string} path
 * @param {unknown} [body]
 * @param {Record<string, string>} [extraHeaders]
 * @param {{ rawText?: boolean, skipJsonContentType?: boolean }} [opts]
 */
async function request(method, path, body, extraHeaders, opts = {}) {
  const headers = { Accept: 'application/json', ...(extraHeaders ?? {}) }
  const init = { method, headers }
  if (body !== undefined) {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      // browser sets multipart boundary — do not set Content-Type
      init.body = body
    } else if (opts.skipJsonContentType) {
      init.body = /** @type {BodyInit} */ (body)
    } else {
      headers['Content-Type'] = 'application/json'
      init.body = typeof body === 'string' ? body : JSON.stringify(body)
    }
  }
  let res
  try {
    res = await fetch(path, init)
  } catch {
    throw new ApiError(
      'Cannot reach Meeting Intelligence on :8011. Is the orchestrator running?',
      0,
      'network',
    )
  }
  if (opts.rawText) {
    const text = await res.text()
    if (!res.ok) {
      let data = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = { raw: text }
      }
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
    return text
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

/**
 * @param {string} profileId
 * @param {'people'|'products'} kind
 * @param {string|Blob|File} csv
 * @param {{ mode?: string, dryRun?: boolean, confirmSync?: boolean, schema?: string }} [opts]
 */
function importDirectoryCsv(profileId, kind, csv, opts = {}) {
  const q = new URLSearchParams()
  if (opts.mode) q.set('mode', opts.mode)
  if (opts.dryRun) q.set('dry_run', '1')
  if (opts.confirmSync) q.set('confirm_sync', '1')
  if (opts.schema) q.set('schema', opts.schema)
  const tail = q.toString()
  const path = `/mi/v1/profiles/${enc(profileId)}/kb/${kind}/import${tail ? `?${tail}` : ''}`
  if (typeof FormData !== 'undefined' && (csv instanceof Blob || (typeof File !== 'undefined' && csv instanceof File))) {
    const fd = new FormData()
    fd.append('file', csv, kind === 'people' ? 'people.csv' : 'products.csv')
    return request('POST', path, fd, withKb())
  }
  const text = typeof csv === 'string' ? csv : String(csv)
  return request('POST', path, text, withKb({ 'Content-Type': 'text/csv' }), {
    skipJsonContentType: true,
  })
}

function exportDirectoryCsv(profileId, kind) {
  return request(
    'GET',
    `/mi/v1/profiles/${enc(profileId)}/kb/${kind}/export`,
    undefined,
    withKb({ Accept: 'text/csv, application/json' }),
    { rawText: true },
  )
}

export const mi = {
  health: () => request('GET', '/mi/v1/health'),
  listProfiles: () => request('GET', '/mi/v1/profiles'),
  createProfile: (b) => request('POST', '/mi/v1/profiles', b),
  getProfile: (id) => request('GET', `/mi/v1/profiles/${enc(id)}`),
  putProfile: (id, b) => request('PUT', `/mi/v1/profiles/${enc(id)}`, b),
  putKbDoc: (id, docId, b) =>
    request('PUT', `/mi/v1/profiles/${enc(id)}/kb/${enc(docId)}`, b),
  deleteKbDoc: (id, docId) =>
    request('DELETE', `/mi/v1/profiles/${enc(id)}/kb/${enc(docId)}`, undefined, withKb()),
  listKb: (id) => request('GET', `/mi/v1/profiles/${enc(id)}/kb`),
  profileAsk: (id, b) => request('POST', `/mi/v1/profiles/${enc(id)}/ask`, b),
  createProfileAskSession: (id, b) =>
    request('POST', `/mi/v1/profiles/${enc(id)}/ask/sessions`, b || {}),

  /** @param {string} id @param {{ step?: string }} [b] step in enabled|resolve|extract|windowing */
  enableKg: (id, b) =>
    request('POST', `/mi/v1/profiles/${enc(id)}/kg/enable`, { step: b?.step || 'enabled' }),

  listMemoryInbox: (id, limit) => {
    const q = limit != null ? `?limit=${enc(String(limit))}` : ''
    return request('GET', `/mi/v1/profiles/${enc(id)}/memory/inbox${q}`)
  },
  confirmInboxItem: (id, itemId, b) =>
    request(
      'POST',
      `/mi/v1/profiles/${enc(id)}/memory/inbox/${enc(itemId)}/confirm`,
      b || {},
      withKb(),
    ),
  rejectInboxItem: (id, itemId, b) =>
    request(
      'POST',
      `/mi/v1/profiles/${enc(id)}/memory/inbox/${enc(itemId)}/reject`,
      b || {},
      withKb(),
    ),

  importPeopleCsv: (id, csv, opts) => importDirectoryCsv(id, 'people', csv, opts),
  importProductsCsv: (id, csv, opts) => importDirectoryCsv(id, 'products', csv, opts),
  exportPeopleCsv: (id) => exportDirectoryCsv(id, 'people'),
  exportProductsCsv: (id) => exportDirectoryCsv(id, 'products'),

  listEntities: (q = {}) => {
    const qs = new URLSearchParams()
    if (q.profileId) qs.set('profile_id', q.profileId)
    if (q.entityType) qs.set('entity_type', q.entityType)
    if (q.status) qs.set('status', q.status)
    const tail = qs.toString()
    return request('GET', `/mi/v1/kb/entities${tail ? `?${tail}` : ''}`)
  },
  getEntity: (id) => request('GET', `/mi/v1/kb/entities/${enc(id)}`),

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
  refreshInsights: (id) =>
    request('POST', `/mi/v1/meetings/${enc(id)}/insights/refresh`, {}),
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

  listTerminology: (q = {}) => {
    const qs = new URLSearchParams()
    if (q.profileId) qs.set('profile_id', q.profileId)
    if (q.status) qs.set('status', q.status)
    const tail = qs.toString()
    return request('GET', `/mi/v1/terminology${tail ? `?${tail}` : ''}`)
  },
  createTerminology: (b) => request('POST', '/mi/v1/terminology', b),
  confirmTermAlias: (aliasId, b) =>
    request('POST', `/mi/v1/terminology/aliases/${enc(aliasId)}/confirm`, b || {}),
  rejectTermAlias: (aliasId, b) =>
    request('POST', `/mi/v1/terminology/aliases/${enc(aliasId)}/reject`, b || {}),
}
