# 3.2 — L4 plan (Planner)

**L3:** `docs/phases/3.2_mi_profiles_kb.md`  
Client methods exist (`f798490`). No delete. Do not reuse CC Profiles.jsx.

Create/edit `/MI/admin/profiles` + `/:id` + KB upsert. Send full PUT. Snapshot copy. Advanced JSON for leftover rules. Verify on `ui-mi-demo` (leave it).

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
