# 3.2 — L4 implementation (Coder)

MI profile list/edit + KB. No delete. Profile ids and KB ids are UUIDs on this Postgres.

Left `ui-mi-demo` (name) profile `edea14e5-f248-42d8-9287-bfee63d84e13` + Policy KB for 3.3.

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
