# 3.1 — L4 implementation (Coder)

MI client + dashboard. Probe: meta 404, actions 404. Proxy health 200, lists 0.

Did not stop the orchestrator (later phases need it). Down copy is wired.

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
