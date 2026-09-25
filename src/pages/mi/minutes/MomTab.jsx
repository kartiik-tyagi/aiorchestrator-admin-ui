import { useMemo, useRef, useState } from 'react'
import { Modal } from '../../../components/ui'
import { attendees, draftToDocument } from '../../../lib/miDocument'
import { miErrorSentence } from '../../../lib/miErrors'
import { jobTerminal } from '../../../lib/miLifecycle'
import CompareView from './CompareView'
import ConflictModal from './ConflictModal'
import DownloadMenu from './DownloadMenu'
import HistoryDrawer from './HistoryDrawer'
import MinutesDocument from './MinutesDocument'
import OutlineRail from './OutlineRail'

function timeOf(d) {
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
}

/**
 * MoM tab (wave 7.3): the draft as a document. Preview by default; Edit makes
 * blocks editable in place. All state lives in `ws` (useDraftWorkspace) on the
 * meeting page, so switching tabs never loses edits.
 */
export default function MomTab({ meetingId, facet, ws, segments, mode, setMode, onOpenSegment }) {
  const [discarding, setDiscarding] = useState(false)
  const [panel, setPanel] = useState(null) // null | 'history' | 'compare'
  const [dlPrompt, setDlPrompt] = useState(null) // { resolve }
  const rootRef = useRef(null)
  const jobRunning = !jobTerminal(facet?.job?.state)
  const people = useMemo(() => attendees(segments), [segments])
  const doc = useMemo(() => {
    if (!ws.draft || !ws.working) return null
    return draftToDocument(facet, { ...ws.draft, ...ws.working }, segments, { baseline: ws.draft })
  }, [facet, ws.draft, ws.working, segments])
  const editor = useMemo(() => ({ ...ws.editor, attendees: people }), [ws.editor, people])

  if (ws.loadError && !ws.draft) {
    const code = ws.loadError.code
    return (
      <div className="card">
        <p className="desc">
          {jobRunning
            ? `Minutes are being generated (job ${facet?.job?.state}). This tab updates when the draft is ready.`
            : miErrorSentence(code, ws.loadError.message)}
        </p>
      </div>
    )
  }
  if (!doc) return <p className="desc">Loading minutes…</p>

  const editing = mode === 'edit'
  const canEdit = !jobRunning && !ws.jobBusy

  const onKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey
    if (!mod) return
    const k = e.key.toLowerCase()
    if (k === 's') {
      e.preventDefault()
      if (ws.dirty && !ws.saving) void ws.save()
    } else if (editing && k === 'z' && !e.shiftKey) {
      // Controlled fields: route undo to the workspace, not the browser.
      e.preventDefault()
      ws.undo()
    } else if (editing && ((k === 'z' && e.shiftKey) || k === 'y')) {
      e.preventDefault()
      ws.redo()
    }
  }

  const beforeDownload = () =>
    ws.dirty ? new Promise((resolve) => setDlPrompt({ resolve })) : Promise.resolve(true)

  const answerDownload = async (choice) => {
    const p = dlPrompt
    setDlPrompt(null)
    if (!p) return
    if (choice === 'save') {
      p.resolve(await ws.save())
    } else {
      p.resolve(choice === 'last')
    }
  }

  return (
    <div ref={rootRef} onKeyDown={onKeyDown}>
      <div className="minutes-toolbar">
        <span className="status-chip draft">Draft v{ws.draft.version}</span>
        {ws.dirty && <span className="status-chip dirty">Unsaved changes</span>}
        {!ws.dirty && ws.savedAt && <span className="status-chip">Saved v{ws.draft.version} · {timeOf(ws.savedAt)}</span>}
        <span className="seg-toggle" role="group" aria-label="View mode">
          <button type="button" className={!editing ? 'on' : ''} aria-pressed={!editing} onClick={() => setMode('preview')}>
            Preview
          </button>
          <button
            type="button"
            className={editing ? 'on' : ''}
            aria-pressed={editing}
            disabled={!canEdit}
            title={!canEdit ? 'A regeneration is running' : undefined}
            onClick={() => setMode('edit')}
          >
            Edit
          </button>
        </span>
        {editing && (
          <>
            <button type="button" className="btn secondary sm" disabled={!ws.canUndo} onClick={ws.undo} title="Undo (Ctrl+Z)">
              Undo
            </button>
            <button type="button" className="btn secondary sm" disabled={!ws.canRedo} onClick={ws.redo} title="Redo (Ctrl+Shift+Z)">
              Redo
            </button>
          </>
        )}
        <button
          type="button"
          className="btn sm"
          disabled={!ws.dirty || ws.saving || !canEdit}
          onClick={() => void ws.save()}
          title="Save (Ctrl+S)"
        >
          {ws.saving ? 'Saving…' : 'Save'}
        </button>
        {ws.dirty &&
          (discarding ? (
            <>
              <button
                type="button"
                className="btn danger sm"
                onClick={() => {
                  ws.discard()
                  setDiscarding(false)
                }}
              >
                Discard changes
              </button>
              <button type="button" className="btn secondary sm" onClick={() => setDiscarding(false)}>
                Keep editing
              </button>
            </>
          ) : (
            <button type="button" className="btn ghost sm" onClick={() => setDiscarding(true)}>
              Discard…
            </button>
          ))}
        <span className="spacer" />
        <button
          type="button"
          className={`btn ${panel === 'history' ? '' : 'secondary'} sm`}
          aria-pressed={panel === 'history'}
          onClick={() => setPanel((p) => (p === 'history' ? null : 'history'))}
        >
          History
        </button>
        <button
          type="button"
          className={`btn ${panel === 'compare' ? '' : 'secondary'} sm`}
          aria-pressed={panel === 'compare'}
          onClick={() => setPanel((p) => (p === 'compare' ? null : 'compare'))}
        >
          Compare
        </button>
        <DownloadMenu meetingId={meetingId} draft beforeDownload={beforeDownload} />
      </div>

      {(jobRunning || ws.jobBusy) && (
        <div className="probe warn">
          A regeneration is running. Editing is paused and your unsaved edits are kept; save after it finishes.
        </div>
      )}
      {ws.saveError && <div className="probe err">Save failed: {ws.saveError} Your edits are kept.</div>}
      <ConflictModal conflict={ws.conflict} working={ws.working} onResolve={ws.resolveConflict} />

      {panel === 'compare' ? (
        <CompareView meetingId={meetingId} ws={ws} />
      ) : (
        <div className={`minutes-layout ${panel === 'history' ? 'with-history' : ''}`}>
          <OutlineRail doc={doc} />
          <MinutesDocument doc={doc} mode={editing && canEdit ? 'edit' : 'preview'} editor={editor} onOpenSegment={onOpenSegment} />
          {panel === 'history' && (
            <HistoryDrawer meetingId={meetingId} facet={facet} segments={segments} ws={ws} onClose={() => setPanel(null)} />
          )}
        </div>
      )}

      <Modal
        open={!!dlPrompt}
        title="Download with unsaved changes?"
        hint="Downloads are made from the saved draft. Save first to include your edits."
        onClose={() => void answerDownload('cancel')}
        onSubmit={() => void answerDownload('save')}
        submitLabel="Save and download"
        busy={ws.saving}
      >
        <button type="button" className="btn secondary sm" onClick={() => void answerDownload('last')}>
          Download last saved (v{ws.draft.version})
        </button>
      </Modal>
    </div>
  )
}
