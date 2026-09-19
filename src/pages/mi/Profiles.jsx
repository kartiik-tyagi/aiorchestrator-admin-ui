import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { mi } from '../../api/mi/client'
import { Card, Empty, Modal, TextField, useToast } from '../../components/ui'
import { miErrorSentence } from '../../lib/miErrors'

function langsOf(p) {
  const raw = p.languages
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw)
      return Array.isArray(v) ? v : []
    } catch {
      return raw ? [raw] : []
    }
  }
  return []
}

export default function MiProfiles() {
  const toast = useToast()
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [err, setErr] = useState(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [id, setId] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    mi.listProfiles()
      .then((d) => {
        setRows(d.profiles ?? [])
        setErr(null)
      })
      .catch((e) => setErr(miErrorSentence(e.code, e.message)))
  }
  useEffect(() => {
    load()
  }, [])

  const create = async () => {
    if (!name.trim()) {
      toast.push('err', 'Name required')
      return
    }
    setBusy(true)
    try {
      const body = {
        name: name.trim(),
        languages: ['en-IN'],
        mom_template: { sections: [] },
        rules: { case_b: { min_segments: 1 } },
      }
      if (id.trim()) body.id = id.trim()
      const got = await mi.createProfile(body)
      toast.ok(`Created ${got.id || got.name}`)
      setCreating(false)
      setName('')
      setId('')
      nav(`/MI/admin/profiles/${encodeURIComponent(got.id)}`)
    } catch (e) {
      toast.fail(e, 'Create profile')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content">
      <div className="page-head has-actions">
        <div className="head-text">
          <h1>MI profiles</h1>
          <p>
            The meeting desk — languages, Minutes sections, rules, memory, retention. Updates apply
            to <strong>new</strong> meetings. Meetings already created keep the snapshot they were
            born with.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn secondary" onClick={load}>
            Reload
          </button>
          <button className="btn" onClick={() => setCreating(true)}>
            New profile
          </button>
        </div>
      </div>
      {err && <div className="probe err">{err}</div>}
      <Card>
        {!rows.length && <Empty>No Minutes profiles yet.</Empty>}
        {rows.map((p) => (
          <div className="card sub" key={p.id}>
            <Link to={`/MI/admin/profiles/${encodeURIComponent(p.id)}`}>
              <strong>{p.name || p.id}</strong>
            </Link>
            <div className="desc">
              <code>{p.id}</code>
              {langsOf(p).length ? ` · ${langsOf(p).join(', ')}` : ''}
              {p.updated_at ? ` · ${p.updated_at}` : ''}
            </div>
          </div>
        ))}
      </Card>
      <Modal
        open={creating}
        title="New MI profile"
        onClose={() => setCreating(false)}
        onSubmit={create}
        submitLabel="Create"
        busy={busy}
      >
        <TextField label="Name" value={name} onChange={setName} />
        <TextField
          label="Id (optional)"
          value={id}
          onChange={setId}
          mono
          desc="Leave blank so the server assigns a UUID. Typed ids must be UUIDs."
        />
      </Modal>
    </div>
  )
}
