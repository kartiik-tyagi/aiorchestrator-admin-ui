# 1.3 — L4 implementation (Coder)

**Phase:** 1.3  
**Plan:** `.agent/work/1.3/plan.md`

## Changes

| File | Action |
|---|---|
| `src/lib/flowValidate.js` | Removed false Decide/global rules; added cx, Decide, ListenSlot, globals, allowed_intents |
| `src/api/types.js` | `SLOT_VALIDATORS`, `WELL_KNOWN_SLOTS`, `INTERRUPT_MODES`; node typedefs |

## Verify (node import)

```
inbound: 7 errors, all repair-edge UI checks; false_decide=0 false_global_unused=0
Decide without rules → error
ListenSlot without slot → error (+ existing listen-edge check)
globals: ["missing"] → error
cx: { layout } → error
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
