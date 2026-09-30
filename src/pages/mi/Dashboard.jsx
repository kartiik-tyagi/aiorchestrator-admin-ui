import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { mi } from '../../api/mi/client'
import { Card, Empty, Spinner } from '../../components/ui'
import { miErrorSentence } from '../../lib/miErrors'

/**
 * Meeting Intelligence home.
 *
 * This is the first screen an operator opens, and the question they open it
 * with is almost never "how many meetings are there" — it is "is anything
 * stuck, and does anything need me?". So the page leads with counts that are
 * each a link to the work they represent, then ranks what needs a human, and
 * only then lists recent activity.
 *
 * The list endpoints alone cannot answer that: GET /mi/v1/meetings returns
 * lifecycle but not job state, draft readiness or approval. So the page fans
 * out GET /mi/v1/meetings/{id} the way the Meetings list already does. That is
 * N+1 by design — the archive is per-deployment and small — and it is bounded
 * and refreshed only on demand, never polled.
 */

const FANOUT = 6

/** Resolve tasks a few at a time so a large archive does not open 200 sockets. */
async function pooled(items, worker, limit = FANOUT) {
  const out = new Array(items.length)
  let next = 0
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      out[i] = await worker(items[i], i)
    }
  })
  await Promise.all(runners)
  return out
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

/** Newest first; meetings without a timestamp sort last rather than first. */
function byNewest(a, b) {
  const at = Date.parse(a.created_at ?? '') || 0
  const bt = Date.parse(b.created_at ?? '') || 0
  return bt - at
}

function shortId(id) {
  return typeof id === 'string' && id.length > 12 ? `${id.slice(0, 8)}…` : (id ?? '')
}

function meetingLabel(m) {
  return m.title || m.external_meeting_id || shortId(m.id)
}

/** Relative age, because "3h ago" answers "is this stuck" and a timestamp does not. */
function ago(iso) {
  const t = Date.parse(iso ?? '')
  if (!t) return ''
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function Kpi({ n, label, sub, tone, to }) {
  const body = (
    <>
      <div className="n">{n}</div>
      <div className="l">{label}</div>
      {sub && <div className="sub">{sub}</div>}
    </>
  )
  if (to) {
    return (
      <Link className={`mi-kpi ${tone ?? ''}`} to={to}>
        {body}
      </Link>
    )
  }
  return <div className={`mi-kpi ${tone ?? ''}`}>{body}</div>
}

function Meter({ label, n, total, tone }) {
  const pct = total > 0 ? Math.round((n / total) * 100) : 0
  return (
    <div className="mi-meter">
      <span className="mi-meter-label">{label}</span>
      <span className="mi-meter-track">
        <span
          className={`mi-meter-fill ${tone ?? ''}`}
          style={{ width: `${pct}%` }}
          role="presentation"
        />
      </span>
      <span className="mi-meter-n">{n}</span>
    </div>
  )
}

const LIFECYCLE_TONE = {
  created: 'idle',
  capturing: 'warn',
  ended: 'ok',
  cancelled: 'err',
}

const JOB_TONE = {
  idle: 'idle',
  queued: 'warn',
  running: 'warn',
  succeeded: 'ok',
  failed: 'err',
}

export default function MiDashboard() {
  const [health, setHealth] = useState(null)
  const [profiles, setProfiles] = useState(null)
  const [meetings, setMeetings] = useState(null)
  const [down, setDown] = useState(null)
  const [listErr, setListErr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailed, setDetailed] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setDown(null)
    setListErr(null)
    setDetailed(false)

    const healthP = mi
      .health()
      .then((h) => {
        setHealth(h)
        return h
      })
      .catch((e) => {
        setHealth(null)
        setDown(miErrorSentence(e.code, e.message))
        return null
      })

    const profilesP = mi
      .listProfiles()
      .then((d) => {
        setProfiles(d.profiles ?? [])
      })
      .catch((e) => {
        setProfiles(null)
        setListErr(miErrorSentence(e.code, e.message))
      })

    const meetingsP = mi
      .listMeetings()
      .then(async (d) => {
        const list = d.meetings ?? []
        setMeetings(list)
        setLoading(false)
        // Second pass: the facets the list endpoint does not carry. A meeting
        // whose detail fails keeps its list row rather than vanishing.
        const full = await pooled(list, async (m) => {
          try {
            return { ...m, ...(await mi.getMeeting(m.id)) }
          } catch {
            return m
          }
        })
        setMeetings(full)
        setDetailed(true)
      })
      .catch(() => {
        setMeetings(null)
        setLoading(false)
      })

    await Promise.all([healthP, profilesP, meetingsP])
    setLoading(false)
    setRefreshedAt(new Date())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const rows = meetings ?? []
    const lifecycle = { created: 0, capturing: 0, ended: 0, cancelled: 0 }
    const jobs = { idle: 0, queued: 0, running: 0, succeeded: 0, failed: 0 }
    const attention = []
    let drafts = 0
    let official = 0
    let awaiting = 0

    for (const m of rows) {
      const lc = m.lifecycle ?? 'created'
      if (lifecycle[lc] == null) lifecycle[lc] = 0
      lifecycle[lc] += 1

      const js = m.job?.state ?? 'idle'
      if (jobs[js] == null) jobs[js] = 0
      jobs[js] += 1

      const hasDraft = !!m.draft?.ready
      const hasOfficial = m.official?.id != null || m.official?.official_version != null
      if (hasDraft) drafts += 1
      if (hasOfficial) official += 1
      if (hasDraft && !hasOfficial) {
        awaiting += 1
        attention.push({
          key: `approve-${m.id}`,
          tone: 'info',
          title: meetingLabel(m),
          why: 'Minutes drafted and waiting for approval to Official.',
          badge: 'approve',
          to: `/MI/admin/meetings/${encodeURIComponent(m.id)}`,
        })
      }
      if (js === 'failed') {
        attention.push({
          key: `job-${m.id}`,
          tone: 'err',
          title: meetingLabel(m),
          why: `Intelligence job failed${m.job?.error_code ? ` — ${m.job.error_code}` : ''}.`,
          badge: 'failed',
          to: `/MI/admin/meetings/${encodeURIComponent(m.id)}`,
        })
      }
      if (lc === 'ended' && !hasDraft && js !== 'running' && js !== 'queued' && js !== 'failed') {
        attention.push({
          key: `nodraft-${m.id}`,
          tone: 'warn',
          title: meetingLabel(m),
          why: 'Meeting ended but no Minutes draft exists. Regenerate from the sealed transcript.',
          badge: 'no draft',
          to: `/MI/admin/meetings/${encodeURIComponent(m.id)}`,
        })
      }
      if (m.insights?.stale) {
        attention.push({
          key: `stale-${m.id}`,
          tone: 'warn',
          title: meetingLabel(m),
          why: 'Meeting Summary / AI Feedback are older than the current draft.',
          badge: 'stale',
          to: `/MI/admin/meetings/${encodeURIComponent(m.id)}`,
        })
      }
      if (m.partial_capture) {
        attention.push({
          key: `partial-${m.id}`,
          tone: 'warn',
          title: meetingLabel(m),
          why: 'Capture was partial — the transcript has a known gap.',
          badge: 'partial',
          to: `/MI/admin/meetings/${encodeURIComponent(m.id)}`,
        })
      }
    }

    // Failures first, then warnings, then the approval queue.
    const rank = { err: 0, warn: 1, info: 2 }
    attention.sort((a, b) => rank[a.tone] - rank[b.tone])

    return { lifecycle, jobs, drafts, official, awaiting, attention, total: rows.length }
  }, [meetings])

  /** Meetings per profile, so an unused desk is visible at a glance. */
  const profileRows = useMemo(() => {
    if (!profiles) return []
    const counts = new Map()
    for (const m of meetings ?? []) {
      counts.set(m.profile_id, (counts.get(m.profile_id) ?? 0) + 1)
    }
    return profiles
      .map((p) => {
        const rules = asObj(p.rules)
        const kb = asObj(rules.kb)
        const norm = asObj(rules.normalize)
        const insights = asObj(rules.insights)
        return {
          ...p,
          meetings: counts.get(p.id) ?? 0,
          kbOn: truthy(kb.enabled),
          normOn: truthy(norm.enabled),
          summaryOn: truthy(insights.summary),
          feedbackOn: truthy(insights.feedback),
        }
      })
      .sort((a, b) => b.meetings - a.meetings)
  }, [profiles, meetings])

  const ok = health?.status === 'ok' || health?.status === 'up'
  const recent = useMemo(() => [...(meetings ?? [])].sort(byNewest).slice(0, 8), [meetings])

  return (
    <div className="content">
      <div className="page-head has-actions">
        <div className="head-text">
          <h1>Meeting Intelligence</h1>
          <p>
            Minutes of Meeting, the official archive, and Ask. This product does not configure Call
            Center engines, flows, or pins.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn secondary" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link className="btn secondary" to="/MI/admin/profiles">
            Profiles
          </Link>
          <Link className="btn" to="/MI/admin/meetings">
            Meetings
          </Link>
        </div>
      </div>

      {down && <div className="probe err">{down}</div>}
      {listErr && <div className="probe warn">Profiles unavailable — {listErr}</div>}

      <div className="mi-kpis">
        <Kpi
          n={down ? 'Down' : health ? (ok ? 'Up' : health.status) : '…'}
          label="MI API"
          sub={
            health?.db != null
              ? health.db
                ? 'archive database responding'
                : 'archive database did not respond'
              : 'GET /mi/v1/health'
          }
          tone={down || health?.db === false ? 'err' : ok ? 'ok' : undefined}
        />
        <Kpi
          n={profiles ? profiles.length : '—'}
          label="Profiles"
          sub="Minutes desks"
          tone="accent"
          to="/MI/admin/profiles"
        />
        <Kpi
          n={meetings ? meetings.length : '—'}
          label="Meetings"
          sub={
            stats.lifecycle.capturing
              ? `${stats.lifecycle.capturing} capturing now`
              : 'across all profiles'
          }
          tone={stats.lifecycle.capturing ? 'warn' : undefined}
          to="/MI/admin/meetings"
        />
        <Kpi
          n={detailed ? stats.awaiting : '…'}
          label="Awaiting approval"
          sub="draft ready, not yet Official"
          tone={stats.awaiting ? 'accent' : undefined}
          to="/MI/admin/meetings"
        />
        <Kpi
          n={detailed ? stats.official : '…'}
          label="Approved"
          sub="meetings with an Official version"
          tone={stats.official ? 'ok' : undefined}
        />
        <Kpi
          n={detailed ? stats.jobs.failed : '…'}
          label="Failed jobs"
          sub={stats.jobs.failed ? 'needs a human' : 'nothing failing'}
          tone={stats.jobs.failed ? 'err' : 'ok'}
        />
      </div>

      <Card
        title="Needs attention"
        hint="Ranked: failed jobs, then quality warnings, then the approval queue."
        actions={
          !detailed && !loading ? <span className="desc">Reading meeting detail…</span> : null
        }
      >
        {loading && !meetings && <Empty>Loading Meeting Intelligence…</Empty>}
        {!loading && !detailed && (
          <p className="desc">
            <Spinner /> Reading each meeting for job state, drafts and approvals…
          </p>
        )}
        {detailed && !stats.attention.length && (
          <Empty>Nothing is waiting. No failed jobs, stale insights, or unapproved drafts.</Empty>
        )}
        {!!stats.attention.length && (
          <div className="mi-attn">
            {stats.attention.slice(0, 8).map((a) => (
              <div className={`mi-attn-row ${a.tone}`} key={a.key}>
                <div className="mi-attn-main">
                  <div className="mi-attn-title">
                    <Link to={a.to}>{a.title}</Link>
                  </div>
                  <div className="mi-attn-why">{a.why}</div>
                </div>
                <span className={`badge ${a.tone === 'info' ? '' : a.tone}`}>{a.badge}</span>
              </div>
            ))}
            {stats.attention.length > 8 && (
              <p className="desc">
                {stats.attention.length - 8} more —{' '}
                <Link to="/MI/admin/meetings">open Meetings</Link>.
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="mi-split">
        <Card title="Meeting lifecycle" hint="Where the archive currently sits.">
          {!stats.total && <Empty>No meetings yet.</Empty>}
          {!!stats.total && (
            <div className="mi-meters">
              {['created', 'capturing', 'ended', 'cancelled'].map((k) => (
                <Meter
                  key={k}
                  label={k}
                  n={stats.lifecycle[k] ?? 0}
                  total={stats.total}
                  tone={LIFECYCLE_TONE[k]}
                />
              ))}
            </div>
          )}
        </Card>

        <Card title="Intelligence jobs" hint="Latest job per meeting, not a job history.">
          {!detailed && <Empty>Reading job state…</Empty>}
          {detailed && !stats.total && <Empty>No meetings yet.</Empty>}
          {detailed && !!stats.total && (
            <div className="mi-meters">
              {['idle', 'queued', 'running', 'succeeded', 'failed'].map((k) => (
                <Meter
                  key={k}
                  label={k}
                  n={stats.jobs[k] ?? 0}
                  total={stats.total}
                  tone={JOB_TONE[k]}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Recent meetings"
        hint="Newest first."
        actions={
          <Link className="btn secondary sm" to="/MI/admin/meetings">
            All meetings
          </Link>
        }
      >
        {!recent.length && <Empty>No meetings yet.</Empty>}
        <div className="mi-rows">
          {recent.map((m) => {
            const hasOfficial = m.official?.id != null || m.official?.official_version != null
            return (
              <div className="mi-row" key={m.id}>
                <div className="mi-row-main">
                  <div className="mi-row-title">
                    <Link to={`/MI/admin/meetings/${encodeURIComponent(m.id)}`}>
                      {meetingLabel(m)}
                    </Link>
                  </div>
                  <div className="mi-row-sub">
                    {m.lifecycle}
                    {m.created_at ? ` · ${ago(m.created_at)}` : ''} · {shortId(m.profile_id)}
                  </div>
                </div>
                <div className="mi-row-badges">
                  {m.job?.state && m.job.state !== 'idle' && (
                    <span className={`badge ${JOB_TONE[m.job.state] === 'err' ? 'err' : ''}`}>
                      {m.job.state}
                    </span>
                  )}
                  {m.draft?.ready && !hasOfficial && <span className="badge">draft</span>}
                  {hasOfficial && (
                    <span className="badge ok">
                      official{m.official.official_version ? ` v${m.official.official_version}` : ''}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card
        title="Profiles at a glance"
        hint="Meeting count and the grounding switches each desk is running with."
        actions={
          <Link className="btn secondary sm" to="/MI/admin/profiles">
            Manage profiles
          </Link>
        }
      >
        {!profileRows.length && <Empty>No Minutes profiles yet.</Empty>}
        <div className="mi-rows">
          {profileRows.slice(0, 8).map((p) => (
            <div className="mi-row" key={p.id}>
              <div className="mi-row-main">
                <div className="mi-row-title">
                  <Link to={`/MI/admin/profiles/${encodeURIComponent(p.id)}`}>
                    {p.name || p.id}
                  </Link>
                </div>
                <div className="mi-row-sub">
                  {p.meetings} meeting{p.meetings === 1 ? '' : 's'} · {shortId(p.id)}
                </div>
              </div>
              <div className="mi-row-badges">
                {p.kbOn && <span className="badge ok">KB</span>}
                {p.normOn && <span className="badge ok">terms</span>}
                {p.summaryOn && <span className="badge">summary</span>}
                {p.feedbackOn && <span className="badge">feedback</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Trust legend" hint="Wave 5 — do not blur these classes.">
        <ul className="desc" style={{ paddingLeft: 18, margin: 0 }}>
          <li>
            <strong>MoM</strong> — meeting truth. Edit the draft and approve to Official.
          </li>
          <li>
            <strong>Meeting Summary</strong> — skim of this meeting only. Advice surface; never
            Official; never Ask-indexed.
          </li>
          <li>
            <strong>AI Feedback</strong> — advice only. Never Official; never written into MoM;
            never Ask-indexed.
          </li>
          <li>
            <strong>Memory inbox</strong> — pending identity/terminology suggestions on a profile.
            Confirm or reject there (open a profile).
          </li>
        </ul>
        {refreshedAt && (
          <p className="desc" style={{ marginBottom: 0 }}>
            Read at {refreshedAt.toLocaleTimeString()} — this page never polls; press Refresh.
          </p>
        )}
      </Card>
    </div>
  )
}
