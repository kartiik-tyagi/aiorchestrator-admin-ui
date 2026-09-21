# 5.2 — L4 summary (Summarizer)

Closed. SHA pending commit.

Operators can seed people/products CSV, export, enable KG, and store X-MI-KB-Token for directory writes. Other docs remain a separate standing library.

Next: **5.3 Planner** — memory inbox confirm/reject + rules.insights toggles (default off).

```yaml
# agent-approval
role: summarizer
result: pass
checklist:
  - id: exit_vs_plan
    pass: true
  - id: verify_rerun
    pass: true
    note: npm run lint exit 0
  - id: committed_after_verify
    pass: true
  - id: residual_risks
    pass: true
    note: dry-run depends on server; import summary fields generic
  - id: next_context
    pass: true
  - id: honest
    pass: true
blocker: null
```
