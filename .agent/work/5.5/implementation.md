# 5.5 — L4 implementation (Coder)

Terminology glossary on profile + home trust legend.

## Files

| Path | Change |
|---|---|
| `src/pages/mi/TerminologyPane.jsx` | **New** — list/add; inbox is confirm queue |
| `src/pages/mi/ProfileDetail.jsx` | Mount Terminology below insights flags |
| `src/pages/mi/Dashboard.jsx` | Trust legend (MoM / Summary / Feedback / inbox) |

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
