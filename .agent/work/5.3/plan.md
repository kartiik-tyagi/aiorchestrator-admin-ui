# 5.3 — Plan (memory inbox + insights flags)

## Already implemented (from git — do not redo)
- **5.1** `04f518a` — `listMemoryInbox`, `confirmInboxItem`, `rejectInboxItem`
- **5.2** `d898e74` — KB token + DirectoryPane; Other docs separate
- Profile rules JSON textarea + memory policy JSON (3.2)

## In scope
1. `MemoryInbox.jsx` — list pending inbox; Confirm/Reject; optional actor_label; empty state; badge count; uses KB token from 5.2
2. Insights toggles card: `rules.insights.summary` / `rules.insights.feedback` default **off**; load→merge→PUT; strip insights from Advanced JSON editor (like min_segments) so toggles are SoT
3. Copy: confirm ≠ rewrite Official; flags off until enabled; never become Official alone
4. Document: both flags off → refresh insights returns `400 insights_disabled` (5.4)
5. `miErrors`: `insights_disabled` (+ reuse `kb_unauthorized`)

## Out of scope
- Meeting Summary/Feedback panes (5.4)
- Auto-confirm / advice_at_approve
- Defaulting flags on
- CC UI

## Exit criteria (L3)
1. Inbox lists pending items (empty OK with copy)
2. Confirm/reject round-trip removes from pending
3. Toggles persist on reload via GET profile
4. Both flags off → refresh will 400 (documented)
5. Lint clean

## Verify
```
npm run lint
```

## Risks
- Empty lab inbox — empty state is exit-OK; soak seeds in 5.6
- Dual-edit of insights in Advanced JSON — mitigated by stripping insights into toggles

## Files
| File | Change |
|---|---|
| `src/pages/mi/MemoryInbox.jsx` | **New** |
| `src/pages/mi/InsightsFlags.jsx` | **New** |
| `src/pages/mi/ProfileDetail.jsx` | Mount inbox + flags; merge insights on save |
| `src/lib/miErrors.js` | `insights_disabled` |

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
