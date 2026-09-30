import { useCallback, useEffect, useState } from 'react'
import { mi } from '../../api/mi/client'
import { Modal, TextField, useToast } from '../../components/ui'
import { opSentence, unsupportedFields } from '../../lib/miDraft'
import { miErrorSentence } from '../../lib/miErrors'

/**
 * Approve the current MoM draft to Official, as a dialog over the MoM tab.
 *
 * This used to be a tab of its own, which split one act across two screens: the
 * minutes were reviewed on MoM and approved somewhere the minutes were not
 * visible. Approving is the last step of reading the draft, so it belongs on
 * top of it.
 *
 * Still two server steps, and deliberately so — preview reconciles the ledger
 * and reports soft gates, confirm locks the version. The difference is that
 * opening the dialog runs the preview, so the reviewer reads the consequences
 * first and the only button left to press is the one that commits. A preview is
 * valid only for the draft version it was taken from; if the draft moves under
 * it, it is dropped rather than confirmed against the wrong version.
 */
export default function ApproveDialog({
  open,
  meetingId,
  draft,
  dirty,
  currentOfficialVersion,
  onClose,
  onApproved,
}) {
  const toast = useToast()
  const [label, setLabel] = useState('lab')
  const [rawPreview, setPreview] = useState(null)
  const [blocked, setBlocked] = useState([])
  const [acked, setAcked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewErr, setPreviewErr] = useState(null)

  const bad = unsupportedFields(draft)

  const review = useCallback(async () => {
    setPreviewing(true)
    setPreviewErr(null)
    setAcked(false)
    setBlocked([])
    try {
      const prev = await mi.approvePreview(meetingId, { approver_label: label })
      setPreview(prev)
    } catch (e) {
      setPreview(null)
      if (e.code === 'unsupported_ai_present') {
        setBlocked(bad.length ? bad : [{ path: 'draft', text: e.message }])
      }
      setPreviewErr(miErrorSentence(e.code, e.message))
    } finally {
      setPreviewing(false)
    }
    // `bad` is derived from the draft prop and only widens the message text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, label])

  // Preview on open, not on a button — the reviewer opened this to see what
  // approving would do. Re-running on every label keystroke would hammer the
  // endpoint, so the label has its own re-check.
  useEffect(() => {
    if (!open || dirty) return
    void review()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meetingId])

  useEffect(() => {
    if (open) return
    setPreview(null)
    setPreviewErr(null)
    setBlocked([])
    setAcked(false)
  }, [open])

  // A preview only describes the draft version it was taken from.
  const preview =
    rawPreview && draft && rawPreview.draft_version === draft.version ? rawPreview : null
  const staleReview = !!rawPreview && !preview

  const gates = preview?.soft_gates ?? []
  const needsAck = gates.length > 0 || !!preview?.acknowledge_required
  const flags = [...bad, ...blocked]
  const cannotConfirm =
    dirty || flags.length > 0 || !preview || previewing || (needsAck && !acked)

  const confirm = async () => {
    if (cannotConfirm || !preview) return
    setBusy(true)
    try {
      const off = await mi.approveConfirm(meetingId, {
        draft_id: preview.draft_id,
        draft_version: preview.draft_version,
        approver_label: label,
        reconciliation_ops: preview.reconciliation ?? [],
        acknowledge_soft_gates: needsAck && acked,
      })
      toast.ok(`Official version ${off.official_version} is locked.`)
      onClose?.()
      onApproved?.(off)
    } catch (e) {
      // Nothing was approved: say so, and drop a preview the server rejected.
      if (e.code === 'draft_version_conflict') setPreview(null)
      toast.push('err', `Not approved: ${miErrorSentence(e.code, e.message)}`)
    } finally {
      setBusy(false)
    }
  }

  const ops = preview?.reconciliation ?? []

  return (
    <Modal
      open={open}
      title="Approve to Official"
      hint="Locks this draft as an Official version. Official minutes are never edited in place — a later approval creates the next version."
      onClose={onClose}
      onSubmit={confirm}
      submitLabel={`Confirm Official v${(currentOfficialVersion ?? 0) + 1}`}
      submitDisabled={cannotConfirm}
      busy={busy}
    >
      {dirty && (
        <div className="probe warn">
          The MoM has unsaved changes. Save or discard them, then approve — Official is cut from
          the saved draft, not from what is on screen.
        </div>
      )}

      {flags.length > 0 && (
        <div className="probe err">
          Approve is blocked while unsupported_ai remains:{' '}
          {flags.map((f) => f.path + (f.text ? ` (${f.text})` : '')).join('; ')}
        </div>
      )}

      {!dirty && previewing && <p className="desc">Checking what approving would do…</p>}
      {!dirty && previewErr && !flags.length && <div className="probe err">{previewErr}</div>}
      {staleReview && (
        <div className="probe warn">
          The draft changed while this was open. Re-check before confirming.
        </div>
      )}

      {preview && (
        <>
          <p className="desc" style={{ marginTop: 0 }}>
            Approving draft v{preview.draft_version}
            {preview.draft_id ? ` (${preview.draft_id})` : ''}.
          </p>

          <div className="mi-approve-block">
            <div className="mi-approve-head">Ledger reconciliation</div>
            {!ops.length && (
              <p className="desc" style={{ margin: 0 }}>
                No reconciliation ops — confirming locks the minutes only.
              </p>
            )}
            {ops.map((op, i) => {
              const sentence = opSentence(op)
              return (
                <div key={i} className="desc" style={{ margin: 0 }}>
                  {sentence || <pre>{JSON.stringify(op, null, 2)}</pre>}
                </div>
              )
            })}
          </div>

          {needsAck && (
            <div className="probe warn">
              <strong>Quality warnings on this draft:</strong>
              <ul className="plain-list">
                {gates.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
              <label className="check">
                <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} />
                <span>I have reviewed these warnings</span>
              </label>
            </div>
          )}
        </>
      )}

      <div className="mi-inline-field">
        <TextField
          label="Approver label"
          value={label}
          onChange={setLabel}
          desc="Recorded on the Official version as who approved it."
        />
        <button
          type="button"
          className="btn secondary sm"
          onClick={() => void review()}
          disabled={previewing || dirty}
        >
          {previewing ? 'Checking…' : 'Re-check'}
        </button>
      </div>
    </Modal>
  )
}
