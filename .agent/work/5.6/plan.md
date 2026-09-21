# 5.6 — Plan (human soak — verification only)

## Already implemented (from git — do not redo)
- **5.1** `04f518a` — client wrappers
- **5.2** `d898e74` — directory + KG + KB token
- **5.3** `1a0648b` — inbox + insights toggles
- **5.4** `a021d7a` — MoM | Summary | Feedback + refresh
- **5.5** `abf10b4` — terminology + home legend
- No new app features in this phase

## In scope
1. Record checklist A–D from L3 with Pass / Fail / Skip + reason
2. Probe what is automatable (health, lint, page load if :5183 up)
3. Honest Skip for keyboard/human paths not executed; seed instructions for empty inbox
4. Write `ADMIN_UI_WAVE5_AUTOPILOT_DONE.md` with SHAs + soak ticks
5. No application code changes

## Out of scope
- New features
- Fake Pass
- Go fixes
- Push

## Exit criteria (L3)
1. Checklist recorded
2. Fails filed or none
3. No app commit required if verification-only

## Verify
Human + optional local soak note. Lint re-run. Do not claim owner Pass.

## Risks
- UI may be down → Skip browser ticks with reason
- Empty inbox → Skip B5/B6 with seed note

# agent-approval
```yaml
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
```
