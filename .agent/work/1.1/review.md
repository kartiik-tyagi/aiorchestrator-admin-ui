# 1.1 — L4 review (Reviewer)

**Phase:** 1.1  
**Plan:** `.agent/work/1.1/plan.md`  
**Implementation:** `.agent/work/1.1/implementation.md`  
**Role:** Reviewer only — no application code  

---

## Diff vs plan

`withLayout` deleted. `docForWire` is `withoutCx`. Inspector rename no longer mutates `cx`. README and types JSDoc no longer claim the kernel ignores `cx`. Relayout uses `autoLayout` (ignores LS) then writes LS — correct, because `resolveLayout` would otherwise keep stored positions.

---

## Exit criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `docForWire()` JSON has no `cx` | **pass** | `docForWire = () => withoutCx(doc)`; node check `withoutCx_has_cx false` |
| 2 | Publish does not fail on `cx` | **pass** | Live inbound GET draft already has no `cx`. Publish not run: UI shows 7 repair-edge errors (not `policy_validation_failed` / `cx`). Plan allows this. |
| 3 | Drag + reload restores positions in this browser | **pass** | `writeLocalLayout` on drag/add/save; `resolveLayout` reads LS first |
| 4 | Relayout does not reintroduce `cx` | **pass** | Relayout writes LS only; `doc` stays `withoutCx` |
| 5 | Docs no longer claim Go ignores `cx` | **pass** | Grep empty on `src` + `README.md` |

---

## Locks

- No MI / validator / node JSON changes  
- Positions not written to `conversation_policy`  
- Admin-ui only  

---

## Findings

None blocking.

```yaml
# agent-approval
role: reviewer
result: pass
checklist:
  - id: checked_vs_plan
    pass: true
  - id: locks_checked
    pass: true
  - id: findings_actionable
    pass: true
  - id: no_rewrite
    pass: true
blocker: null
```
