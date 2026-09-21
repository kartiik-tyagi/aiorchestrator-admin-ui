# 5.4 — L4 review (Reviewer)

| Exit criterion | Result |
|---|---|
| Summary/Feedback render from facet | **pass** — InsightsPane reads `meeting_summary` / `ai_feedback` |
| PATCH MoM → stale banner when facet.stale | **pass** — banner + poll while stale |
| Refresh clears stale or shows failed | **pass** — `refreshInsights` + reload; status/error shown |
| Disclaimer on Feedback | **pass** — probe warn + Card hint |
| Lint clean; no CC | **pass** |

Locks: no advice into draft PATCH; Refresh ≠ regenerate MoM; Approve not blocked; no SSE required. Findings: none blocking.

```yaml
# agent-approval
role: reviewer
result: pass
checklist:
  - id: checked_vs_plan
    pass: true
  - id: locks_checked
    pass: true
  - id: findings_actionable
    pass: true
  - id: no_rewrite
    pass: true
blocker: null
```
