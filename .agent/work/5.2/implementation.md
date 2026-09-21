# 5.2 — L4 implementation (Coder)

Profile identity directory + KB token + Enable KG. Other docs relabeled and kept separate.

## Files

| Path | Change |
|---|---|
| `src/pages/mi/DirectoryPane.jsx` | **New** — token (`orch_mi_kb_token` + `setMiKbToken`), people/products CSV import/export, dry-run checkbox, entities tables, Enable KG |
| `src/pages/mi/ProfileDetail.jsx` | Mount Directory above Other docs; Other docs title/hint/button copy |
| `src/lib/miErrors.js` | `kb_unauthorized` sentence |

## Verify

```text
npm run lint
# exit 0
```

Uses only 5.1 client methods. No CC edits. No inbox/insights UI.

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
    note: lint + manual profile page; no unit tests in programme
  - id: no_scope_creep
    pass: true
  - id: no_secrets
    pass: true
blocker: null
```
