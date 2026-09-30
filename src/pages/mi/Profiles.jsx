import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { mi } from '../../api/mi/client'
import { Empty, Modal, SelectField, StringList, TextField, useToast } from '../../components/ui'
import { miErrorSentence } from '../../lib/miErrors'
import DeleteProfileDialog from './DeleteProfileDialog'

/**
 * The profile index.
 *
 * A desk is judged by what it is wired to do, so each card carries the facts
 * that decide that — languages, how many Minutes sections it will render, the
 * grounding switches, and how many meetings have actually been born from it.
 * A desk with no meetings is safe to delete; one with meetings is not, and the
 * card says which it is before the operator reaches for Delete.
 */

/** Starter Minutes templates. A blank desk renders no sections at all, which
 *  surprises people, so creating one offers a shape to start from. */
const TEMPLATES = {
  'Standard minutes': [
    { id: 'attendees', title: 'Attendees' },
    { id: 'agenda', title: 'Agenda' },
    { id: 'discussion', title: 'Discussion' },
    { id: 'decisions', title: 'Decisions' },
    { id: 'actions', title: 'Action items' },
    { id: 'next_steps', title: 'Next steps' },
  ],
  'Lean minutes': [
    { id: 'discussion', title: 'Discussion' },
    { id: 'decisions', title: 'Decisions' },
    { id: 'actions', title: 'Action items' },
  ],
  Blank: [],
}

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

function asObj(raw, fallback = {}) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw)
      return v && typeof v === 'object' ? v : fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

function truthy(v) {
  return v === true || v === 'true'
}

function when(iso) {
  const t = Date.parse(iso ?? '')
  if (!t) return ''
  return new Date(t).toLocaleDateString()
}

export default function MiProfiles() {
  const toast = useToast()
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [counts, setCounts] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('updated')

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [id, setId] = useState('')
  const [langs, setLangs] = useState(['en-IN'])
  const [template, setTemplate] = useState('Standard minutes')
  const [busy, setBusy] = useState(false)

  const [deleting, setDeleting] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    mi.listProfiles()
      .then((d) => {
        setRows(d.profiles ?? [])
        setErr(null)
      })
      .catch((e) => setErr(miErrorSentence(e.code, e.message)))
      .finally(() => setLoading(false))
    // One extra call answers "is this desk in use", which is what decides
    // whether it can be deleted and whether it is worth configuring.
    mi.listMeetings()
      .then((d) => {
        const map = new Map()
        for (const m of d.meetings ?? []) map.set(m.profile_id, (map.get(m.profile_id) ?? 0) + 1)
        setCounts(map)
      })
      .catch(() => setCounts(null))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = rows
      .map((p) => {
        const rules = asObj(p.rules)
        return {
          ...p,
          langs: langsOf(p),
          sections: (asObj(p.mom_template).sections ?? []).length,
          kbOn: truthy(asObj(rules.kb).enabled),
          normOn: truthy(asObj(rules.normalize).enabled),
          summaryOn: truthy(asObj(rules.insights).summary),
          feedbackOn: truthy(asObj(rules.insights).feedback),
          meetings: counts?.get(p.id) ?? (counts ? 0 : null),
        }
      })
      .filter(
        (p) =>
          !needle ||
          (p.name ?? '').toLowerCase().includes(needle) ||
          p.id.toLowerCase().includes(needle) ||
          p.langs.some((l) => l.toLowerCase().includes(needle)),
      )
    const cmp = {
      updated: (a, b) => Date.parse(b.updated_at ?? '') - Date.parse(a.updated_at ?? '') || 0,
      name: (a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id),
      meetings: (a, b) => (b.meetings ?? 0) - (a.meetings ?? 0),
    }
    return [...list].sort(cmp[sort] ?? cmp.updated)
  }, [rows, counts, q, sort])

  const openCreate = () => {
    setName('')
    setId('')
    setLangs(['en-IN'])
    setTemplate('Standard minutes')
    setCreating(true)
  }

  const create = async () => {
    if (!name.trim()) {
      toast.push('err', 'Name required')
      return
    }
    setBusy(true)
    try {
      const body = {
        name: name.trim(),
        languages: langs.length ? langs : ['en-IN'],
        mom_template: { sections: TEMPLATES[template] ?? [] },
        rules: { case_b: { min_segments: 1 } },
      }
      if (id.trim()) body.id = id.trim()
      const got = await mi.createProfile(body)
      toast.ok(`Created ${got.name || got.id}`)
      setCreating(false)
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
          <button className="btn secondary" onClick={load} disabled={loading}>
            {loading ? 'Reloading…' : 'Reload'}
          </button>
          <button className="btn" onClick={openCreate}>
            New profile
          </button>
        </div>
      </div>

      {err && <div className="probe err">{err}</div>}

      <div className="mi-toolbar">
        <input
          type="search"
          placeholder="Search name, id or language…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search profiles"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort profiles">
          <option value="updated">Recently updated</option>
          <option value="name">Name</option>
          <option value="meetings">Most meetings</option>
        </select>
        <span className="spacer" />
        <span className="desc">
          {shown.length} of {rows.length} profile{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading && !rows.length && <Empty>Loading profiles…</Empty>}
      {!loading && !rows.length && (
        <Empty>No Minutes profiles yet. Create one to start taking meetings.</Empty>
      )}
      {!!rows.length && !shown.length && <Empty>No profile matches “{q}”.</Empty>}

      <div className="mi-card-grid">
        {shown.map((p) => (
          <div className="mi-profile-card" key={p.id}>
            <div className="mi-profile-head">
              <Link
                className="mi-profile-name"
                to={`/MI/admin/profiles/${encodeURIComponent(p.id)}`}
              >
                {p.name || p.id}
              </Link>
            </div>
            <div className="mi-profile-id" title={p.id}>
              {p.id}
            </div>

            <div className="chips">
              {p.langs.map((l) => (
                <span className="chip on" key={l}>
                  {l}
                </span>
              ))}
              {!p.langs.length && <span className="desc">no languages set</span>}
            </div>

            <div className="mi-row-badges" style={{ flexWrap: 'wrap' }}>
              <span className="badge">
                {p.sections} section{p.sections === 1 ? '' : 's'}
              </span>
              {p.kbOn && <span className="badge ok">KB</span>}
              {p.normOn && <span className="badge ok">terms</span>}
              {p.summaryOn && <span className="badge">summary</span>}
              {p.feedbackOn && <span className="badge">feedback</span>}
            </div>

            <div className="mi-profile-foot">
              <span className="desc" style={{ margin: 0, flex: 1 }}>
                {p.meetings == null
                  ? '—'
                  : `${p.meetings} meeting${p.meetings === 1 ? '' : 's'}`}
                {p.updated_at ? ` · updated ${when(p.updated_at)}` : ''}
              </span>
              <Link
                className="btn secondary sm"
                to={`/MI/admin/profiles/${encodeURIComponent(p.id)}`}
              >
                Configure
              </Link>
              <button
                type="button"
                className="btn danger sm"
                onClick={() => setDeleting(p)}
                disabled={!!p.meetings}
                title={
                  p.meetings
                    ? 'This profile has meetings that pin it and cannot be deleted'
                    : 'Delete this profile'
                }
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {creating && (
        <CreateProfileModal
          name={name}
          setName={setName}
          id={id}
          setId={setId}
          langs={langs}
          setLangs={setLangs}
          template={template}
          setTemplate={setTemplate}
          busy={busy}
          onClose={() => setCreating(false)}
          onSubmit={create}
        />
      )}

      <DeleteProfileDialog
        open={!!deleting}
        profile={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={load}
      />
    </div>
  )
}

/** Split out so the create form can grow without the list re-rendering it. */
function CreateProfileModal({
  name,
  setName,
  id,
  setId,
  langs,
  setLangs,
  template,
  setTemplate,
  busy,
  onClose,
  onSubmit,
}) {
  const sections = TEMPLATES[template] ?? []
  return (
    <Modal
      open
      title="New MI profile"
      hint="Everything here is editable afterwards — this only sets the desk up."
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Create"
      busy={busy}
    >
      <TextField label="Name" value={name} onChange={setName} autoFocus />
      <StringList
        label="Languages"
        values={langs}
        onChange={setLangs}
        placeholder="en-IN"
        desc="Spoken languages this desk transcribes and writes Minutes in."
      />
      <SelectField
        label="Starter Minutes template"
        value={template}
        onChange={setTemplate}
        options={Object.keys(TEMPLATES)}
        allowEmpty={false}
        desc={
          sections.length
            ? `Creates ${sections.length} sections: ${sections.map((s) => s.title).join(', ')}.`
            : 'No sections — the draft will render whatever the pipeline produces.'
        }
      />
      <TextField
        label="Id (optional)"
        value={id}
        onChange={setId}
        mono
        desc="Leave blank so the server assigns a UUID. Typed ids must be UUIDs."
      />
    </Modal>
  )
}
