import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DRAFT_WATERMARK,
  attendees,
  bodyBlocks,
  draftToDocument,
  durationMs,
  formatDuration,
  officialToDocument,
} from './miDocument.js'
import { filenameFromDisposition } from './miDownload.js'
import { continueBullet } from './miBodyEdit.js'

const tz = { timeZone: 'Asia/Kolkata' }

const facet = {
  id: 'm1',
  title: 'Weekly Release Sync',
  external_meeting_id: 'aKf6mNiI',
  created_at: '2026-09-07T09:14:00Z',
}
const segments = [
  { user_id: 'EMP1', display_name: 'Rishabh', t_start_ms: 0, t_end_ms: 4000 },
  { user_id: 'EMP2', display_name: 'Akshat', t_start_ms: 5000 },
  { user_id: 'EMP1', display_name: 'Rishabh', t_start_ms: 2820000, t_end_ms: 2825000 },
]
const mom = {
  sections: [
    { id: 'summary', title: 'Summary', body: '- Release stays Friday.\n- QA is the gate.' },
    { id: 'risks', title: 'Risks', body: '' },
  ],
}
const decisions = [
  { id: 'd1', text: 'Ship Friday', origin: 'ai_supported', span_text_snapshots: ['we ship friday'], evidence_spans: [{ segment_id: 's1', generation: 1 }] },
  { id: 'd2', text: 'Invented', origin: 'unsupported_ai' },
]
const actions = [
  { id: 'a1', text: 'Notes', owner_display_name: 'Akshat', owner_user_id: 'EMP2', due_date: '2026-09-10', origin: 'ai_supported' },
  { id: 'a2', text: 'QA slot', owner_user_id: 'EMP9', origin: 'reviewer_authored' },
]

test('draftToDocument mirrors the export model', () => {
  const draft = { id: 'dr', version: 5, transcript_generation: 1, mom, decisions, actions, updated_at: '2026-09-25T08:32:00Z' }
  const doc = draftToDocument(facet, draft, segments, tz)
  assert.equal(doc.kind, 'draft')
  assert.equal(doc.watermark, DRAFT_WATERMARK)
  assert.equal(doc.versionLabel, 'Draft v5')
  assert.match(doc.statusLine, /^Draft v5 · last edited 25 Sept? 2026, 14:02/)
  assert.equal(doc.meta[1].value, 'Rishabh, Akshat')
  assert.match(doc.meta[0].value, /\(47 min\)$/)
  assert.equal(doc.meta[2].value, 'aKf6mNiI · transcript generation 1')
  assert.equal(doc.sections[0].blocks.length, 2)
  assert.equal(doc.sections[1].blocks.length, 0)
  assert.equal(doc.decisions[1].flag, 'No transcript evidence')
  assert.deepEqual(doc.decisions[0].quotes, ['we ship friday'])
  assert.equal(doc.actions[0].owner, 'Akshat')
  assert.equal(doc.actions[1].owner, 'EMP9')
  assert.equal(doc.actions[1].due, '')
})

test('officialToDocument has no watermark and names the approver', () => {
  const off = { official_version: 2, transcript_generation: 1, mom, decisions, actions, approved_at: '2026-09-25T09:00:00Z', approver_label: 'Priya' }
  const doc = officialToDocument(facet, off, segments, tz)
  assert.equal(doc.watermark, '')
  assert.equal(doc.versionLabel, 'Official v2')
  assert.match(doc.statusLine, /^Approved minutes · Official v2 · approved .* by Priya$/)
})

test('fallbacks: title, empty segments, string-encoded JSON, skeleton', () => {
  const draft = { version: 1, mom: JSON.stringify({ skeleton: true, sections: [] }), decisions: '[]', actions: null }
  const doc = draftToDocument({ external_meeting_id: 'ext-9' }, draft, [], tz)
  assert.equal(doc.title, 'ext-9')
  assert.equal(doc.meta[1].value, '—')
  assert.equal(doc.meta[0].value, '—')
  assert.match(doc.statusLine, /skeleton draft$/)
  assert.equal(doc.decisions.length, 0)
  assert.equal(doc.actions.length, 0)
})

test('bodyBlocks splits bullets and paragraphs', () => {
  assert.deepEqual(bodyBlocks('- a\r\n* b\n• c\n\nplain line\n-   \n'), [
    { bullet: true, text: 'a' },
    { bullet: true, text: 'b' },
    { bullet: true, text: 'c' },
    { bullet: false, text: 'plain line' },
  ])
  assert.deepEqual(bodyBlocks(undefined), [])
})

test('attendees and duration', () => {
  assert.deepEqual(attendees(segments), [
    { userId: 'EMP1', name: 'Rishabh' },
    { userId: 'EMP2', name: 'Akshat' },
  ])
  assert.equal(durationMs(segments), 2825000)
  assert.equal(durationMs([{ user_id: 'x' }]), 0)
  assert.equal(formatDuration(20_000), 'under 1 min')
  assert.equal(formatDuration(30_000), '1 min') // rounds like Go's Duration.Round
  assert.equal(formatDuration(47 * 60_000), '47 min')
  assert.equal(formatDuration(125 * 60_000), '2 h 05 min')
})

test('filenameFromDisposition prefers filename*', () => {
  const h = `attachment; filename="MoM - Z_rich - 2026-09-07 - Draft v1.pdf"; filename*=UTF-8''MoM%20-%20Z%C3%BCrich%20-%202026-09-07%20-%20Draft%20v1.pdf`
  assert.equal(filenameFromDisposition(h), 'MoM - Zürich - 2026-09-07 - Draft v1.pdf')
  assert.equal(filenameFromDisposition('attachment; filename="a \\"b\\".md"'), 'a "b".md')
  assert.equal(filenameFromDisposition('attachment; filename=plain.json'), 'plain.json')
  assert.equal(filenameFromDisposition(`attachment; filename*=UTF-8''..%2F..%2Fevil.pdf`), '.._.._evil.pdf')
  assert.equal(filenameFromDisposition(null), '')
  assert.equal(filenameFromDisposition('inline'), '')
})

test('continueBullet: Enter continues, ends, Backspace removes marker', () => {
  let r = continueBullet('- one', 5, 'Enter')
  assert.deepEqual(r, { value: '- one\n- ', caret: 8 })
  r = continueBullet('- one\n- ', 8, 'Enter')
  assert.deepEqual(r, { value: '- one\n', caret: 6 })
  r = continueBullet('- one\n- ', 8, 'Backspace')
  assert.deepEqual(r, { value: '- one\n', caret: 6 })
  assert.equal(continueBullet('plain', 5, 'Enter'), null)
  assert.equal(continueBullet('- one', 3, 'Backspace'), null)
})

test('unsaved edit to a flagged claim clears the flag and marks it edited', () => {
  const saved = { version: 2, mom, decisions, actions }
  const working = { ...saved, decisions: [decisions[0], { ...decisions[1], text: 'Reworded and verified' }] }
  const doc = draftToDocument(facet, working, segments, { ...tz, baseline: saved })
  assert.equal(doc.decisions[1].flag, '')
  assert.equal(doc.decisions[1].edited, true)
  assert.equal(doc.decisions[0].edited, false)
  const clean = draftToDocument(facet, saved, segments, { ...tz, baseline: saved })
  assert.equal(clean.decisions[1].flag, 'No transcript evidence')
})
