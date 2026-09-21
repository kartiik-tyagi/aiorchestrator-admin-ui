# 3.3 — L4 summary (Summarizer)

Closed. `3803022e6d8ed9a84de56fdf6fdebadaa14caa15`.

Create + Case B on `ui-mi-demo` `edea14e5-f248-42d8-9287-bfee63d84e13`. Lab meeting `b11cb928-7e53-4210-9356-6d936ae0c155` ended, draft ready, Alice/Bob transcript. Same Idempotency-Key → `deduped_noop`. Ended workspace offers Regenerate only.

Next: 3.4 draft / approve / official / export on `/MI/admin/meetings/:id`. Do not rebuild list/Case B. Bind editor to live draft JSON (see `approve_test.go`). Ask is 3.5.

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
