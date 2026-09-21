# 3.2 — L4 review (Reviewer)

| # | Result |
|---|---|
| 1 Create/reload/edit name | **pass** — name `ui-mi-demo desk` on GET |
| 2 KB list after upsert | **pass** — Policy doc listed |
| 3 Snapshot copy | **pass** — list + detail |
| 4 Empty sections + invalid JSON | **pass** — sections [] allowed in tests; UI refuses invalid rules JSON |

No Delete button. Unknown PUT fields 400 (server).

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
