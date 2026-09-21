import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { mi } from '../../api/mi/client'
import { Card, Empty } from '../../components/ui'
import { miErrorSentence } from '../../lib/miErrors'

export default function MiDashboard() {
  const [health, setHealth] = useState(null)
  const [profiles, setProfiles] = useState(null)
  const [meetings, setMeetings] = useState(null)
  const [down, setDown] = useState(null)
  const [listErr, setListErr] = useState(null)

  const load = () => {
    setDown(null)
    setListErr(null)
    mi.health()
      .then(setHealth)
      .catch((e) => {
        setHealth(null)
        setDown(miErrorSentence(e.code, e.message))
      })
    mi.listProfiles()
      .then((d) => setProfiles(d.profiles ?? []))
      .catch((e) => {
        setProfiles(null)
        setListErr(miErrorSentence(e.code, e.message))
      })
    mi.listMeetings()
      .then((d) => setMeetings(d.meetings ?? []))
      .catch(() => setMeetings(null))
  }

  useEffect(() => {
    load()
  }, [])

  const ok = health?.status === 'ok' || health?.status === 'up'

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
          <button className="btn secondary" onClick={load}>
            Refresh
          </button>
          <Link className="btn secondary" to="/MI/admin/profiles">
            New profile
          </Link>
          <Link className="btn" to="/MI/admin/meetings">
            New meeting
          </Link>
        </div>
      </div>

      {down && <div className="probe err">{down}</div>}

      <div className="stat-row" style={{ marginBottom: '1rem' }}>
        <div className="stat">
          <div className="n" style={{ color: down ? 'var(--err)' : ok ? 'var(--ok)' : 'var(--muted)' }}>
            {down ? 'Down' : health ? (ok ? 'Up' : health.status) : '…'}
          </div>
          <div className="l">MI API {health?.db != null ? `(db ${health.db ? 'up' : 'down'})` : ''}</div>
        </div>
        <div className="stat">
          <div className="n">{profiles ? profiles.length : '—'}</div>
          <div className="l">Profiles</div>
        </div>
        <div className="stat">
          <div className="n">{meetings ? meetings.length : '—'}</div>
          <div className="l">Meetings</div>
        </div>
      </div>

      <Card title="Status" hint="Live GET /mi/v1/health — not the Call Center catalog.">
        {!health && !down && <Empty>Checking Meeting Intelligence…</Empty>}
        {health && (
          <p className="lede" style={{ margin: 0 }}>
            {health.product === 'meeting_intelligence' ? 'Meeting Intelligence is reachable.' : health.status}{' '}
            {health.db === false ? 'The archive database did not respond.' : ''}
          </p>
        )}
        {listErr && <div className="probe warn">Profiles unavailable — {listErr}</div>}
      </Card>

      <Card title="Trust legend" hint="Wave 5 — do not blur these classes.">
        <ul className="desc" style={{ paddingLeft: 18, margin: 0 }}>
          <li>
            <strong>MoM</strong> — meeting truth. Edit the draft and approve to Official.
          </li>
          <li>
            <strong>Meeting Summary</strong> — skim of this meeting only. Advice surface; never Official;
            never Ask-indexed.
          </li>
          <li>
            <strong>AI Feedback</strong> — advice only. Never Official; never written into MoM; never
            Ask-indexed.
          </li>
          <li>
            <strong>Memory inbox</strong> — pending identity/terminology suggestions on a profile. Confirm
            or reject there (open a profile).
          </li>
        </ul>
      </Card>
    </div>
  )
}
