# 2.3 — L4 implementation (Coder)

Dashboard blocker buttons + amber operator warnings. Pins per-row PUT/DELETE. Smoke still stops.

## Files

| File | Change |
|---|---|
| `src/api/client.js` | `getAnswerPin`, `putAnswerPin`, `deleteAnswerPin` |
| `src/lib/dashboardWarnings.js` | blocker → screen; catalog/globals/Inform retrieve warnings |
| `src/pages/Dashboard.jsx` | Blocker buttons; operator warnings; Server Ready copy |
| `src/pages/Pins.jsx` | Save this pin / Save all / Remove via DELETE; smoke copy |

## Verify

- Live warnings: **[]** (inbound has catalog + globals; no false amber).
- `GET …/answer-pins/coral-telecom-limited` 200. Identity `PUT` 200; other pin notes unchanged.
- Smoke `coral-telecom-limited` chat: spoken Hindi greeting; `stop` 200.
- Vite Dashboard + Pins 200.

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
