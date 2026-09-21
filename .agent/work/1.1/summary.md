# 1.1 — L4 summary (Summarizer)

**Phase:** 1.1 CC layout out of document  
**Status:** Closed  
**Review:** pass  
**Commit:** `9a5cd70892f263d3a0efeb97da3119880ac50616`

---

## Exit vs plan

| # | Criterion | Met | Evidence |
|---|---|---|---|
| 1 | `docForWire` has no `cx` | yes | `withoutCx`; node `'cx' in withoutCx(...)` → false |
| 2 | Publish not rejected for `cx` | yes | GET inbound draft has no `cx`. Publish not run (7 client repair-edge errors — 1.3) |
| 3 | Drag/reload restores in this browser | yes | `orch_cc_layout:<flowId>` written on drag/add/save |
| 4 | Relayout does not write `cx` | yes | `autoLayout` + LS only |
| 5 | Docs honest about `cx` | yes | Grep clean on `src` + `README.md` |

## Verify re-run

```
withoutCx has no cx key
GET draft coral-telecom-inbound 200 has_cx false
GREP_CLEAN withLayout / runtime never reads / Go ignores
```

## Residual risks

- Client still flags multiple `repair` edges on live inbound (1.3 / 2.2). Do not treat that as a `cx` regression.
- Layout is per-browser; incognito auto-lays out.

## Next planner (1.2)

Read `docs/phases/1.2_*` (profile draft / do not reconstruct from empty forms). Do not redo layout. Do not add MI.

```yaml
# agent-approval
role: summarizer
result: pass
checklist:
  - id: exit_vs_plan
    pass: true
  - id: verify_rerun
    pass: true
  - id: committed_after_verify
    pass: true
  - id: residual_risks
    pass: true
  - id: next_context
    pass: true
  - id: honest
    pass: true
blocker: null
```
