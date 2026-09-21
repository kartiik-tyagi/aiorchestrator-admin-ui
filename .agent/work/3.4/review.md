# 3.4 — L4 review (Reviewer)

Compared plan + diff to L3. Did not edit application source.

| # | Criterion | Result |
|---|---|---|
| 1 | Edit draft → version bumps | **pass** — PATCH v1→2 on `b11cb928-…` |
| 2 | Approve blocked while unsupported_ai, field named | **pass** — `unsupportedFields` names `decisions[0]`; Confirm disabled; 409 copy. Live PATCH cannot inject origin (server rewrite) — residual, not a UI miss |
| 3 | Confirm → official GET matches; history row | **pass** — official v1; history n=1 |
| 4 | Export downloads | **pass** — `?format=json` kind=official; markdown 400 honest |
| 5 | Stale confirm/patch in words | **pass** — confirm v1 after bump → `draft_version_conflict`; editor GET-guard before PATCH |

Two HTTP steps. No official PATCH. No Ask. Preview field `reconciliation` mapped to confirm `reconciliation_ops`.

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
