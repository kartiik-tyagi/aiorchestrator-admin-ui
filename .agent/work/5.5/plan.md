# 5.5 — Plan (terminology glossary + home trust legend)

## Already implemented (from git — do not redo)
- **5.1** `listTerminology` / `createTerminology` / alias confirm-reject wrappers
- **5.3** Memory inbox as confirm queue for kb_alias + term_alias
- **5.4** Meeting Summary/Feedback trust separation
- Dashboard health + profile/meeting counts (3.1)

## In scope
1. `TerminologyPane.jsx` — list GET terminology by profile_id; add POST; copy on STT→MoM / raw transcript immutable; link to Memory inbox (no second confirm queue)
2. Mount on ProfileDetail below Directory/Inbox
3. Dashboard trust legend: MoM / Summary / Feedback one-liners (Summary ≠ Official)
4. Skip cross-profile inbox fan-out (expensive); profile inbox badge already in 5.3
5. Skip meeting-list stale column unless list payload already has insights (assume not)

## Out of scope
- `/mi/v1/lab/*` Learning Lab UI
- Embeddings/PDF/auto-confirm
- Competing terminology-only confirm queue

## Exit criteria (L3)
1. Add a term + see it listed
2. Operator can reach inbox for pending aliases
3. Home legend does not claim Summary is Official
4. Lint clean

## Verify
```
npm run lint
```

## Risks
- Kind enum drift — free-text kind field; do not hard-code closed enum

## Files
| File | Change |
|---|---|
| `src/pages/mi/TerminologyPane.jsx` | **New** |
| `src/pages/mi/ProfileDetail.jsx` | Mount glossary |
| `src/pages/mi/Dashboard.jsx` | Trust legend |

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
