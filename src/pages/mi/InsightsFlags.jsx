import { Card } from '../../components/ui'

/**
 * Structured rules.insights toggles — default off.
 * Summary / Feedback never become Official by themselves.
 */
export default function InsightsFlags({ summary, feedback, onChange }) {
  return (
    <Card
      title="Meeting insights"
      hint="Summary and Feedback stay off until you enable them. They never become Official by themselves. Independent of rules.kb. With both off, POST …/insights/refresh returns 400 insights_disabled."
    >
      <label className="row tight" style={{ gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={!!summary}
          onChange={(e) => onChange({ summary: e.target.checked, feedback })}
        />
        rules.insights.summary — generate Meeting Summary after MoM succeeds
      </label>
      <label className="row tight" style={{ gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={!!feedback}
          onChange={(e) => onChange({ summary, feedback: e.target.checked })}
        />
        rules.insights.feedback — generate AI Feedback after MoM succeeds
      </label>
    </Card>
  )
}
