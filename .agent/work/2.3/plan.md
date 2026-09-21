# 2.3 — L4 plan (Planner)

**L3:** `docs/phases/2.3_cc_dashboard_pins.md`  
**Already in git:** `83a4175` 2.2 inspector/validate. Dashboard checklist + Pins bulk PUT + chat smoke already exist (`1f5ccea` paths). Do not redo those.

## Delta

- Dashboard: map `platform/status` blockers to `/CC/admin/…` buttons; amber warnings (empty pin-profile `intent_catalog`; published flow Inform without binding/retrieve keys; `kind=global` edges with empty `globals`). Copy: Server Ready can still refuse calls without a pin. Cache warning GETs; Refresh already reloads.
- Pins: `getAnswerPin` / `putAnswerPin` / `deleteAnswerPin`; per-row Save this pin; DELETE with confirm; keep bulk “Save all”. Smoke always `stop`. Empty spoken: “Bot said nothing — check Entry → Speak.”
- No Supervisor. No Tutorial rewrite. Do not replace the whole pin list on a one-row save.

## Exit

1. Missing pin and missing engine each link to the right page in one click.
2. Per-row save does not rewrite other pins (unless Save all).
3. Smoke test still works (always stop).
4. No false dashboard warnings on live inbound (has catalog + globals).

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
