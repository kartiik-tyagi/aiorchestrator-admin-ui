import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { mi } from '../../api/mi/client'
import { Card, Modal, TextField, useToast } from '../../components/ui'
import { confirmLeaveDirty } from '../../lib/dirtyGuard'
import { miErrorSentence } from '../../lib/miErrors'
import { jobTerminal, legalActions } from '../../lib/miLifecycle'
import { useDraftWorkspace } from '../../lib/useDraftWorkspace'
import ApproveWizard from './ApproveWizard'
import AskPane from './AskPane'
import InsightsPane from './InsightsPane'
import MomTab from './minutes/MomTab'
import OfficialTab from './minutes/OfficialTab'

const TABS = [
  ['overview', 'Overview'],
  ['transcript', 'Transcript'],
  ['mom', 'MoM'],
  ['summary', 'Summary'],
  ['feedback', 'AI Feedback'],
  ['approve', 'Approve'],
  ['official', 'Official'],
  ['ask', 'Ask'],
]
const TAB_KEYS = new Set(TABS.map(([k]) => k))
// Per-tab URL params; switching tabs drops the others.
const TAB_PARAMS = { official: ['v'], transcript: ['seg'] }

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
  const [params, setParams] = useSearchParams()
  const rawTab = params.get('tab') === 'draft' ? 'mom' : params.get('tab')
  const tab = TAB_KEYS.has(rawTab) ? rawTab : 'overview'
  const setTab = useCallback(
    (next, extra = {}) => {
      setParams((p) => {
        const q = new URLSearchParams(p)
        q.set('tab', next)
        for (const [t, keys] of Object.entries(TAB_PARAMS)) {
          if (t !== next) keys.forEach((k) => q.delete(k))
        }
        for (const [k, v] of Object.entries(extra)) {
          if (v == null || v === '') q.delete(k)
          else q.set(k, String(v))
        }
        return q
      })
    },
    [setParams],
  )
  const officialV = Number(params.get('v')) || null
  const seg = params.get('seg') || ''
  // Draft state lives here, not in the MoM tab, so tab switches keep edits (7.2).
  const ws = useDraftWorkspace(id)
  const dirtyRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = ws.dirty
  }, [ws.dirty])
  const [momMode, setMomMode] = useState('preview')
  const [authSegs, setAuthSegs] = useState([])
  const [regenConfirm, setRegenConfirm] = useState(null)
  const [regenBusy, setRegenBusy] = useState(false)
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
  const [refreshBusy, setRefreshBusy] = useState(false)

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
    const insightsBusy =
      facet.insights?.status &&
      !['ready', 'succeeded', 'failed', 'skipped', 'disabled', 'idle', ''].includes(
        String(facet.insights.status).toLowerCase(),
      )
    let t
    const tick = () => {
      // Paused while the MoM has unsaved edits (7.2); resumes after save/discard.
      if (document.hidden || dirtyRef.current) return
      void load()
    }
    if (!terminal || insightsBusy || facet.insights?.stale) t = window.setInterval(tick, 4000)
    return () => {
      if (t) window.clearInterval(t)
    }
  }, [facet?.job?.state, facet?.insights?.status, facet?.insights?.stale, load])

  const refreshInsights = async () => {
    setRefreshBusy(true)
    try {
      await mi.refreshInsights(id)
      await load()
      toast.ok('Insights refresh requested — MoM was not regenerated.')
    } catch (e) {
      toast.push('err', miErrorSentence(e.code, e.message))
    } finally {
      setRefreshBusy(false)
    }
  }

  useEffect(() => {
    if (tab !== 'transcript') return
    mi.getTranscript(id, genPick || undefined)
      .then(setTranscript)
      .catch(() => setTranscript(null))
  }, [tab, id, genPick, facet?.transcript?.authoritative_generation])

  // Authoritative transcript for attendees, duration and the owner picker.
  const authGen = facet?.transcript?.authoritative_generation
  useEffect(() => {
    if (authGen == null) return
    let live = true
    mi.getTranscript(id)
      .then((t) => live && setAuthSegs(t.segments ?? []))
      .catch(() => live && setAuthSegs([]))
    return () => {
      live = false
    }
  }, [id, authGen])

  // A new server draft (job finished, another tab saved) reloads the workspace,
  // unless the reviewer has unsaved edits — those are never replaced silently.
  const serverDraftVersion = facet?.draft?.version ?? null
  const { reload: reloadDraft, dirty: wsDirty, loadedVersion } = ws
  useEffect(() => {
    if (serverDraftVersion == null || wsDirty || serverDraftVersion === loadedVersion) return
    void reloadDraft()
  }, [serverDraftVersion, wsDirty, loadedVersion, reloadDraft])

  // Transcript deep link (?seg=) scrolls to and highlights the segment.
  useEffect(() => {
    if (tab !== 'transcript' || !seg || !transcript) return
    document.getElementById(`seg-${seg}`)?.scrollIntoView({ block: 'center' })
  }, [tab, seg, transcript])

  const openSegment = useCallback((segmentId) => setTab('transcript', { seg: segmentId }), [setTab])

  const regenerate = async (discardEdits) => {
    setRegenBusy(true)
    try {
      await mi.regenerate(id, { discardEdits })
      setRegenConfirm(null)
      await load()
      toast.ok(discardEdits ? 'Regenerating. Your edits were kept in history.' : 'Regenerating minutes.')
    } catch (e) {
      if (e.code === 'draft_has_edits') {
        setRegenConfirm(e.body || {})
      } else {
        toast.push('err', miErrorSentence(e.code, e.message))
      }
    } finally {
      setRegenBusy(false)
    }
  }

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

  const guardLeave = (e) => {
    if (!confirmLeaveDirty()) e.preventDefault()
  }
  const wide = tab === 'mom' || tab === 'official'

  return (
    <div className={`content ${wide ? 'wide' : ''}`}>
      <div className="page-head">
        <Link to="/MI/admin/meetings" onClick={guardLeave}>
          ← Meetings
        </Link>
        <h1>{facet.title || facet.external_meeting_id || facet.id}</h1>
        <p className="desc">
          {facet.lifecycle} · profile {facet.profile_id} · {facet.external_meeting_id}
          {facet.partial_capture ? ' · partial capture' : ''}
        </p>
      </div>

      <div className="actions tight" role="tablist" aria-label="Meeting sections">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`btn ${tab === key ? '' : 'secondary'} sm`}
            onClick={() => setTab(key)}
          >
            {label}
            {key === 'mom' && ws.dirty ? ' •' : ''}
          </button>
        ))}
      </div>

      {facet.insights?.stale && (
        <div className="probe warn">
          Insights are behind the current draft version
          {facet.insights.source_draft_version != null || facet.insights.draft_version != null
            ? ` (insights from v${facet.insights.source_draft_version ?? '?'}, draft now v${facet.insights.draft_version ?? '?'})`
            : ''}
          . Refresh rebuilds Summary/Feedback only — it does not regenerate MoM. Approve is not blocked by
          stale insights.
        </div>
      )}

      {(tab === 'summary' || tab === 'feedback' || tab === 'mom') && (
        <div className="actions tight" style={{ marginBottom: 8 }}>
          <button
            type="button"
            className="btn secondary sm"
            disabled={refreshBusy || !facet.draft?.ready}
            title={!facet.draft?.ready ? 'No draft yet — cannot refresh insights' : undefined}
            onClick={() => void refreshInsights()}
          >
            Refresh insights
          </button>
          <span className="desc">
            {facet.insights?.status ? `insights ${facet.insights.status}` : 'insights idle'}
            {facet.insights?.error_code ? ` (${facet.insights.error_code})` : ''}
          </span>
        </div>
      )}

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
                <button
                  className="btn secondary sm"
                  disabled={regenBusy || ws.dirty}
                  title={ws.dirty ? 'Save or discard your MoM edits first' : undefined}
                  onClick={() => void regenerate(false)}
                >
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
            <div
              key={s.id || i}
              id={s.id ? `seg-${s.id}` : undefined}
              className={`desc transcript-line ${seg && s.id === seg ? 'hit' : ''}`}
            >
              {s.seq ?? i} · {s.display_name || s.speaker || s.user_id} · {s.text}
            </div>
          ))}
          {!transcript?.segments?.length && <p className="desc">No segments yet.</p>}
        </Card>
      )}

      {tab === 'mom' && (
        <MomTab
          meetingId={id}
          facet={facet}
          ws={ws}
          segments={authSegs}
          mode={momMode}
          setMode={setMomMode}
          onOpenSegment={openSegment}
        />
      )}
      {tab === 'summary' && <InsightsPane mode="summary" insights={facet.insights} />}
      {tab === 'feedback' && <InsightsPane mode="feedback" insights={facet.insights} />}
      {tab === 'approve' && (
        <ApproveWizard
          meetingId={id}
          draft={ws.draft}
          dirty={ws.dirty}
          onApproved={(off) => {
            void load()
            setTab('official', { v: off.official_version })
          }}
        />
      )}
      {tab === 'official' && (
        <OfficialTab
          meetingId={id}
          facet={facet}
          segments={authSegs}
          version={officialV}
          setVersion={(v) => setTab('official', { v })}
          draftVersion={ws.draft?.version ?? facet.draft?.version}
          onOpenSegment={openSegment}
          onGoToMom={() => setTab('mom')}
        />
      )}
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

      <Modal
        open={!!regenConfirm}
        title="Replace your edits?"
        hint="This draft has saved edits since it was generated. Regenerating replaces the draft; your edited version is kept in the draft history."
        onClose={() => setRegenConfirm(null)}
        onSubmit={() => void regenerate(true)}
        submitLabel="Regenerate anyway"
        busy={regenBusy}
      >
        {regenConfirm?.draft_version != null && (
          <p className="desc">
            Current draft v{regenConfirm.draft_version}
            {regenConfirm.last_edited_at ? `, last edited ${new Date(regenConfirm.last_edited_at).toLocaleString()}` : ''}.
          </p>
        )}
      </Modal>
    </div>
  )
}
