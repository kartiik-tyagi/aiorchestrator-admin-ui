/** Bullet-aware editing for plain-text MoM section bodies. Pure. */

const MARKER = '- '

/**
 * Handle Enter/Backspace at `caret` in `value`.
 * Returns { value, caret } when the key was handled, otherwise null.
 * - Enter at the end of "- text" → new line starting "- "
 * - Enter on an empty "- " line → the marker is removed (list ends)
 * - Backspace right after an empty "- " → the marker is removed
 */
export function continueBullet(value, caret, key) {
  const start = value.lastIndexOf('\n', caret - 1) + 1
  const endIdx = value.indexOf('\n', caret)
  const end = endIdx === -1 ? value.length : endIdx
  const line = value.slice(start, end)
  if (!line.startsWith(MARKER)) return null
  const emptyBullet = line.trim() === '-'
  if (key === 'Backspace') {
    if (!emptyBullet || caret !== start + MARKER.length) return null
    return { value: value.slice(0, start) + value.slice(start + MARKER.length), caret: start }
  }
  if (key !== 'Enter') return null
  if (emptyBullet) {
    return { value: value.slice(0, start) + value.slice(start + MARKER.length), caret: start }
  }
  const insert = '\n' + MARKER
  return { value: value.slice(0, caret) + insert + value.slice(caret), caret: caret + insert.length }
}
