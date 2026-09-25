/** Helpers for saving server-rendered MoM files (GET …/export). */

/**
 * File name from a Content-Disposition header: RFC 5987 `filename*` first,
 * then quoted/unquoted `filename`. Returns '' when neither is usable.
 * @param {string|null} header
 */
export function filenameFromDisposition(header) {
  if (!header) return ''
  const star = /filename\*\s*=\s*([^;]+)/i.exec(header)
  if (star) {
    let v = star[1].trim().replace(/^"(.*)"$/, '$1')
    const m = /^([^']*)'[^']*'(.*)$/.exec(v)
    if (m) v = m[2]
    try {
      const decoded = decodeURIComponent(v)
      if (decoded) return safeName(decoded)
    } catch {
      /* fall through to filename= */
    }
  }
  const plain = /filename\s*=\s*("((?:[^"\\]|\\.)*)"|[^;]+)/i.exec(header)
  if (plain) {
    const v = plain[2] != null ? plain[2].replace(/\\(.)/g, '$1') : plain[1].trim()
    return safeName(v)
  }
  return ''
}

/** Strip path separators so a header can never point outside the downloads folder. */
function safeName(name) {
  return name.replace(/[\\/]/g, '_').trim()
}

/** Save bytes in the browser under `name` (object URL + temporary <a download>). */
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a tick to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
