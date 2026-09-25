import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialState, isDirty, ops, patchBody, reducer } from './draftWorkspace.js'

const draft = {
  id: 'd',
  version: 4,
  mom: { sections: [{ id: 'summary', title: 'Summary', body: '- a' }] },
  decisions: [{ id: 'd1', text: 'ship', origin: 'ai_supported' }],
  actions: [
    { id: 'a1', text: 'notes', origin: 'ai_supported' },
    { id: 'a2', text: 'qa', origin: 'ai_supported' },
  ],
}

const loaded = () => reducer(initialState, { type: 'loaded', draft })
const edit = (s, fn, key = '', at = 0) => reducer(s, { type: 'edit', fn, key, at })

test('fresh load is clean and sends nothing', () => {
  const s = loaded()
  assert.equal(isDirty(s), false)
  assert.equal(patchBody(s), null)
})

test('patch body carries only changed fields and expected_version', () => {
  const s = edit(loaded(), ops.setSection(0, 'body', '- b'))
  assert.equal(isDirty(s), true)
  const body = patchBody(s)
  assert.deepEqual(Object.keys(body).sort(), ['expected_version', 'mom'])
  assert.equal(body.expected_version, 4)
  assert.equal(body.mom.sections[0].body, '- b')
})

test('undo/redo across many steps and fields', () => {
  let s = loaded()
  for (let i = 0; i < 12; i++) s = edit(s, ops.setSection(0, 'body', `- v${i}`), `k${i}`)
  s = edit(s, ops.setClaim('actions', 1, { owner_display_name: 'Priya', due_date: '2026-10-01' }), 'owner')
  s = edit(s, ops.moveClaim('actions', 1, -1), 'move')
  s = edit(s, ops.addClaim('decisions'), 'add')
  s = edit(s, ops.removeClaim('decisions', 0), 'rm')
  assert.equal(s.working.decisions.length, 1)
  assert.equal(s.working.decisions[0].id, '')
  for (let i = 0; i < 16; i++) s = reducer(s, { type: 'undo' })
  assert.equal(isDirty(s), false, 'undoing every step returns to the loaded draft')
  for (let i = 0; i < 16; i++) s = reducer(s, { type: 'redo' })
  assert.equal(s.working.actions[0].id, 'a2')
  assert.equal(s.working.actions[0].owner_display_name, 'Priya')
  assert.equal(s.working.mom.sections[0].body, '- v11')
  assert.equal(s.working.decisions.length, 1)
})

test('typing in one field coalesces into one undo step', () => {
  let s = loaded()
  s = edit(s, ops.setSection(0, 'body', '- a1'), 'sec0', 1000)
  s = edit(s, ops.setSection(0, 'body', '- a12'), 'sec0', 1300)
  s = edit(s, ops.setSection(0, 'body', '- a123'), 'sec0', 1600)
  assert.equal(s.past.length, 1)
  s = edit(s, ops.setSection(0, 'body', '- later'), 'sec0', 5000)
  assert.equal(s.past.length, 2)
  s = reducer(s, { type: 'undo' })
  assert.equal(s.working.mom.sections[0].body, '- a123')
})

test('a new edit clears redo; no-op edits add no history', () => {
  let s = edit(loaded(), ops.setSection(0, 'title', 'Overview'), 't')
  s = reducer(s, { type: 'undo' })
  assert.equal(s.future.length, 1)
  s = edit(s, ops.setSection(0, 'body', '- x'), 'b')
  assert.equal(s.future.length, 0)
  const before = s.past.length
  s = edit(s, ops.moveClaim('actions', 0, -1), 'm')
  assert.equal(s.past.length, before)
})

test('conflict: keep mine rebases onto the winning version', () => {
  let s = edit(loaded(), ops.setClaim('decisions', 0, { text: 'ship friday' }), 'd')
  const theirs = { ...draft, version: 5, mom: { sections: [{ id: 'summary', title: 'Summary', body: '- theirs' }] } }
  s = reducer(s, { type: 'conflict', theirs })
  assert.ok(s.conflict)
  s = reducer(s, { type: 'keepMine' })
  assert.equal(s.conflict, null)
  const body = patchBody(s)
  assert.equal(body.expected_version, 5)
  assert.equal(body.decisions[0].text, 'ship friday')
  // Mine still has the old section body, which now differs from theirs, so it is sent too.
  assert.equal(body.mom.sections[0].body, '- a')
})

test('take theirs replaces working copy and history', () => {
  let s = edit(loaded(), ops.setSection(0, 'body', '- mine'), 'b')
  s = reducer(s, { type: 'loaded', draft: { ...draft, version: 5 } })
  assert.equal(isDirty(s), false)
  assert.equal(s.past.length, 0)
  assert.equal(s.draft.version, 5)
})

test('string-encoded JSON fields are handled', () => {
  const s = reducer(initialState, {
    type: 'loaded',
    draft: { version: 1, mom: JSON.stringify(draft.mom), decisions: '[]', actions: null },
  })
  assert.equal(isDirty(s), false)
  assert.equal(s.working.mom.sections.length, 1)
})
