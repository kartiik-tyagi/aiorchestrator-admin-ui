import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { mi } from '../../api/mi/client'
import { Empty, Field, Modal, TextField, useToast } from '../../components/ui'

/**
 * The meeting index.
 *
 * Operators come here to find one meeting among many, and the thing that
 * distinguishes them is not the name — it is where each one has got to: is the
 * job done, is there a draft, has anyone approved it. The list endpoint carries
 * none of that, so each row is enriched from GET /meetings/{id}, the same
 * bounded fan-out the dashboard uses, and the result is filterable by exactly
 * those states.
 */

const FANOUT = 6

async function pooled(items, worker, limit = FANOUT) {
  const out = new Array(items.length)
  let next = 0
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      out[i] = await worker(items[i])
    }
  })
  await Promise.all(runners)
  return out
}

const LIFECYCLE_TONE = {
  created: '',
  capturing: 'warn',
  ended: 'ok',
  cancelled: 'err',
}

const JOB_TONE = {
  queued: 'warn',
  running: 'warn',
  succeeded: 'ok',
  failed: 'err',
}

/** What stage a meeting is at, as one word an operator can filter on. */
function stageOf(m) {
  if (m.lifecycle === 'cancelled') return 'cancelled'
  if (m.official?.id != null || m.official?.official_version != null) return 'approved'
  if (m.job?.state === 'failed') return 'failed'
  if (m.draft?.ready) return 'awaiting approval'
  if (m.job?.state === 'running' || m.job?.state === 'queued') return 'drafting'
  if (m.lifecycle === 'capturing') return 'capturing'
  return 'no draft'
}

const STAGE_TONE = {
  approved: 'ok',
  failed: 'err',
  'awaiting approval': '',
  drafting: 'warn',
  capturing: 'warn',
  cancelled: 'err',
  'no draft': 'warn',
}

function profileLabel(p) {
  return p.name ? `${p.name} (${p.id})` : p.id
}

function ago(iso) {
  const t = Date.parse(iso ?? '')
  if (!t) return ''
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function MiMeetings() {
  const toast = useToast()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const filter = params.get('profile_id') || ''
  const [rows, setRows] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailed, setDetailed] = useState(false)

  const [q, setQ] = useState('')
  const [stage, setStage] = useState('')
  const [sort, setSort] = useState('newest')

  const [creating, setCreating] = useState(false)
  const [profileId, setProfileId] = useState(filter)
  const [extId, setExtId] = useState('')
  const [ns, setNs] = useState('lab')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setDetailed(false)
    mi.listMeetings(filter || undefined)
      .then(async (d) => {
        const list = d.meetings ?? []
        setRows(list)
        setLoading(false)
        const full = await pooled(list, async (m) => {
          try {
            return { ...m, ...(await mi.getMeeting(m.id)) }
          } catch {
            return m
          }
        })
        setRows(full)
        setDetailed(true)
      })
      .catch((e) => {
        setLoading(false)
        toast.fail(e, 'List meetings')
      })
    mi.listProfiles()
      .then((d) => setProfiles(d.profiles ?? []))
      .catch(() => {})
    // toast is stable from context; re-running on it would refetch on every toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  /** Namespaces already in use, offered as a datalist rather than a fixed list:
   *  the field is free text server-side and a select would refuse a valid one. */
  const knownNamespaces = useMemo(
    () => [...new Set(rows.map((m) => m.participant_namespace).filter(Boolean))].sort(),
    [rows],
  )

  const profileName = useMemo(() => {
    const m = new Map()
    for (const p of profiles) m.set(p.id, p.name || p.id)
    return m
  }, [profiles])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = rows
      .map((m) => ({ ...m, stage: stageOf(m) }))
      .filter((m) => !stage || m.stage === stage)
      .filter(
        (m) =>
          !needle ||
          (m.title ?? '').toLowerCase().includes(needle) ||
          (m.external_meeting_id ?? '').toLowerCase().includes(needle) ||
          m.id.toLowerCase().includes(needle),
      )
    const cmp = {
      newest: (a, b) => (Date.parse(b.created_at ?? '') || 0) - (Date.parse(a.created_at ?? '') || 0),
      oldest: (a, b) => (Date.parse(a.created_at ?? '') || 0) - (Date.parse(b.created_at ?? '') || 0),
      title: (a, b) =>
        (a.title || a.external_meeting_id || a.id).localeCompare(b.title || b.external_meeting_id || b.id),
    }
    return [...list].sort(cmp[sort] ?? cmp.newest)
  }, [rows, q, stage, sort])

  /** Counts per stage, so the filter says how much is behind each option. */
  const stageCounts = useMemo(() => {
    const c = new Map()
    for (const m of rows) {
      const s = stageOf(m)
      c.set(s, (c.get(s) ?? 0) + 1)
    }
    return c
  }, [rows])

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
      toast.ok('Meeting created — profile snapshot stored')
      setCreating(false)
      nav(`/MI/admin/meetings/${encodeURIComponent(got.id)}`)
    } catch (e) {
      toast.fail(e, 'Create meeting')
    } finally {
      setBusy(false)
    }
  }

  const openCreate = () => {
    setProfileId(filter || '')
    setExtId('')
    setNs('lab')
    setTitle('')
    setCreating(true)
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
          <button className="btn secondary" onClick={load} disabled={loading}>
            {loading ? 'Reloading…' : 'Reload'}
          </button>
          <button className="btn" onClick={openCreate}>
            New meeting
          </button>
        </div>
      </div>

      <div className="mi-toolbar">
        <input
          type="search"
          placeholder="Search title, external id…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search meetings"
        />
        <select
          value={filter}
          onChange={(e) => {
            const v = e.target.value
            setParams(v ? { profile_id: v } : {})
          }}
          aria-label="Filter by profile"
        >
          <option value="">All profiles</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {profileLabel(p)}
            </option>
          ))}
        </select>
        <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter by stage">
          <option value="">Any stage</option>
          {['capturing', 'no draft', 'drafting', 'failed', 'awaiting approval', 'approved', 'cancelled'].map(
            (s) => (
              <option key={s} value={s}>
                {s}
                {stageCounts.get(s) ? ` (${stageCounts.get(s)})` : ''}
              </option>
            ),
          )}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort meetings">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title</option>
        </select>
        <span className="spacer" />
        <span className="desc">
          {shown.length} of {rows.length}
          {!detailed && rows.length ? ' · reading detail…' : ''}
        </span>
      </div>

      {loading && !rows.length && <Empty>Loading meetings…</Empty>}
      {!loading && !rows.length && (
        <Empty>
          No meetings yet{filter ? ' for this profile' : ''}. Create one to start taking minutes.
        </Empty>
      )}
      {!!rows.length && !shown.length && <Empty>No meeting matches those filters.</Empty>}

      <div className="mi-card-grid">
        {shown.map((m) => (
          <div className="mi-profile-card" key={m.id}>
            <div className="mi-profile-head">
              <Link className="mi-profile-name" to={`/MI/admin/meetings/${encodeURIComponent(m.id)}`}>
                {m.title || m.external_meeting_id || m.id}
              </Link>
            </div>
            <div className="mi-profile-id" title={m.external_meeting_id}>
              {m.external_meeting_id}
            </div>

            <div className="mi-row-badges" style={{ flexWrap: 'wrap' }}>
              <span className={`badge ${STAGE_TONE[m.stage] ?? ''}`}>{m.stage}</span>
              <span className={`badge ${LIFECYCLE_TONE[m.lifecycle] ?? ''}`}>{m.lifecycle}</span>
              {m.job?.state && m.job.state !== 'idle' && (
                <span className={`badge ${JOB_TONE[m.job.state] ?? ''}`}>job {m.job.state}</span>
              )}
              {m.official?.official_version != null && (
                <span className="badge ok">official v{m.official.official_version}</span>
              )}
              {m.insights?.stale && <span className="badge warn">insights stale</span>}
              {m.partial_capture && <span className="badge warn">partial</span>}
            </div>

            <div className="mi-profile-foot">
              <span className="desc" style={{ margin: 0, flex: 1 }}>
                {profileName.get(m.profile_id) ?? m.profile_id}
                {m.created_at ? ` · ${ago(m.created_at)}` : ''}
              </span>
              <Link className="btn secondary sm" to={`/MI/admin/meetings/${encodeURIComponent(m.id)}`}>
                Open
              </Link>
              {m.draft?.ready && (
                <Link
                  className="btn sm"
                  to={`/MI/admin/meetings/${encodeURIComponent(m.id)}?tab=mom`}
                >
                  MoM
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={creating}
        title="New meeting"
        hint="This snapshots the chosen profile. The snapshot is what drafts the minutes, not the profile as it looks later."
        onClose={() => setCreating(false)}
        onSubmit={create}
        submitLabel="Create"
        busy={busy}
      >
        <Field label="Profile" desc="The Minutes desk this meeting is pinned to.">
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            <option value="">{profiles.length ? '— select —' : '— none available —'}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {profileLabel(p)}
              </option>
            ))}
          </select>
        </Field>
        <TextField
          label="external_meeting_id"
          value={extId}
          onChange={setExtId}
          mono
          desc="Your own id for this meeting — what the calling system calls it."
        />
        <TextField
          label="participant_namespace"
          value={ns}
          onChange={setNs}
          mono
          suggestions={knownNamespaces}
          desc="The key space speaker identities are resolved in. It must match how the transcript is pushed — free text, with the namespaces already in use offered."
        />
        <TextField label="title" value={title} onChange={setTitle} desc="Shown across the console." />
      </Modal>
    </div>
  )
}
