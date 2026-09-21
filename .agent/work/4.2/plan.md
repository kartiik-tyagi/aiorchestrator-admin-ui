# 4.2 — L4 plan (Planner)

**L3:** `docs/phases/4.2_dual_soak.md`  
Verification only. No new screens. Tick Pass / Skip / Fail. Do not fake live DID or owner sign-off.

## Already implemented

0.1–4.1 committed. Lab: orch :8011, Vite :5183, MI official meeting `b11cb928-…`, profile `ui-mi-demo`.

## Scope

Re-run GET/proxy/browser checks. No-op PUT of live `coral-*` documents and live DID smoke are **Skip** unless already proven this run without writing coral-* flows. Record `SOAK_LOG` locally in `.agent/work/4.2/` (not committed). Write `ADMIN_UI_AUTOPILOT_DONE.md`.

## Out of scope

New features. Claiming owner agreed. Publishing coral-telecom-inbound.

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
