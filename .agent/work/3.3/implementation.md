# 3.3 — L4 implementation (Coder)

Meetings list/create + workspace (Overview + Transcript). Case B fixture from `caseb_test.go`. No draft/approve/Ask.

## Files

| Path | Change |
|---|---|
| `src/lib/miLifecycle.js` | **New** — Start=`created`; End/Cancel=`created\|capturing`; Regenerate iff authoritative gen. `jobTerminal` for poll. |
| `src/pages/mi/Meetings.jsx` | **New** — `?profile_id=` filter, create snapshot copy, list columns + facet enrich for job/draft/official. |
| `src/pages/mi/MeetingDetail.jsx` | **New** — facet header, legal buttons, Case B + idempotency + optional ingest token, 4s poll (pause hidden, clear unmount), transcript pane, supersede warning. |
| `src/shells/MiShell.jsx` | Meetings nav + `meetings` / `meetings/:id`. |
| `src/api/mi/client.js` | `listMeetings(?profile_id=)`, `pushTranscripts` Idempotency-Key + ingest token, `getTranscript(?generation=)`. |
| `src/lib/miErrors.js` | `invalid_lifecycle`, ingest/attribution/quality sentences. |

Did not add Draft/Approve/Ask panes. Did not edit CC builder. Left `ui-mi-demo` profile `edea14e5-f248-42d8-9287-bfee63d84e13`.

## Verify

```text
node --input-type=module -e "import { legalActions, jobTerminal } from './src/lib/miLifecycle.js'; …"
GET http://localhost:5183/mi/v1/health → {"status":"ok","product":"meeting_intelligence"}
POST /mi/v1/meetings on ui-mi-demo → listed; Case B fixture twice same Idempotency-Key
  → accepted_supersede then deduped_noop; GET transcript 1:Alice:hello|2:Bob:world
POST …/end → ended; second end → invalid_lifecycle
POST …/cancel on a created meeting → cancelled
GET facet after job: running then succeeded (no page reload)
Browser http://localhost:5183/MI/admin/meetings — rows + filter
Browser …/meetings/b11cb928-7e53-4210-9356-6d936ae0c155 — ended: only Regenerate; Case B + supersede warn; Overview|Transcript only
```

Lab meetings created for verify: `b11cb928-…` (ended, draft ready), two cancel fixtures. Leave them.

```yaml
# agent-approval
role: coder
result: pass
checklist:
  - id: plan_followed
    pass: true
  - id: verify_commands
    pass: true
  - id: tests_or_reason
    pass: true
  - id: no_scope_creep
    pass: true
  - id: no_secrets
    pass: true
blocker: null
```
