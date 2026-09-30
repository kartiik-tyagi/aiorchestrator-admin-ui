import { useEffect, useState } from 'react'
import { mi } from '../../api/mi/client'
import { Modal, TextField, useToast } from '../../components/ui'

/**
 * Confirm and perform DELETE /mi/v1/profiles/{id}.
 *
 * Deleting a desk takes its Minutes sections, directory entities, terminology,
 * standing docs, branding and Ask history with it, and none of that is
 * recoverable from this console. So the dialog states what goes, and the
 * operator has to type the profile name back — an accidental Enter or a
 * mis-aimed click cannot delete anything.
 *
 * The server refuses (409 profile_has_meetings) while any meeting still pins
 * this profile. Rather than let the operator find that out by being rejected,
 * the dialog counts the meetings up front and, when there are any, offers no
 * delete at all — only a link to them.
 */
export default function DeleteProfileDialog({ open, profile, onClose, onDeleted }) {
  const toast = useToast()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [meetings, setMeetings] = useState(null)
  const [countErr, setCountErr] = useState(null)

  const id = profile?.id ?? ''
  const name = profile?.name || id

  useEffect(() => {
    if (!open || !id) return
    setTyped('')
    setMeetings(null)
    setCountErr(null)
    let live = true
    mi.listMeetings(id)
      .then((d) => {
        if (live) setMeetings((d.meetings ?? []).length)
      })
      .catch((e) => {
        // A failed count must not imply "safe to delete" — say so and let the
        // server be the authority.
        if (live) setCountErr(e.message || 'Could not count meetings for this profile.')
      })
    return () => {
      live = false
    }
  }, [open, id])

  const blocked = meetings != null && meetings > 0
  const confirmed = typed.trim() === name

  const remove = async () => {
    if (!confirmed || blocked) return
    setBusy(true)
    try {
      await mi.deleteProfile(id)
      toast.ok(`Deleted ${name}`)
      onClose?.()
      onDeleted?.(id)
    } catch (e) {
      toast.fail(e, 'Delete profile')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={`Delete ${name}?`}
      hint="This cannot be undone from this console."
      onClose={onClose}
      onSubmit={remove}
      submitLabel="Delete profile"
      submitTone="danger"
      submitDisabled={!confirmed || blocked || meetings == null}
      busy={busy}
    >
      {meetings == null && !countErr && <p className="desc">Checking for meetings…</p>}
      {countErr && <div className="probe warn">{countErr}</div>}

      {blocked && (
        <div className="probe err">
          This profile has {meetings} meeting{meetings === 1 ? '' : 's'}. Every meeting pins the
          profile it was born with, so the profile cannot be deleted while any of them exist.
          Delete or move those meetings first.
        </div>
      )}

      {!blocked && meetings != null && (
        <>
          <p className="desc" style={{ marginTop: 0 }}>
            Deleting this profile also removes its Minutes template, standing docs, people and
            product directory, terminology, export branding and Ask history. Audit events are kept.
          </p>
          <TextField
            label={`Type the profile name to confirm`}
            value={typed}
            onChange={setTyped}
            placeholder={name}
            desc={
              <>
                Type <span className="mi-confirm-name">{name}</span> exactly.
              </>
            }
          />
        </>
      )}
    </Modal>
  )
}
