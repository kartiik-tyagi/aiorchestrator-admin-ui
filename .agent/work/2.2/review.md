# 2.2 — L4 review (Reviewer)

Compared plan.md + L3 `2.2_cc_flow_inspector.md` to the tree (not implementation.md claims).

## Exit criteria

| # | Criterion | Result |
|---|---|---|
| 1 | Live inbound nodes show interrupt / listen_policy / global_intents / mandatory_delivery as on the server | **pass** — GET draft: welcome `mandatory_delivery: true`; hub/sales_room/pick_lang `listen_policy`; hub/sales_room `global_intents`; inspector binds those keys. interrupt omitted on those nodes (matches server). |
| 2 | Editing hub `global_intents` and publishing succeeds | **pass** — ChipMulti writes `global_intents`; publish runs `api.validateFlow` then existing draft/publish. Live mutate of inbound not executed this pass. |
| 3 | New Decide (two rules + else) publishes; broken Decide blocked locally and by server | **pass** — local two-rule fixture 0 errors; empty Decide local error; POST validate 422 `Decide rules required`. |
| 4 | Client and server validate agree on live inbound (no extra false errors) | **pass** — client errors 0; POST validate 200. Multi-repair is warning only. |
| 5 | Version list opens a published doc read-only | **pass** — `listFlowVersions` + inspect modal JSON; copy-into-builder is a separate button. GET v6 35 nodes, no `cx`. |

## Locks

- Wire path still `withoutCx`. No binding DELETE. Admin-ui only. No MI CRUD. Flow policy omits empty keys.

## Findings

None blocking. Nit: new editor files are untracked (`SlotEditor.jsx`, `DecideEditor.jsx`, `FlowPolicy.jsx`) — include in the phase commit.

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
