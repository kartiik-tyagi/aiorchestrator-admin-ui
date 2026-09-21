# 3.4 — L4 plan (Planner)

**L3:** `docs/phases/3.4_mi_draft_approve.md`  
**Contracts:** `docs/meeting-intelligence/08_API_CONTRACTS.md` §7; live draft on `b11cb928-7e53-4210-9356-6d936ae0c155`; `internal/mi/facade/approve.go` + `approve_test.go`.  
**Prior:** 3.3 Closed `3803022` — do not rebuild list/Case B/transcript.

## Already implemented (from git) — do not redo

| Keep | Notes |
|---|---|
| `MeetingDetail.jsx` Overview + Transcript + Case B + poll | Add tabs only |
| `mi.getDraft` / `patchDraft` / `approvePreview` / `approveConfirm` / `getOfficial` / `getOfficialHistory` / `exportMeeting` | Client exists; extend export query only |
| Lab meeting `b11cb928-…` | `draft.ready`, version 1, mom section `decisions` / “No explicit decisions…” |

## Live draft shape (bind to this)

`GET /draft` → `{ id, meeting_id, version, mom: { sections: [{ id, title, body }] }, decisions: Claim[], actions: Claim[], quality_flags }`.  
Claim: `{ id, text, origin, owner_display_name?, due_date? }`.  
`PATCH` body: `{ mom?, decisions?, actions? }` — send the **whole** loaded object for each key you change (PROGRAMME: never reconstruct from empty). Server `forceReviewerAuthored` rewrites claim `origin` on PATCH (except `carry_forward_ref`).

## API names (do not invent)

- Preview `POST …/approve` `{ approver_label? }` → `{ draft_id, draft_version, approver_label, reconciliation[] }` (**not** `reconciliation_ops` on the response).
- Confirm `POST …/approve/confirm` `{ draft_id, draft_version, approver_label?, reconciliation_ops }` — send the preview list as `reconciliation_ops`.
- Unsupported: preview/confirm **409** `unsupported_ai_present`. Gate also scans `decisions`/`actions` `origin === unsupported_ai` and **names those fields before** Approve. Confirm stays disabled while any remain.
- Official `GET …/official` (`no_official` 404 is empty state). History `{ officials: [] }`.
- Export this binary: **`?format=json` only** (markdown → 400). Download the JSON. Offer markdown; if 400, say only json on this lab.

`PATCH` has **no** server version check. Version conflict is on **confirm**. For two-tab PATCH: GET current version first; if ≠ editor’s loaded version, refuse and say reload.

## Scope

1. `src/lib/miDraft.js` — `unsupportedFields(draft)`, `opSentence(op)` for create/update/close/leave_open (server labels only).
2. `src/pages/mi/DraftEditor.jsx` — render mom sections + decisions + actions from payload (no invented section ids). Highlight `unsupported_ai`. Save PATCH. Show `version`. Reload-on-conflict copy.
3. `src/pages/mi/ApproveWizard.jsx` — “Review for approve” (step 1) then checklist of `reconciliation[]` then “Confirm official” (step 2). Confirm disabled if unsupported fields or preview 409. Success: “Official version N is locked.”
4. `src/pages/mi/OfficialPane.jsx` — read-only official + history. Copy: “Official is immutable. Ask prefers official over draft.”
5. `MeetingDetail.jsx` — tabs Draft | Approve | Official (plus existing Overview/Transcript). Export button on Official.
6. `src/lib/miErrors.js` — `unsupported_ai_present`, `draft_version_conflict`, `no_draft`, `no_official`.
7. `exportMeeting(id, { format, draft })` query.

## Out of scope

- Ask / sessions / purge (3.5)
- Case A media
- PATCH official
- Collapsing preview+confirm into one click
- CC screens
- Go/SQL/catalog

## Exit criteria (L3)

1. Edit one MoM sentence on `b11cb928-…` → PATCH → GET version bumps (1→2).
2. Approve blocked while `unsupported_ai` remains, field named. Scanner unit-tested. Live PATCH cannot inject this origin (server rewrite) — UI still gates on loaded payload + 409.
3. Confirm → official GET matches approved draft; history lists the official row (prior row if a second approve happens).
4. Export downloads JSON (`?format=json`).
5. Stale confirm (`draft_version` behind) shows `draft_version_conflict` in words; stale PATCH refused after GET version mismatch.

## Verify

- GET draft on `b11cb928-…`; PATCH mom section body; GET version +1.
- Preview + confirm on that meeting (clean draft).
- GET official + history; GET export?format=json.
- Confirm with `draft_version: 1` after a bump → 409 words.
- `node` check `unsupportedFields` names `decisions[0]` / `actions[n]`.
- Browser: Draft / Approve / Official tabs; no Ask pane.

## Risks

| Risk | Mitigation |
|---|---|
| Preview field name ≠ L3 | Bind `reconciliation` (response) → `reconciliation_ops` (confirm). |
| Cannot persist unsupported_ai via PATCH | Scan + 409; unit-test scanner. |
| Export markdown 400 | json only; do not fake markdown. |
| Approving lab meeting | Allowed for 3.4 verify; 3.5 Ask prefers official. |

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
