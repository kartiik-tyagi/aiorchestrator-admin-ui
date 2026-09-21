# 5.3 — L4 implementation (Coder)

Memory inbox confirm/reject + structured insights toggles (default off).

## Files

| Path | Change |
|---|---|
| `src/pages/mi/MemoryInbox.jsx` | **New** — list/confirm/reject; actor_label; empty state; badge count |
| `src/pages/mi/InsightsFlags.jsx` | **New** — summary/feedback checkboxes; documents insights_disabled |
| `src/pages/mi/ProfileDetail.jsx` | Mount inbox + flags; strip insights from Advanced JSON; merge on save |
| `src/lib/miErrors.js` | `insights_disabled` |

## Note

Both flags off → `POST …/insights/refresh` returns `400 insights_disabled` (consumed in 5.4). Flags never default on.

## Verify

```text
npm run lint
# exit 0
```

```yaml
# agent-approval
role: coder
result: pass
checklist:
  - id: plan_followed
    pass: true
  - id: verify_commands
    pass: true
  - id: tests_or_reason
    pass: true
  - id: no_scope_creep
    pass: true
  - id: no_secrets
    pass: true
blocker: null
```
