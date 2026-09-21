# 1.1 — L4 implementation (Coder)

**Phase:** 1.1  
**Plan:** `.agent/work/1.1/plan.md`  
**Role:** Coder only  

---

## What changed

Canvas positions no longer enter `coral.flow.v1`. They persist in `localStorage` as `orch_cc_layout:<flowId>`. `docForWire()` is `withoutCx(doc)`.

| File | Action |
|---|---|
| `src/lib/layout.js` | `withoutCx`, LS read/write/remap, `resolveLayout(doc, flowId)`, `withLayout` removed |
| `src/pages/FlowBuilder.jsx` | Load/replace strip `cx`; persist LS on drag/add/save/relayout; rename remaps LS |
| `src/pages/builder/Inspector.jsx` | Rename no longer writes `d.cx` |
| `README.md` | Kernel rejects `cx`; layout is browser-local |
| `src/api/types.js` | Honest `cx` JSDoc |

---

## Tests

No new test file. `withoutCx` checked in node: `{ cx, ...doc }` result has no `cx` key.

---

## Verify

```
rg withLayout src README.md          # empty
rg "runtime never reads" src README  # empty
node: withoutCx({cx:{}}) has no cx
GET /v1/flows/coral-telecom-inbound/draft → doc has no cx
Builder /CC/admin/flows/coral-telecom-inbound/builder loads
Publish not attempted: client still reports 7 repair-edge errors (1.3), not cx
```

Did not PUT the live draft from a script (orch write). Save in the UI uses the same `withoutCx` body.

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
