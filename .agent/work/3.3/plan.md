# 3.3 — L4 plan (Planner)

**L3:** `docs/phases/3.3_mi_meetings_caseb.md`  
**Programme:** `docs/phases/PROGRAMME.md`  
**Contracts (read-only):** `com.coraltele.aiorchestrator/docs/meeting-intelligence/08_API_CONTRACTS.md` §§4–6, 9; Case B body from `internal/mi/facade/caseb_test.go` (coral + 2 attributed segments).  
**Prior:** 3.2 Closed `a9e2223` — leave `ui-mi-demo` / `edea14e5-f248-42d8-9287-bfee63d84e13` + Policy KB.

## Already implemented (from git) — do not redo

| Commit | Keep |
|---|---|
| `f798490` 3.1 | `src/api/mi/client.js` meeting methods (`listMeetings`, `createMeeting`, `getMeeting`, lifecycle, `pushTranscripts`, `getTranscript`, `regenerate`). `GET /mi/v1/meta` still 404. |
| `a9e2223` 3.2 | `/MI/admin/profiles` + KB. No profile delete. Do not reuse CC Profiles.jsx. |
| `1f5ccea` 0.1 | `/MI/admin` shell + `/mi/v1` proxy. Meetings nav was ComingNext. |

Do **not** add draft/approve/Ask panes (3.4 / 3.5). Do **not** edit CC validators/builder.

## Scope (smallest slice)

1. **`src/lib/miLifecycle.js`** — legal buttons from last GET:
   - Start capture: `lifecycle === created` only (not the default operator path).
   - End / Cancel: `created` or `capturing`.
   - Regenerate: only when `transcript.authoritative_generation` is set (server: sealed gen).
   - Still handle `invalid_lifecycle` in toasts.
2. **`src/pages/mi/Meetings.jsx`** — `/MI/admin/meetings`
   - List `GET /mi/v1/meetings?profile_id=` with a profile filter that writes the query string.
   - Columns: title, profile, lifecycle, job state, draft/official chips. List API returns `Meeting` (not a facet); enrich each row with `GET /mi/v1/meetings/{id}` so job/draft/official chips are real.
   - Create `POST /mi/v1/meetings` (`profile_id`, `external_meeting_id`, `participant_namespace`, optional `title`). Copy: creating **snapshots** the profile.
3. **`src/pages/mi/MeetingDetail.jsx`** — `/MI/admin/meetings/:id`
   - Tabs/cards: Overview + Transcript only.
   - Header/facet: id, profile_id, external_meeting_id, title, lifecycle, partial_capture, authoritative generation, job `{id,state,error_code}`, draft.ready, official.official_version.
   - Poll `GET` every 4s while the page is open and the job is **not** terminal (`queued`/`running`/etc.). Pause when `document.hidden`. Clear interval on unmount.
   - Case B: textarea prefilled with the **caseb_test.go** fixture (do not invent speakers). Visible copyable `Idempotency-Key`; New key button; optional `X-MI-Ingest-Token` in localStorage `orch_mi_ingest_token` (not logged). POST shows `accepted`, `generation`, `decision`, `job_id`. Decision chips: green `accepted_supersede`, grey `deduped_noop` / `stored_candidate`, red `rejected`.
   - If an authoritative generation already exists, warn that a new push may **supersede** (do not hide Case B).
   - Transcript pane: `GET …/transcript?generation=`; ordered seq / display_name / text; generation picker from facet generations.
4. **`src/shells/MiShell.jsx`** — Meetings nav + `meetings` / `meetings/:id` routes. Remove ComingNext for this path.
5. **`src/api/mi/client.js`** — only if headers/query are incomplete: `listMeetings(?profile_id=)`, `pushTranscripts` + `Idempotency-Key` + optional ingest token.
6. **`src/lib/miErrors.js`** — sentences for `invalid_lifecycle`, `ingest_unauthorized`, `attribution_failed`, `insufficient_transcript` (no new product words).

Optional extracts (`CaseBPanel.jsx`, `TranscriptPane.jsx`) only if the detail file stays readable without them.

## Out of scope

- Draft editor / approve / official / export (3.4)
- Ask / ledger / purge (3.5)
- Case A media WS / lab-sfu / lab-mcu
- Building a transcript from an empty form
- SSE `…/events`
- Supervisor / CC flow/pin screens
- Go / SQL / catalog edits

## Exit criteria (L3, testable)

1. Create meeting on `ui-mi-demo` (`edea14e5-f248-42d8-9287-bfee63d84e13` or any profile) → row appears in the list (title, profile, lifecycle, job/draft/official chips).
2. Case B fixture stores; Transcript pane shows the two attributed segments (Alice / Bob).
3. Second push with the **same** Idempotency-Key shows `deduped_noop`.
4. Cancel / End follow lifecycle; Start/End/Cancel/Regenerate are not offered when illegal (`created` vs `capturing` vs `ended`/`cancelled`).
5. Job state on the workspace updates without a full page reload (poll + post-action GET).

## Verify

- `GET http://localhost:5183/mi/v1/health` via Vite proxy.
- Create meeting on the lab profile; list `?profile_id=` includes it.
- POST Case B fixture twice with the same `Idempotency-Key` → second `deduped_noop`.
- `GET …/transcript` has two ordered segments.
- End (or Cancel) a created meeting; illegal buttons gone after GET.
- Confirm poll interval is cleared on unmount (code review + no leaked timers after leaving the page).
- Browser: `/MI/admin/meetings` create → workspace Overview + Transcript. No Draft/Approve/Ask panes.

## Risks

| Risk | Mitigation |
|---|---|
| Fixture shape wrong | Copy `caseb_test.go` good body (`provider_id=coral`, `content_revision=r1`, Alice/Bob). |
| Lab requires ingest token | Optional header field + localStorage. |
| List JSON has no job/draft | Enrich rows with facet GET (lab lists are small). |
| Fast poll load | 4s; pause when tab hidden; stop when job terminal. |
| MoM LLM slow | Never wait on HTTP for full minutes — poll facet only. |

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
