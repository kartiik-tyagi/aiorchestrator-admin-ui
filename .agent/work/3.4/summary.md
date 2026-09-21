# 3.4 — L4 summary (Summarizer)

Closed. `00a0c5156d86ad2ceeb0a317fa792e4d6b9296c3`.

`b11cb928-7e53-4210-9356-6d936ae0c155` official v1 from draft v2 (mom: “Edited for admin-ui 3.4 — ship Friday.”). Preview uses `reconciliation`; confirm sends `reconciliation_ops`. Export is JSON-only on this binary.

Next: 3.5 Ask + ledger-if-present + purge confirm. Prefer official over draft. Do not rebuild approve. Case A studio is stretch only.

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
