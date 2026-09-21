# 5.2 — Plan (MI profile directory + KG enable)

## Already implemented (from git — do not redo)
- **5.1** `04f518a` — `mi.importPeopleCsv` / `exportPeopleCsv` / products twin, `enableKg`, `listEntities`, `setMiKbToken` / `getMiKbToken`, `deleteKbDoc`
- Profile detail (3.2): Desk, MoM sections, rules/memory JSON, Other KB paste, Ask
- Ingest token pattern on MeetingDetail (`orch_mi_ingest_token` + localStorage)

## In scope
1. Optional KB write token field on profile page → `localStorage` `orch_mi_kb_token` + `setMiKbToken` on change/load
2. **Directory** section above Other docs: people/products CSV import (file picker; dry-run query if supported), export download, last result counts in words
3. Optional entities table via `listEntities({ profileId, entityType })`
4. Enable KG button → `enableKg` then reload; show `rules.kb` status; copy that new jobs only
5. Relabel Other docs as standing library (not directory)
6. `miErrors.js`: `kb_unauthorized` → set KB token sentence

## Out of scope
- Memory inbox / insights flags (5.3)
- Meeting Summary/Feedback (5.4)
- Terminology (5.5)
- New client routes (use 5.1 only)
- CC UI

## Exit criteria (L3)
1. Operator can import people CSV and see entities or success counts
2. Export people/products downloads
3. Enable KG updates status copy after reload
4. 401 without token shows “set KB token” when server requires it
5. No Call Center UI edits

## Verify
```
npm run lint
# Manual: /MI/admin/profiles/:id — import tiny CSV; enable KG; Other docs still list
```

## Risks
- Dry-run / confirm_sync query params — pass through UI toggles; do not invent a second protocol
- Import result shape varies — display counts/errors generically from response fields

## Files
| File | Change |
|---|---|
| `src/pages/mi/DirectoryPane.jsx` | **New** — token + people/products + entities + enable KG |
| `src/pages/mi/ProfileDetail.jsx` | Mount Directory above Other docs; relabel Other docs |
| `src/lib/miErrors.js` | `kb_unauthorized` |

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
