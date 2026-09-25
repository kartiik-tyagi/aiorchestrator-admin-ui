import { useEffect, useState } from 'react'
import { mi } from '../../api/mi/client'
import { Card, TextField, useToast } from '../../components/ui'
import { opSentence, unsupportedFields } from '../../lib/miDraft'
import { miErrorSentence } from '../../lib/miErrors'

/**
 * Two-step approve: preview (reconciliation + soft gates) then confirm.
 * `dirty` blocks approval while the MoM tab holds unsaved edits; `onApproved`
 * receives the new Official so the page can open it (wave 7.4).
 */
export default function ApproveWizard({ meetingId, draft: draftProp, dirty, onApproved }) {
  const toast = useToast()
  const [draft, setDraft] = useState(draftProp)
  const [label, setLabel] = useState('lab')
  const [rawPreview, setPreview] = useState(null)
  const [blocked, setBlocked] = useState([])
  const [acked, setAcked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(null)

  useEffect(() => {
    if (draftProp) {
      setDraft(draftProp)
      return
    }
    mi.getDraft(meetingId)
      .then(setDraft)
      .catch(() => setDraft(null))
  }, [meetingId, draftProp])

  // A preview is only valid for the draft version it was taken from.
  const preview = rawPreview && draft && rawPreview.draft_version === draft.version ? rawPreview : null

  const bad = unsupportedFields(draft)
  const gates = preview?.soft_gates ?? []
  const needsAck = gates.length > 0 || !!preview?.acknowledge_required
  const cannotConfirm = dirty || bad.length > 0 || blocked.length > 0 || !preview || (needsAck && !acked)

  const review = async () => {
    setBusy(true)
    setLocked(null)
    setAcked(false)
    try {
      const prev = await mi.approvePreview(meetingId, { approver_label: label })
      setPreview(prev)
      setBlocked([])
      toast.ok('Review the reconciliation list, then confirm official')
    } catch (e) {
      setPreview(null)
      if (e.code === 'unsupported_ai_present') {
        setBlocked(bad.length ? bad : [{ path: 'draft', text: e.message }])
      }
      toast.fail(e, 'Review for approve')
    } finally {
      setBusy(false)
    }
  }

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
      setLocked(off)
      setPreview(null)
      toast.ok(`Official version ${off.official_version} is locked.`)
      onApproved?.(off)
    } catch (e) {
      // Nothing was approved: say so, and drop a preview the server rejected.
      if (e.code === 'draft_version_conflict') setPreview(null)
      toast.push('err', `Not approved: ${miErrorSentence(e.code, e.message)}`)
    } finally {
      setBusy(false)
    }
  }

  const flags = [...bad, ...blocked]

  return (
    <Card title="Approve" hint="Two steps. Preview first — never skip straight to official.">
      {dirty && (
        <div className="probe warn">The MoM tab has unsaved changes. Save or discard them before approving.</div>
      )}
      {flags.length > 0 && (
        <div className="probe err">
          Approve is blocked while unsupported_ai remains:{' '}
          {flags.map((f) => f.path + (f.text ? ` (${f.text})` : '')).join('; ')}
        </div>
      )}
      <TextField label="Approver label" value={label} onChange={setLabel} />
      <div className="actions tight">
        <button className="btn" disabled={busy || !draft || dirty} onClick={review}>
          Review for approve
        </button>
        <button className="btn" disabled={busy || cannotConfirm} onClick={confirm}>
          Confirm official
        </button>
      </div>
      {preview && (
        <div className="card sub">
          <p className="desc">
            Draft {preview.draft_id} v{preview.draft_version}
          </p>
          {(preview.reconciliation ?? []).length === 0 && (
            <p className="desc">No ledger reconciliation ops — confirm will lock minutes only.</p>
          )}
          {(preview.reconciliation ?? []).map((op, i) => {
            const sentence = opSentence(op)
            return (
              <div key={i} className="desc">
                {sentence || <pre>{JSON.stringify(op, null, 2)}</pre>}
              </div>
            )
          })}
          {needsAck && (
            <div className="probe warn">
              <strong>Quality warnings on this draft:</strong>
              <ul className="plain-list">
                {gates.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
              <label>
                <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} /> I have
                reviewed these warnings
              </label>
            </div>
          )}
        </div>
      )}
      {locked && <div className="probe ok">Official version {locked.official_version} is locked.</div>}
    </Card>
  )
}
