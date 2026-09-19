import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { mi } from '../../api/mi/client'
import { Card, TextField, useToast } from '../../components/ui'
import { miErrorSentence } from '../../lib/miErrors'
import { jobTerminal, legalActions } from '../../lib/miLifecycle'
import DraftEditor from './DraftEditor'
import ApproveWizard from './ApproveWizard'
import OfficialPane from './OfficialPane'
import AskPane from './AskPane'

const CASE_B_FIXTURE = `{
  "provider_id": "coral",
  "content_revision": "r1",
  "segments": [
    { "user_id": "u1", "display_name": "Alice", "text": "hello", "t_start_ms": 0 },
    { "user_id": "u2", "display_name": "Bob", "text": "world", "t_start_ms": 100 }
  ]
}`

const INGEST_KEY = 'orch_mi_ingest_token'

export default function MiMeetingDetail() {
  const { id = '' } = useParams()
  const toast = useToast()
  const [facet, setFacet] = useState(null)
  const [err, setErr] = useState(null)
  const [tab, setTab] = useState('overview')
  const [body, setBody] = useState(CASE_B_FIXTURE)
  const [idem, setIdem] = useState(() => crypto.randomUUID())
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(INGEST_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [decision, setDecision] = useState(null)
  const [transcript, setTranscript] = useState(null)
  const [genPick, setGenPick] = useState('')
  const [draft, setDraft] = useState(null)

  const load = useCallback(async () => {
    try {
      const f = await mi.getMeeting(id)
      setFacet(f)
      setErr(null)
    } catch (e) {
      setErr(miErrorSentence(e.code, e.message))
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!facet) return
    const terminal = jobTerminal(facet.job?.state)
    let t
    const tick = () => {
      if (document.hidden) return
      void load()
    }
    if (!terminal) t = window.setInterval(tick, 4000)
    return () => {
      if (t) window.clearInterval(t)
    }
  }, [facet?.job?.state, load])

  useEffect(() => {
    if (tab !== 'transcript') return
    mi.getTranscript(id, genPick || undefined)
      .then(setTranscript)
      .catch(() => setTranscript(null))
  }, [tab, id, genPick, facet?.transcript?.authoritative_generation])

  const legal = legalActions(facet?.lifecycle, facet?.transcript?.authoritative_generation)
  const act = async (fn, label) => {
    try {
      await fn()
      await load()
      toast.ok(label)
    } catch (e) {
      toast.fail(e, label)
    }
  }

  const pushB = async () => {
    let parsed
    try {
      parsed = JSON.parse(body)
    } catch {
      toast.push('err', 'Case B JSON is invalid')
      return
    }
    try {
      const res = await mi.pushTranscripts(id, parsed, {
        idempotencyKey: idem,
        ingestToken: token,
      })
      setDecision(res)
      await load()
      toast.ok(res.decision || 'pushed')
    } catch (e) {
      setDecision({
        decision: 'rejected',
        message: miErrorSentence(e.code, e.message),
        code: e.code,
      })
      toast.fail(e, 'Case B')
    }
  }

  if (err) {
    return (
      <div className="content">
        <div className="probe err">{err}</div>
        <Link to="/MI/admin/meetings">← Meetings</Link>
      </div>
    )
  }
  if (!facet) return <div className="content">Loading…</div>

  const chip =
    decision?.decision === 'accepted_supersede'
      ? 'ok'
      : decision?.decision === 'deduped_noop' || decision?.decision === 'stored_candidate'
        ? ''
        : decision?.decision
          ? 'err'
          : ''
  const sealed = facet.transcript?.authoritative_generation != null

  return (
    <div className="content">
      <div className="page-head">
        <Link to="/MI/admin/meetings">← Meetings</Link>
        <h1>{facet.title || facet.external_meeting_id || facet.id}</h1>
        <p className="desc">
          {facet.lifecycle} · profile {facet.profile_id} · {facet.external_meeting_id}
          {facet.partial_capture ? ' · partial capture' : ''}
        </p>
      </div>

      <div className="actions tight">
        <button className={`btn ${tab === 'overview' ? '' : 'secondary'} sm`} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={`btn ${tab === 'transcript' ? '' : 'secondary'} sm`} onClick={() => setTab('transcript')}>
          Transcript
        </button>
        <button className={`btn ${tab === 'draft' ? '' : 'secondary'} sm`} onClick={() => setTab('draft')}>
          Draft
        </button>
        <button className={`btn ${tab === 'approve' ? '' : 'secondary'} sm`} onClick={() => setTab('approve')}>
          Approve
        </button>
        <button className={`btn ${tab === 'official' ? '' : 'secondary'} sm`} onClick={() => setTab('official')}>
          Official
        </button>
        <button className={`btn ${tab === 'ask' ? '' : 'secondary'} sm`} onClick={() => setTab('ask')}>
          Ask
        </button>
      </div>

      {tab === 'overview' && (
        <>
          <Card title="Facet">
            <p className="desc">
              job {facet.job?.state || 'idle'}
              {facet.job?.error_code ? ` (${facet.job.error_code})` : ''}
              {facet.job?.id ? ` · ${facet.job.id}` : ''}
              {' · '}draft {facet.draft?.ready ? 'ready' : 'not ready'}
              {' · '}official {facet.official?.official_version ?? '—'}
              {' · '}auth gen {facet.transcript?.authoritative_generation ?? '—'}
            </p>
            <div className="actions tight">
              {legal.startCapture && (
                <button className="btn secondary sm" onClick={() => act(() => mi.startCapture(id), 'Start capture')}>
                  Start capture
                </button>
              )}
              {legal.end && (
                <button className="btn sm" onClick={() => act(() => mi.endMeeting(id), 'End')}>
                  End
                </button>
              )}
              {legal.cancel && (
                <button
                  className="btn danger sm"
                  onClick={() => {
                    if (window.confirm('Cancel this meeting?')) void act(() => mi.cancelMeeting(id), 'Cancel')
                  }}
                >
                  Cancel
                </button>
              )}
              {legal.regenerate && (
                <button className="btn secondary sm" onClick={() => act(() => mi.regenerate(id), 'Regenerate')}>
                  Regenerate
                </button>
              )}
            </div>
          </Card>

          <Card
            title="Case B ingest"
            hint="Paste an attributed transcript. Shape from orchestrator caseb_test.go — do not invent speakers."
          >
            <p className="desc">
              Case B is the V1 operator path. Start capture is only for live media and is not the
              default. Fixture shape is the coral + Alice/Bob body from orchestrator caseb_test.go.
            </p>
            {sealed && (
              <div className="probe warn">
                Generation {facet.transcript.authoritative_generation} is already authoritative. A
                new accepted push supersedes it. Reuse the same Idempotency-Key to test
                deduped_noop instead.
              </div>
            )}
            <textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} />
            <TextField
              label="Idempotency-Key"
              value={idem}
              onChange={setIdem}
              mono
              desc="Reuse to test dedupe. Generate a new key for a distinct push."
            />
            <div className="actions tight">
              <button type="button" className="btn secondary sm" onClick={() => setIdem(crypto.randomUUID())}>
                New key
              </button>
              <button
                type="button"
                className="btn secondary sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(idem)
                  toast.ok('Idempotency-Key copied')
                }}
              >
                Copy key
              </button>
            </div>
            <TextField
              label="X-MI-Ingest-Token (if this lab requires it)"
              value={token}
              onChange={(v) => {
                setToken(v)
                try {
                  if (v) localStorage.setItem(INGEST_KEY, v)
                  else localStorage.removeItem(INGEST_KEY)
                } catch {
                  /* private mode */
                }
              }}
            />
            <button className="btn" onClick={pushB}>
              Push transcript
            </button>
            {decision && (
              <div className={`probe ${chip}`}>
                {decision.decision || 'rejected'} {decision.accepted != null ? `accepted=${decision.accepted}` : ''}{' '}
                {decision.generation != null ? `gen ${decision.generation}` : ''}{' '}
                {decision.job_id ? `job ${decision.job_id}` : ''} {decision.message || ''}
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'transcript' && (
        <Card title="Transcript">
          <select value={genPick} onChange={(e) => setGenPick(e.target.value)}>
            <option value="">authoritative</option>
            {(facet.transcript?.generations ?? []).map((g) => (
              <option key={g.generation} value={g.generation}>
                gen {g.generation} ({g.state})
              </option>
            ))}
          </select>
          {(transcript?.segments ?? []).map((s, i) => (
            <div key={i} className="desc">
              {s.seq ?? i} · {s.display_name || s.speaker || s.user_id} · {s.text}
            </div>
          ))}
          {!transcript?.segments?.length && <p className="desc">No segments yet.</p>}
        </Card>
      )}

      {tab === 'draft' && <DraftEditor meetingId={id} onDraft={setDraft} />}
      {tab === 'approve' && <ApproveWizard meetingId={id} draft={draft} />}
      {tab === 'official' && <OfficialPane meetingId={id} />}
      {tab === 'ask' && (
        <AskPane
          scope="meeting"
          targetId={id}
          disabledReason={
            facet.lifecycle === 'cancelled'
              ? 'This meeting is cancelled — Ask is not offered.'
              : !facet.official?.id && !facet.draft?.ready && !facet.transcript?.authoritative_generation
                ? 'Nothing to ask yet — wait for a transcript, draft, or official.'
                : ''
          }
        />
      )}
    </div>
  )
}
