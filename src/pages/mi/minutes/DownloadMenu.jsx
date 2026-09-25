import { useEffect, useRef, useState } from 'react'
import { mi } from '../../../api/mi/client'
import { useToast } from '../../../components/ui'
import { miErrorSentence } from '../../../lib/miErrors'

const DOWNLOAD_FORMATS = [
  { format: 'pdf', label: 'PDF' },
  { format: 'docx', label: 'Word' },
  { format: 'md', label: 'Markdown' },
  { format: 'json', label: 'JSON' },
]

/**
 * Download ▾ — the server renders the file from saved data (MI.38); the browser
 * only saves it. `beforeDownload(format)` may resolve false to cancel (unsaved edits).
 */
export default function DownloadMenu({
  meetingId,
  draft = false,
  officialVersion,
  formats = DOWNLOAD_FORMATS,
  beforeDownload,
  disabled,
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = async (format) => {
    setOpen(false)
    if (beforeDownload && !(await beforeDownload(format))) return
    setBusy(format)
    try {
      const got = await mi.downloadExport(meetingId, { format, draft, officialVersion })
      toast.ok(`Downloaded ${got.filename}`)
    } catch (e) {
      toast.push('err', `Download failed: ${miErrorSentence(e.code, e.message)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="dl-menu" ref={ref}>
      <button
        type="button"
        className="btn sm"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled || !!busy}
        onClick={() => setOpen((o) => !o)}
      >
        {busy ? `Preparing ${busy.toUpperCase()}…` : 'Download ▾'}
      </button>
      {open && (
        <div className="dl-menu-list" role="menu">
          {formats.map((f) => (
            <button key={f.format} type="button" role="menuitem" onClick={() => void run(f.format)}>
              <span>{f.label}</span>
              <span className="dl-menu-ext">.{f.format}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
