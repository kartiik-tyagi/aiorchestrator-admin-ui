# 4.1 — L4 implementation (Coder)

Shared chrome + dirty switch both ways. No new product fields.

| File | Change |
|---|---|
| `src/shells/ProductSwitch.jsx` | confirmLeaveDirty on both homes |
| `src/pages/mi/ProfileDetail.jsx` | setDirtyGuard Minutes desk |
| `src/pages/mi/DraftEditor.jsx` | setDirtyGuard draft |
| `src/pages/mi/Meetings.jsx` | “snapshot stored” |
| `src/shells/MiShell.jsx` | collapse rail + Ctrl+B |
| `README.md` | operator map table |

CatalogProvider still CC-only. FlowBuilder shortcuts still builder-only.

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
