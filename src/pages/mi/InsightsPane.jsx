import { Card } from '../../components/ui'

function renderSummary(summary) {
  if (summary == null || summary === '') {
    return <p className="desc">No Meeting Summary yet — enable rules.insights.summary and wait for MoM, or Refresh insights.</p>
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

function FeedbackItems({ payload }) {
  if (!payload || typeof payload !== 'object') {
    return <p className="desc">No AI Feedback yet — enable rules.insights.feedback, then Refresh insights after MoM.</p>
  }
  if (payload.abstained) {
    return (
      <p className="desc">
        Abstained{payload.reason ? `: ${payload.reason}` : '.'}
      </p>
    )
  }
  const items = Array.isArray(payload.items) ? payload.items : []
  if (!items.length) {
    return <p className="desc">Feedback is empty for this meeting.</p>
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
 */
export default function InsightsPane({ mode, insights }) {
  const ins = insights && typeof insights === 'object' ? insights : {}
  const statusLine = [
    ins.status ? `status ${ins.status}` : null,
    ins.error_code ? `error ${ins.error_code}` : null,
    ins.source_draft_version != null ? `source draft v${ins.source_draft_version}` : null,
    ins.draft_version != null ? `draft v${ins.draft_version}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  if (mode === 'summary') {
    return (
      <Card title="Meeting Summary" hint="Skim of this meeting only — not Official, not Ask-indexed.">
        {statusLine && <p className="desc">{statusLine}</p>}
        {renderSummary(ins.meeting_summary)}
      </Card>
    )
  }

  return (
    <Card
      title="AI Feedback"
      hint="AI advice — not approved minutes. Never Official. Never Ask-indexed. Never written into MoM."
    >
      <div className="probe warn">AI advice — not approved minutes.</div>
      {statusLine && <p className="desc">{statusLine}</p>}
      <FeedbackItems payload={ins.ai_feedback} />
    </Card>
  )
}
