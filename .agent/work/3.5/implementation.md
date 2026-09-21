# 3.5 — L4 implementation (Coder)

Ask (one-shot + session) on meeting/profile. Retention two-step + typed PURGE. Ledger hidden (404). No lab-sfu.

## Files

| Path | Change |
|---|---|
| `src/pages/mi/AskPane.jsx` | **New** |
| `src/pages/mi/Retention.jsx` | **New** |
| `src/pages/mi/MeetingDetail.jsx` | Ask tab |
| `src/pages/mi/ProfileDetail.jsx` | Profile Ask |
| `src/shells/MiShell.jsx` | `/retention` muted footer |
| `src/api/mi/client.js` | actions 404 comment re-probe |

## Verify

```text
POST meeting ask Friday → official_field_ref
POST xyzzy → abstained
POST ask/sessions + two turns; GET turns=2
POST profile ask ship Friday → citation
POST retention/purge → 0/0 (retention unset)
GET profiles/…/actions → 404
Browser /MI/admin/retention — step 1 then PURGE gate
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
