import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isUuidV4, randomUUID } from './randomId.js'

test('randomUUID: native path returns a v4 uuid', () => {
  assert.equal(isUuidV4(randomUUID()), true)
})

test('randomUUID: getRandomValues fallback when randomUUID is missing', () => {
  const orig = crypto.randomUUID
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true, writable: true })
  try {
    assert.equal(typeof crypto.randomUUID, 'undefined')
    assert.equal(isUuidV4(randomUUID()), true)
  } finally {
    Object.defineProperty(crypto, 'randomUUID', { value: orig, configurable: true, writable: true })
  }
})
