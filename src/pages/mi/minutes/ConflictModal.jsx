import { useState } from 'react'
import { Modal } from '../../../components/ui'
import { conflictRows } from '../../../lib/draftWorkspace'

/** Stale save: show what differs and let the reviewer keep theirs or mine. */
export default function ConflictModal({ conflict, working, onResolve }) {
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(false)
  if (!conflict || hidden) {
    return conflict ? (
      <div className="probe warn">
        This draft was saved by someone else after you opened it.{' '}
        <button type="button" className="btn secondary sm" onClick={() => setHidden(false)}>
          Resolve
        </button>
      </div>
    ) : null
  }
  const rows = conflictRows(working, conflict.theirs)
  const act = async (choice) => {
    setBusy(true)
    try {
      await onResolve(choice)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      title="Someone else saved this draft"
      hint={`Your edits are based on an older version. The saved draft is now v${conflict.theirs.version}.`}
      onClose={() => setHidden(true)}
      onSubmit={() => void act('mine')}
      submitLabel="Keep mine"
      busy={busy}
    >
      {rows.length === 0 && <p className="desc">No content differs. Keeping yours saves it as the next version.</p>}
      <div className="conflict-rows">
        {rows.map((r) => (
          <div key={r.label} className="conflict-row">
            <strong>{r.label}</strong>
            <div className="conflict-cols">
              <div>
                <span className="desc">Yours</span>
                <pre>{r.mine || '—'}</pre>
              </div>
              <div>
                <span className="desc">Saved</span>
                <pre>{r.theirs || '—'}</pre>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn secondary sm" disabled={busy} onClick={() => void act('theirs')}>
        Take theirs (discard mine)
      </button>
    </Modal>
  )
}
