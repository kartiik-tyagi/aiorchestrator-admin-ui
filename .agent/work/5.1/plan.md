# 5.1 — Plan (MI client memory + insights routes)

## Already implemented (from git — do not redo)
- Waves 0.1–4.2 Closed (`afc99a8` last app SHA)
- `src/api/mi/client.js` covers health, profiles, KB Other docs, meetings, draft/approve, Ask, retention
- No inbox / directory CSV / insights refresh / terminology wrappers yet

## In scope
1. Extend `request` helpers: optional KB token header; CSV body (`text/csv` or FormData); CSV export as text
2. Add client methods listed in L3 5.1 (inbox, people/products import/export, enableKg, deleteKbDoc, entities, refreshInsights, terminology)
3. JSDoc types: MemoryInboxItem, insights facet, feedback payload
4. Probe comment dated today against live `:8011`

## Out of scope
- React pages (5.2+)
- SSE
- Inventing `/mi/v1/meta` or actions ledger

## Exit criteria
1. Every Wave 5 route for 5.2–5.5 has a client method
2. Probe note documents 200/404
3. `npm run lint` clean
4. No UI file changes

## Verify
```
npm run lint
```

## Risks
- CSV multipart vs raw — match facade `readCSVBody`
- enableKG requires `{ step }` in sequence — default `enabled` for first turn-on

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
