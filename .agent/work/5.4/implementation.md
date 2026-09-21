# 5.4 — L4 implementation (Coder)

Meeting MoM | Summary | AI Feedback panes + stale banner + Refresh insights (poll-only).

## Files

| Path | Change |
|---|---|
| `src/pages/mi/InsightsPane.jsx` | **New** — read-only Summary + Feedback; disclaimer; empty/abstain |
| `src/pages/mi/MeetingDetail.jsx` | MoM tab label; Summary/Feedback tabs; stale banner; Refresh insights; poll while insights busy/stale |

## Verify

```text
npm run lint
# exit 0
```

No PATCH of Summary/Feedback into draft. Refresh does not call regenerate. Approve unchanged (not gated on stale).

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
