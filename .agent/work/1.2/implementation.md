# 1.2 — L4 implementation (Coder)

**Phase:** 1.2  
**Plan:** `.agent/work/1.2/plan.md`

## Changes

| File | Action |
|---|---|
| `src/pages/Bindings.jsx` | Retrieve fields; empty entry template; Delete removed |
| `src/api/types.js` | `InlineFaqEntry` aliases/intents/department/product |
| `src/api/client.js` | `deleteBinding` removed |
| `src/lib/fieldGuide.js` | Retrieve field copy |

Save still sends `entries` as the loaded/edited array. `setEntry` still `{ ...e, ...p }`.

## Verify

```
GET /v1/bindings/product-faq → iris-ivdx intents/dept/product/aliases present
rg deleteBinding src → empty
no Delete control in Bindings.jsx
```

No-op PUT not run from a script (orch write). Payload path is identity on `entries`.

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
