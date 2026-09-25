import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffWords, hasChanges, tokenize } from './textDiff.js'
import { compareContent } from './miCompare.js'

const join = (parts, types) => parts.filter((p) => types.includes(p.type)).map((p) => p.text).join('')

test('diffWords: identical input has no changes', () => {
  const d = diffWords('Ship 4.2 on Friday.', 'Ship 4.2 on Friday.')
  assert.equal(hasChanges(d), false)
  assert.equal(join(d, ['eq']), 'Ship 4.2 on Friday.')
})

test('diffWords: word replacement', () => {
  const d = diffWords('Ship 4.2 on Friday.', 'Ship 4.3 on Monday.')
  assert.equal(join(d, ['eq', 'del']), 'Ship 4.2 on Friday.')
  assert.equal(join(d, ['eq', 'add']), 'Ship 4.3 on Monday.')
  assert.ok(d.some((p) => p.type === 'del' && p.text.includes('4.2')))
  assert.ok(d.some((p) => p.type === 'add' && p.text.includes('Monday.')))
})

test('diffWords: empty sides and deletion', () => {
  assert.deepEqual(diffWords('', 'new text'), [{ type: 'add', text: 'new text' }])
  assert.deepEqual(diffWords('old text', ''), [{ type: 'del', text: 'old text' }])
  assert.deepEqual(diffWords('', ''), [])
})

test('diffWords: long bodies fall back to lines and stay correct', () => {
  const a = Array.from({ length: 3000 }, (_, i) => `word${i}`).join(' ')
  const b = a.replace('word1500', 'CHANGED')
  const t0 = Date.now()
  const d = diffWords(a, b)
  assert.ok(Date.now() - t0 < 3000, 'long diff finishes quickly')
  assert.equal(join(d, ['eq', 'add']), b + '\n')
  assert.equal(join(d, ['eq', 'del']), a + '\n')
})

test('tokenize keeps whitespace so parts rejoin exactly', () => {
  assert.equal(tokenize('a  b\nc ').join(''), 'a  b\nc ')
})

const v1 = {
  mom: { sections: [{ id: 'summary', title: 'Summary', body: '- Ship Friday' }, { id: 'risks', title: 'Risks', body: '' }] },
  decisions: [
    { id: 'd1', text: 'Ship 4.2 on Friday' },
    { id: 'd2', text: 'Freeze billing' },
  ],
  actions: [
    { id: 'a1', text: 'Notes', owner_display_name: 'Akshat', due_date: '2026-09-10' },
    { id: 'a2', text: 'QA slot', owner_display_name: 'Priya' },
  ],
}

test('compareContent: same version → no changes', () => {
  const c = compareContent(v1, structuredClone(v1))
  assert.equal(c.changes, 0)
})

test('compareContent: changed, added, removed, reordered, field changes', () => {
  const v2 = structuredClone(v1)
  v2.mom.sections[0].body = '- Ship Monday'
  v2.mom.sections.pop()
  v2.decisions = [{ id: 'd2', text: 'Freeze billing' }, { id: 'd3', text: 'Retro Monday' }]
  v2.actions = [
    { id: 'a2', text: 'QA slot', owner_display_name: 'Neeraj', due_date: '2026-09-30' },
    { id: 'a1', text: 'Notes', owner_display_name: 'Akshat', due_date: '2026-09-10' },
  ]
  const c = compareContent(v1, v2)
  const st = (list) => Object.fromEntries(list.map((b) => [b.key, b.status]))
  assert.deepEqual(st(c.sections), { 'sec-summary': 'changed', 'sec-risks': 'removed' })
  assert.deepEqual(st(c.decisions), { 'decisions-d2': 'unchanged', 'decisions-d3': 'added', 'decisions-d1': 'removed' })
  assert.equal(st(c.actions)['actions-a1'], 'unchanged', 'reorder alone is not a change')
  const a2 = c.actions.find((b) => b.key === 'actions-a2')
  assert.equal(a2.status, 'changed')
  assert.deepEqual(a2.fields.map((f) => f.name).sort(), ['due', 'owner'])
  assert.equal(c.changes, 5)
})

test('compareContent: claims without ids pair by position (flagged)', () => {
  const a = { mom: {}, decisions: [{ text: 'one' }, { text: 'two' }], actions: [] }
  const b = { mom: {}, decisions: [{ text: 'one' }, { text: 'TWO' }], actions: [] }
  const c = compareContent(a, b)
  assert.equal(c.positional, true)
  assert.deepEqual(c.decisions.map((x) => x.status), ['unchanged', 'changed'])
})

test('compareContent: string-encoded JSON (API shape) works', () => {
  const s = { mom: JSON.stringify(v1.mom), decisions: JSON.stringify(v1.decisions), actions: JSON.stringify(v1.actions) }
  assert.equal(compareContent(s, v1).changes, 0)
})
