import { useCallback, useEffect, useState } from 'react'
import { mi } from '../../api/mi/client'
import { Card, TextField, useToast } from '../../components/ui'
import { miErrorSentence } from '../../lib/miErrors'

function asList(res) {
  return res?.items ?? res?.inbox ?? (Array.isArray(res) ? res : [])
}

function targetLabel(item) {
  if (item.kind === 'term_alias') {
    return item.canonical_term || item.terminology_id || '—'
  }
  return item.entity_name || item.entity_id || '—'
}

/**
 * Profile memory inbox — confirm/reject pending kb_alias | term_alias.
 * Does not rewrite past Official minutes.
 */
export default function MemoryInbox({ profileId }) {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [actor, setActor] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await mi.listMemoryInbox(profileId)
      setItems(asList(res))
      setErr(null)
    } catch (e) {
      setErr(miErrorSentence(e.code, e.message))
      setItems([])
    }
  }, [profileId])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (itemId, action) => {
    setBusy(true)
    try {
      const body = actor.trim() ? { actor_label: actor.trim() } : {}
      if (action === 'confirm') await mi.confirmInboxItem(profileId, itemId, body)
      else await mi.rejectInboxItem(profileId, itemId, body)
      toast.ok(action === 'confirm' ? 'Confirmed into org memory.' : 'Rejected.')
      await load()
    } catch (e) {
      toast.push('err', miErrorSentence(e.code, e.message))
    } finally {
      setBusy(false)
    }
  }

  const pending = items.filter((i) => !i.status || i.status === 'pending' || i.status === 'proposed')

  return (
    <Card
      title={`Memory inbox${pending.length ? ` (${pending.length})` : ''}`}
      hint="Confirm applies org memory. It does not rewrite past Official minutes."
    >
      <TextField
        label="actor_label (optional)"
        value={actor}
        onChange={setActor}
        placeholder="operator@example.com"
      />
      {err && <div className="probe err">{err}</div>}
      {!err && !pending.length && <p className="desc">No pending suggestions.</p>}
      {!!pending.length && (
        <table className="data">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Alias</th>
              <th>Target</th>
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pending.map((item) => (
              <tr key={item.item_id}>
                <td>{item.kind ?? '—'}</td>
                <td>{item.alias ?? item.alias_norm ?? '—'}</td>
                <td>{targetLabel(item)}</td>
                <td>{item.status ?? 'pending'}</td>
                <td>{item.created_at ?? '—'}</td>
                <td>
                  <button
                    type="button"
                    className="btn sm"
                    disabled={busy}
                    onClick={() => void act(item.item_id, 'confirm')}
                  >
                    Confirm
                  </button>{' '}
                  <button
                    type="button"
                    className="btn danger sm"
                    disabled={busy}
                    onClick={() => void act(item.item_id, 'reject')}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
