import { Card } from '../../components/ui'

function renderSummary(summary) {
  if (summary == null || summary === '') {
    return <p className="desc">No Meeting Summary yet — enable rules.insights.summary and wait for MoM, or Regenerate.</p>
  }
  if (typeof summary === 'string') {
    return <pre className="mono" style={{ whiteSpace: 'pre-wrap' }}>{summary}</pre>
  }
  if (typeof summary === 'object') {
    const text =
      summary.text ||
      summary.body ||
      summary.summary ||
      (typeof summary.content === 'string' ? summary.content : null)
    if (text) return <pre className="mono" style={{ whiteSpace: 'pre-wrap' }}>{text}</pre>
    return <pre className="mono" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(summary, null, 2)}</pre>
  }
  return <p className="desc">{String(summary)}</p>
}

/**
 * Why an empty panel is empty, in words a reviewer can act on.
 *
 * The stored reasons are internal tokens: "empty_retrieve_pack" told nobody
 * anything, and the two cases have completely different remedies — one is a
 * configuration/data gap you can fix, the other is the model declining.
 */
function abstainSentence(reason) {
  switch (reason) {
    case 'empty_retrieve_pack':
      return 'No context to advise on. This meeting produced no decisions or actions with owners, there are no open action items carried over from an approved meeting, the profile has no Other docs, and none of its speakers are bound to the people directory. Binding the attendees in the profile directory is usually what unblocks this.'
    case 'no_valid_items':
      return 'There was context, but nothing usable came back — the model either had no advice to give, or every source it cited failed validation. Regenerating often produces a result, since the model varies between runs.'
    default:
      return reason
        ? `Abstained: ${reason}`
        : 'Abstained — no advice was recorded for this meeting.'
  }
}

function generatedLine(payload) {
  const at = payload?.generated_at
  if (!at) return null
  const d = new Date(at)
  return Number.isNaN(d.getTime()) ? `generated ${at}` : `generated ${d.toLocaleString()}`
}

function FeedbackItems({ payload }) {
  if (!payload || typeof payload !== 'object') {
    return (
      <p className="desc">
        AI Feedback has never run for this meeting. Enable rules.insights.feedback on the profile,
        then Regenerate.
      </p>
    )
  }
  if (payload.abstained) {
    return <p className="desc">{abstainSentence(payload.reason)}</p>
  }
  const items = Array.isArray(payload.items) ? payload.items : []
  if (!items.length) {
    return <p className="desc">{abstainSentence(payload.reason)}</p>
  }
  return (
    <ul className="desc" style={{ paddingLeft: 18 }}>
      {items.map((it, i) => (
        <li key={it.id || i} style={{ marginBottom: 12 }}>
          <div>
            {it.kind ? <strong>{it.kind}: </strong> : null}
            {it.text || JSON.stringify(it)}
          </div>
          {!!it.basis?.length && (
            <div className="actions tight" style={{ marginTop: 4 }}>
              {it.basis.map((b, j) => (
                <span key={j} className="btn secondary sm" style={{ pointerEvents: 'none' }}>
                  {b.label || b.type || b.id || 'basis'}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * Read-only Meeting Summary or AI Feedback from facet.insights.
 * Never PATCH into MoM draft.
 *
 * Regenerate is the page's own insights refresh, surfaced on the card so it is
 * where you are looking when the panel is empty. It recomputes Summary AND
 * Feedback together — they share one job and one row — so the label says so
 * rather than implying Feedback can be rebuilt on its own.
 */
export default function InsightsPane({ mode, insights, onRegenerate, busy, disabledReason }) {
  const ins = insights && typeof insights === 'object' ? insights : {}
  const statusLine = [
    ins.status ? `status ${ins.status}` : null,
    ins.error_code ? `error ${ins.error_code}` : null,
    ins.source_draft_version != null ? `source draft v${ins.source_draft_version}` : null,
    ins.draft_version != null ? `draft v${ins.draft_version}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const payload = mode === 'summary' ? ins.meeting_summary : ins.ai_feedback
  const generated = generatedLine(payload)

  const regenerate = onRegenerate ? (
    <>
      <button
        type="button"
        className="btn secondary sm"
        disabled={!!busy || !!disabledReason}
        title={disabledReason || 'Recomputes Meeting Summary and AI Feedback from the saved draft'}
        onClick={() => void onRegenerate()}
      >
        {busy ? 'Regenerating…' : 'Regenerate'}
      </button>
      <span className="desc">
        {disabledReason || 'Recomputes Summary and AI Feedback together — MoM is not touched.'}
      </span>
    </>
  ) : null

  if (mode === 'summary') {
    return (
      <Card
        title="Meeting Summary"
        hint="Skim of this meeting only — not Official, not Ask-indexed."
        actions={regenerate}
      >
        {statusLine && <p className="desc">{statusLine}</p>}
        {generated && <p className="desc">{generated}</p>}
        {renderSummary(ins.meeting_summary)}
      </Card>
    )
  }

  return (
    <Card
      title="AI Feedback"
      hint="AI advice — not approved minutes. Never Official. Never Ask-indexed. Never written into MoM."
      actions={regenerate}
    >
      <div className="probe warn">AI advice — not approved minutes.</div>
      {statusLine && <p className="desc">{statusLine}</p>}
      {generated && <p className="desc">{generated}</p>}
      <FeedbackItems payload={ins.ai_feedback} />
    </Card>
  )
}
