import { useEffect, useMemo, useState } from 'react'
import { mi } from '../../../api/mi/client'
import { Modal, useToast } from '../../../components/ui'
import { draftToDocument } from '../../../lib/miDocument'
import { miErrorSentence } from '../../../lib/miErrors'
import MinutesDocument from './MinutesDocument'
import { SOURCE_LABEL } from './historyLabels'

/**
 * Draft history (wave 7.5): every saved state of the current draft. Open one
 * read-only, or restore it as a new version (never while there are unsaved edits).
 */
export default function HistoryDrawer({ meetingId, facet, segments, ws, onClose }) {
  const toast = useToast()
  const [list, setList] = useState(null)
  const [err, setErr] = useState(null)
  const [open, setOpen] = useState(null) // full revision
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const version = ws.draft?.version

  useEffect(() => {
    let live = true
    mi.listDraftRevisions(meetingId)
      .then((d) => live && (setList(d.revisions ?? []), setErr(null)))
      .catch((e) => live && (setList([]), setErr(miErrorSentence(e.code, e.message))))
    return () => {
      live = false
    }
  }, [meetingId, version])

  const openRev = async (id) => {
    try {
      setOpen(await mi.getDraftRevision(meetingId, id))
    } catch (e) {
      toast.push('err', miErrorSentence(e.code, e.message))
    }
  }

  const doc = useMemo(
    () => (open ? { ...draftToDocument(facet, { ...ws.draft, ...open, updated_at: open.created_at }, segments), versionLabel: `Revision v${open.version}` } : null),
    [open, facet, ws.draft, segments],
  )

  const restore = async () => {
    setBusy(true)
    try {
      const d = await mi.restoreDraftRevision(meetingId, open.id, ws.draft.version)
      await ws.reload()
      toast.ok(d.version === ws.draft.version ? 'That version is already current.' : `Restored as draft v${d.version}.`)
      setConfirm(false)
      setOpen(null)
    } catch (e) {
      toast.push('err', `Not restored: ${miErrorSentence(e.code, e.message)}`)
      if (e.code === 'draft_version_conflict') await ws.reload()
      setConfirm(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="history-drawer" aria-label="Draft history">
      <div className="history-head">
        <strong>Draft history</strong>
        <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Close history">
          ✕
        </button>
      </div>
      {err && <div className="probe err">{err}</div>}
      {!list && <p className="desc">Loading…</p>}
      {list?.length === 0 && !err && <p className="desc">No saved versions yet.</p>}
      <ol className="history-list">
        {(list ?? []).map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className={`history-item ${open?.id === r.id ? 'on' : ''}`}
              onClick={() => void openRev(r.id)}
            >
              <span className="history-v">v{r.version}</span>
              <span className={`history-src s-${r.source}`}>{SOURCE_LABEL[r.source] || r.source}</span>
              <span className="history-when">{new Date(r.created_at).toLocaleString()}</span>
              <span className="history-counts">
                {r.sections_count} sections · {r.decisions_count} decisions · {r.actions_count} actions
              </span>
            </button>
          </li>
        ))}
      </ol>

      {open && doc && (
        <div className="history-preview">
          <div className="minutes-toolbar">
            <span className="status-chip">
              v{open.version} · {SOURCE_LABEL[open.source] || open.source}
            </span>
            <span className="spacer" />
            <button
              type="button"
              className="btn sm"
              disabled={ws.dirty}
              title={ws.dirty ? 'Save or discard your edits first' : undefined}
              onClick={() => setConfirm(true)}
            >
              Restore this version
            </button>
          </div>
          {ws.dirty && <div className="probe warn">Save or discard your edits before restoring.</div>}
          <MinutesDocument doc={doc} mode="preview" />
        </div>
      )}

      <Modal
        open={confirm}
        title={`Restore v${open?.version}?`}
        hint={`The draft becomes v${(version ?? 0) + 1} with this content. The current v${version} stays in history.`}
        onClose={() => setConfirm(false)}
        onSubmit={() => void restore()}
        submitLabel="Restore"
        busy={busy}
      />
    </aside>
  )
}
