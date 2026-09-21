# 1.3 — L4 plan (Planner)

**Phase:** 1.3  
**L3:** `docs/phases/1.3_cc_validator_truth.md`  
**Role:** Planner only  

---

## Already implemented (from git)

| Commit | What | Do not redo |
|---|---|---|
| `9a5cd70` | 1.1 `withoutCx` on wire | Do not change layout persistence |
| `1700cf4` | 1.2 bindings retrieve | Do not edit Bindings |

`flowValidate.js` still hard-errors Decide as unimplemented and warns every `kind=global` as unused.

---

## Goal

Align `validateFlow` with Go CC.5 / VA.2 graph checks. **No Inspector fields.**

---

## In scope

Remove false Decide unimplemented + global-unused warning.

Add: non-empty `cx` error; Decide payload; ListenSlot payload; `doc.globals`; `node.global_intents`; `node.allowed_intents` (listen-only; empty allowed). Warn `kind=global` **not listed in `doc.globals`**: “This global is not listed on the flow — the bot will never offer it.” Keep existing schema/entry/Inform/prompt/matrix/transfer/next/repair checks.

Constants in `types.js`: `SLOT_VALIDATORS`, `WELL_KNOWN_SLOTS`, `INTERRUPT_MODES` (Go copies; catalog later).

No `conversation_policy` ranges. No silent-cycle (not in L3 add list). No Inspector.jsx.

---

## Out of scope

2.2 inspector, 2.1 profile validator, `POST /v1/flows/{id}/validate`, MI.

---

## File touch list

| File | Action |
|---|---|
| `src/lib/flowValidate.js` | Rule updates |
| `src/api/types.js` | Typedefs + constants |

---

## Exit criteria

1. Opening inbound draft: no Decide/global-unused **false** errors (repair-edge UI checks may remain).
2. Fixture Decide without `decide.rules` errors.
3. Fixture ListenSlot without `slot` errors.
4. Fixture `globals: ["missing"]` errors.
5. Document with `cx: { layout: {} }` errors.

Verify via a small node `--input-type=module` import of `validateFlow` (no new test runner) plus inbound GET draft.

---

## Risks

| Risk | Mitigation |
|---|---|
| Over-validate policy | Skip policy ranges |
| Unknown slot keys | Well-known + ListenSlot-declared keys |

```yaml
# agent-approval
role: planner
result: pass
checklist:
  - id: reviewed_prior_commits
    pass: true
  - id: cites_phase_yaml
    pass: true
  - id: cites_docs
    pass: true
  - id: exit_criteria_listed
    pass: true
  - id: out_of_scope
    pass: true
  - id: no_vendor_early
    pass: true
  - id: risks
    pass: true
blocker: null
```
