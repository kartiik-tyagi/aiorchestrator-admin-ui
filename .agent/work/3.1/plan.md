# 3.1 — L4 plan (Planner)

**L3:** `docs/phases/3.1_mi_client_home.md`  
**Already:** `/mi/v1` proxy (0.1). Live probe: health 200 `{status:ok,db:true,product:meeting_intelligence}`; lists empty; **meta 404**; **actions 404**. Do not add Meta/ledger screens. Do not import CC flowValidate or ProfileDocument.

## Delta

- `src/api/mi/client.js` — facade wrappers; no Bearer; no CC tenant. Probe comment: meta 404, actions 404.
- `src/api/mi/types.js`, `src/lib/miErrors.js`.
- `src/pages/mi/Dashboard.jsx` — health, counts, down copy, New profile / New meeting.
- Stub panels at `/MI/admin/profiles` and `/MI/admin/meetings` (“Coming in next phase”). Nav stays Home-only.
- Reuse `ApiError` shape; parse `{error:{}}`.

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
