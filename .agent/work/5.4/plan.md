# 5.4 — Plan (meeting Summary + Feedback + refresh)

## Already implemented (from git — do not redo)
- **5.1** `refreshInsights`; types for insights facet / feedback
- **5.3** `1a0648b` — insights toggles + `insights_disabled` copy
- MeetingDetail tabs: overview, Case B, transcript, draft, approve, official, Ask (3.3–3.5)
- DraftEditor MoM edit path (3.4) — do not write Summary/Feedback into PATCH

## In scope
1. Tabs: MoM (existing draft) | Summary | AI Feedback (+ keep overview/transcript/approve/official/Ask)
2. `InsightsPane.jsx` — read-only Summary + Feedback from `facet.insights`; Feedback disclaimer; abstain/empty OK
3. Stale banner when `insights.stale`; **Refresh insights** → `mi.refreshInsights` then reload facet
4. Handle `insights_disabled` / no draft; status line with versions
5. Poll while insights job non-terminal (reuse facet poll pattern) — no SSE required

## Out of scope
- Apply feedback to MoM / PATCH draft with advice
- Block Approve on stale insights
- Ask indexing of advice
- Regenerate MoM from Refresh
- SSE

## Exit criteria (L3)
1. With flags on and MoM ready, Summary and/or Feedback render from facet
2. PATCH MoM → stale until refresh (UI shows banner when facet says stale)
3. Refresh clears stale or shows failed honestly
4. Disclaimer on Feedback
5. Lint clean; no CC edits

## Verify
```
npm run lint
```

## Risks
- Thin/empty LLM output — empty states must not look like bugs
- Manual soak for stale round-trip deferred to 5.6 if lab cold

## Files
| File | Change |
|---|---|
| `src/pages/mi/InsightsPane.jsx` | **New** |
| `src/pages/mi/MeetingDetail.jsx` | Tabs + stale banner + refresh |
| `src/lib/miErrors.js` | ensure insights_disabled (done in 5.3) |

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
