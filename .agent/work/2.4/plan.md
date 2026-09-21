# 2.4 — L4 plan (Planner)

**L3:** `docs/phases/2.4_cc_polish_create_path.md`  
**Already in git:** 2.1 emptyDoc already `product: call_center` + empty catalog; flow `scaffold()` has no `cx`; FlowBuilder leave-guard exists; no `to: '/engines'` except `App.jsx` redirects. Do not re-add `cx` or seed live catalogs.

## Delta

- Dirty: Profiles snapshot + `beforeunload` + in-app leave confirm; `dirtyGuard` so ProductSwitch to `/MI/admin` confirms. FlowBuilder registers the same guard (keep existing intercept).
- Empty-state copy (operator English) on intents / unarmed globals / Inform retrieve keys.
- Profile publish toast: next pin. Dashboard first-run strip → tutorial.
- Tutorial + fieldGuide + README: `/CC/admin`, localStorage layout, intents/retrieve/no-cx. Tutorial must not say Go ignores `cx`.
- Flow create UI note: industrial fields in the builder. Scaffold stays cx-free.
- Verify on **new** `ui-sync-demo*` ids only; delete pin → flow → profile → binding after smoke. Do not overwrite `coral-*`.

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
