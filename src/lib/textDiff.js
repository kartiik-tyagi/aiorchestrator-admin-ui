/**
 * Word-level diff (LCS) for comparing MoM versions (wave 7.5). No dependency.
 * Output: [{ type: 'eq'|'add'|'del', text }], whitespace kept with its word.
 */

/** Split into words, keeping trailing whitespace attached so output re-joins exactly. */
export function tokenize(s) {
  return String(s ?? '').match(/\S+\s*|\s+/g) ?? []
}

// Beyond this many LCS cells, fall back to a line diff so huge bodies stay fast.
const MAX_CELLS = 2_000_000

function merge(out, type, text) {
  if (!text) return
  const last = out[out.length - 1]
  if (last && last.type === type) last.text += text
  else out.push({ type, text })
}

function lcsDiff(a, b) {
  const n = a.length
  const m = b.length
  // dp[i][j] = LCS length of a[i:], b[j:] (flattened).
  const w = m + 1
  const dp = new Uint32Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = a[i].trim() === b[j].trim() ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1])
    }
  }
  const out = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i].trim() === b[j].trim()) {
      merge(out, 'eq', b[j])
      i++
      j++
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
      merge(out, 'del', a[i++])
    } else {
      merge(out, 'add', b[j++])
    }
  }
  while (i < n) merge(out, 'del', a[i++])
  while (j < m) merge(out, 'add', b[j++])
  return out
}

/** Diff two strings word by word. */
export function diffWords(before, after) {
  const a = tokenize(before)
  const b = tokenize(after)
  if (a.length * b.length > MAX_CELLS) {
    const la = String(before ?? '').split('\n').map((l) => l + '\n')
    const lb = String(after ?? '').split('\n').map((l) => l + '\n')
    return lcsDiff(la, lb)
  }
  return lcsDiff(a, b)
}

/** True when the diff has any change. */
export function hasChanges(parts) {
  return parts.some((p) => p.type !== 'eq')
}
