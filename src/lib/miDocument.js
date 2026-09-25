/**
 * MoM document view model. Mirrors the orchestrator's internal/mi/export model
 * (doc 16 §5) block for block, so the preview is what Download produces.
 * Pure functions only — rendered by pages/mi/minutes/MinutesDocument.jsx.
 */
import { asList, asMom } from './miDraft.js'

export const DRAFT_WATERMARK = 'DRAFT – NOT APPROVED'
export const FLAG_UNSUPPORTED = 'No transcript evidence'
/** The extractor caps AI section bodies at this length; reviewers may exceed it. */
export const SECTION_SOFT_LIMIT = 400

const BULLETS = ['- ', '* ', '• ']

/** DOM id for a document block (outline rail ↔ document). */
export function blockId(key) {
  return `mp-${String(key).replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

/** Body text → [{ bullet, text }]; "- " / "* " / "• " lines are bullets. */
export function bodyBlocks(body) {
  const out = []
  for (const line of String(body ?? '').replace(/\r\n/g, '\n').split('\n')) {
    let t = line.trim()
    // An empty bullet ("- " left by the editor) is not content.
    if (!t || t === '-' || t === '*' || t === '•') continue
    let bullet = false
    for (const p of BULLETS) {
      if (t.startsWith(p)) {
        t = t.slice(p.length).trim()
        bullet = true
        break
      }
    }
    if (t) out.push({ bullet, text: t })
  }
  return out
}

/** Distinct speakers in first-appearance order: [{ userId, name }]. */
export function attendees(segments) {
  const seen = new Set()
  const out = []
  for (const s of segments ?? []) {
    const name = (s.display_name || s.user_id || '').trim()
    const key = s.user_id || name
    if (!name || seen.has(key)) continue
    seen.add(key)
    out.push({ userId: s.user_id || '', name })
  }
  return out
}

/** Transcript duration from segment timings, in ms (0 when unknown). */
export function durationMs(segments) {
  let lo = null
  let hi = null
  for (const s of segments ?? []) {
    if (s.t_start_ms == null) continue
    const end = Math.max(s.t_start_ms, s.t_end_ms ?? s.t_start_ms)
    lo = lo == null ? s.t_start_ms : Math.min(lo, s.t_start_ms)
    hi = hi == null ? end : Math.max(hi, end)
  }
  return lo == null || hi <= lo ? 0 : hi - lo
}

export function formatDuration(ms) {
  const m = Math.round(ms / 60000)
  if (m < 1) return 'under 1 min'
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

const DATE_FMT = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZoneName: 'short',
}

/** "25 Sep 2026, 14:02 GMT+5:30" in the viewer's locale and zone. */
export function formatWhen(iso, opts = {}) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(opts.locale || 'en-GB', { ...DATE_FMT, timeZone: opts.timeZone }).format(d)
}

function ownerLabel(c) {
  return (c.owner_display_name || c.owner_user_id || '').trim() || '—'
}

/** Same rule as the server (MI.37): text, owner or due date changed. */
function claimChanged(a, b) {
  return (
    (a.text || '') !== (b.text || '') ||
    (a.owner_user_id || '') !== (b.owner_user_id || '') ||
    (a.owner_display_name || '') !== (b.owner_display_name || '') ||
    (a.due_date || '') !== (b.due_date || '')
  )
}

function claimView(c, baseline) {
  const prior = c.id && baseline ? baseline.get(c.id) : null
  // An unsaved edit to a stored claim will be saved as reviewer_authored,
  // which also clears the "no evidence" gate for it.
  const edited = !!prior && claimChanged(c, prior)
  return {
    id: c.id || '',
    text: (c.text || '').trim(),
    origin: c.origin || '',
    edited,
    flag: c.origin === 'unsupported_ai' && !edited ? FLAG_UNSUPPORTED : '',
    quotes: Array.isArray(c.span_text_snapshots) ? c.span_text_snapshots : [],
    spans: Array.isArray(c.evidence_spans) ? c.evidence_spans : [],
  }
}

function claimMap(list) {
  const m = new Map()
  for (const c of asList(list)) if (c?.id) m.set(c.id, c)
  return m
}

function base(facet, pkg, segments, opts) {
  const baseDec = opts.baseline ? claimMap(opts.baseline.decisions) : null
  const baseAct = opts.baseline ? claimMap(opts.baseline.actions) : null
  const title = (facet?.title || '').trim() || facet?.external_meeting_id || 'Meeting'
  let when = formatWhen(facet?.created_at, opts)
  const dur = durationMs(segments)
  if (dur > 0) when += ` (${formatDuration(dur)})`
  const names = attendees(segments).map((a) => a.name)
  let source = facet?.external_meeting_id || ''
  if (pkg?.transcript_generation > 0) source += ` · transcript generation ${pkg.transcript_generation}`
  const mom = asMom(pkg?.mom)
  return {
    title,
    meetingId: facet?.id || pkg?.meeting_id || '',
    meta: [
      { label: 'Date', value: when },
      { label: 'Attendees', value: names.length ? names.join(', ') : '—' },
      { label: 'Source', value: source },
    ],
    sections: (mom.sections ?? []).map((s) => ({
      id: s.id || '',
      title: (s.title || '').trim() || s.id || '',
      body: typeof s.body === 'string' ? s.body : '',
      blocks: bodyBlocks(typeof s.body === 'string' ? s.body : ''),
    })),
    decisions: asList(pkg?.decisions).map((c) => claimView(c, baseDec)),
    actions: asList(pkg?.actions).map((c) => ({
      ...claimView(c, baseAct),
      owner: ownerLabel(c),
      ownerUserId: c.owner_user_id || '',
      ownerDisplayName: c.owner_display_name || '',
      due: (c.due_date || '').trim(),
    })),
  }
}

function isSkeleton(draft) {
  return !!(asMom(draft?.mom).skeleton || draft?.quality_flags?.skeleton)
}

/**
 * facet = GET /meetings/{id}; draft = GET …/draft (or the working copy);
 * segments = transcript. opts.baseline = the saved draft, to mark unsaved claim edits.
 */
export function draftToDocument(facet, draft, segments, opts = {}) {
  const doc = base(facet, draft, segments, opts)
  let status = `Draft v${draft?.version ?? '?'} · last edited ${formatWhen(draft?.updated_at, opts)}`
  if (isSkeleton(draft)) status += ' · skeleton draft'
  return {
    ...doc,
    kind: 'draft',
    version: draft?.version,
    versionLabel: `Draft v${draft?.version ?? '?'}`,
    statusLine: status,
    watermark: DRAFT_WATERMARK,
  }
}

/** official = one row of GET …/official or …/official/history. */
export function officialToDocument(facet, official, segments, opts = {}) {
  const doc = base(facet, official, segments, opts)
  let status = `Approved minutes · Official v${official?.official_version ?? '?'} · approved ${formatWhen(official?.approved_at, opts)}`
  if (official?.approver_label) status += ` by ${official.approver_label}`
  return {
    ...doc,
    kind: 'official',
    version: official?.official_version,
    versionLabel: `Official v${official?.official_version ?? '?'}`,
    statusLine: status,
    watermark: '',
  }
}
