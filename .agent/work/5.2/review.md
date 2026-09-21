# 5.2 — L4 review (Reviewer)

Compared DirectoryPane + ProfileDetail + miErrors to plan.md and L3 `5.2_mi_profile_directory.md`.

| Exit criterion | Result |
|---|---|
| Import people CSV → entities or success counts | **pass** — file input → `importPeopleCsv`; `summarizeImport` + entities reload |
| Export people/products downloads | **pass** — Blob download `people.csv` / `products.csv` |
| Enable KG updates status after reload | **pass** — `enableKg` then `onProfileReload`; status from `rules.kb` |
| 401 without token → set KB token | **pass** — `kb_unauthorized` in miErrors; toast uses `miErrorSentence` |
| No Call Center UI edits | **pass** |

Locks: Directory above Other docs; token shared via module + localStorage; copy states identity ≠ prompt; no auto-confirm; no inbox/insights (5.3).

Findings: none blocking. Nit: TextField `autoComplete` prop unused (ignored) — non-blocking.

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
