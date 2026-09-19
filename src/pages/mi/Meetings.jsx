import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { mi } from '../../api/mi/client'
import { Card, Empty, Field, Modal, TextField, useToast } from '../../components/ui'

function profileLabel(p) {
  return p.name ? `${p.name} (${p.id})` : p.id
}

export default function MiMeetings() {
  const toast = useToast()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const filter = params.get('profile_id') || ''
  const [rows, setRows] = useState([])
  const [profiles, setProfiles] = useState([])
  const [creating, setCreating] = useState(false)
  const [profileId, setProfileId] = useState(filter)
  const [extId, setExtId] = useState('')
  const [ns, setNs] = useState('lab')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    mi.listMeetings(filter || undefined)
      .then(async (d) => {
        const list = d.meetings ?? []
        setRows(list)
        setLoading(false)
        const enriched = await Promise.all(
          list.map(async (m) => {
            try {
              const f = await mi.getMeeting(m.id)
              return { ...m, job: f.job, draft: f.draft, official: f.official }
            } catch {
              return m
            }
          }),
        )
        setRows(enriched)
      })
      .catch((e) => {
        setLoading(false)
        toast.fail(e, 'List meetings')
      })
    mi.listProfiles()
      .then((d) => setProfiles(d.profiles ?? []))
      .catch(() => {})
  }
  useEffect(() => {
    load()
  }, [filter])

  const create = async () => {
    if (!profileId.trim() || !extId.trim() || !ns.trim()) {
      toast.push('err', 'profile, external_meeting_id, and participant_namespace are required')
      return
    }
    setBusy(true)
    try {
      const got = await mi.createMeeting({
        profile_id: profileId,
        external_meeting_id: extId.trim(),
        participant_namespace: ns.trim(),
        title: title.trim(),
      })
      toast.ok('Meeting created — profile snapshot pinned')
      setCreating(false)
      nav(`/MI/admin/meetings/${encodeURIComponent(got.id)}`)
    } catch (e) {
      toast.fail(e, 'Create meeting')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content">
      <div className="page-head has-actions">
        <div className="head-text">
          <h1>Meetings</h1>
          <p>
            Creating a meeting snapshots the Minutes desk. Later profile edits do not rewrite this
            meeting.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn secondary" onClick={load}>
            Reload
          </button>
          <button className="btn" onClick={() => setCreating(true)}>
            New meeting
          </button>
        </div>
      </div>
      <Card>
        <Field label="Filter by profile" desc="GET /mi/v1/meetings?profile_id=">
          <select
            value={filter}
            onChange={(e) => {
              const v = e.target.value
              if (v) setParams({ profile_id: v })
              else setParams({})
              setProfileId(v)
            }}
          >
            <option value="">All profiles</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {profileLabel(p)}
              </option>
            ))}
          </select>
        </Field>
        {loading && !rows.length && <Empty>Loading meetings…</Empty>}
        {!loading && !rows.length && <Empty>No meetings yet.</Empty>}
        {rows.map((m) => (
          <div className="card sub" key={m.id}>
            <Link to={`/MI/admin/meetings/${encodeURIComponent(m.id)}`}>
              <strong>{m.title || m.external_meeting_id || m.id}</strong>
            </Link>
            <div className="desc">
              {m.lifecycle} · {m.profile_id}
              {m.job?.state ? ` · job ${m.job.state}` : ''}
            </div>
            <div className="chips" style={{ marginTop: 6 }}>
              {m.draft?.ready ? <span className="chip on">draft</span> : null}
              {m.official?.official_version != null ? (
                <span className="chip on">official v{m.official.official_version}</span>
              ) : m.official?.id ? (
                <span className="chip on">official</span>
              ) : null}
              {m.current_draft_id && !m.draft?.ready ? <span className="chip">draft id</span> : null}
            </div>
          </div>
        ))}
      </Card>
      <Modal
        open={creating}
        title="New meeting"
        hint="This snapshots the chosen profile."
        onClose={() => setCreating(false)}
        onSubmit={create}
        submitLabel="Create"
        busy={busy}
      >
        <Field label="Profile">
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            <option value="">{profiles.length ? '— select —' : '— none available —'}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {profileLabel(p)}
              </option>
            ))}
          </select>
        </Field>
        <TextField label="external_meeting_id" value={extId} onChange={setExtId} mono />
        <TextField label="participant_namespace" value={ns} onChange={setNs} />
        <TextField label="title" value={title} onChange={setTitle} />
      </Modal>
    </div>
  )
}
