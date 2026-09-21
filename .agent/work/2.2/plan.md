# 2.2 — L4 plan (Planner)

**L3:** `docs/phases/2.2_cc_flow_inspector.md`

Already: 1.3 validator (Decide/slot/globals), 1.1 no cx, 2.1 profile catalog.

Add inspector industrial fields; flow-level globals + policy inherit; POST validate + version list; downgrade listen multi-repair from error→warning so live inbound matches server (200).

Do not write cx. Do not granular draft/nodes.

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
