# 3.5 — L4 plan (Planner)

**L3:** `docs/phases/3.5_mi_ask_ledger_purge.md`  
**Prior:** 3.4 Closed `00a0c51` — official v1 on `b11cb928-…`. Do not rebuild approve.

## Already implemented

- `mi.meetingAsk` / `profileAsk` / session + `retentionPurge` client methods (3.1).
- Meeting/profile pages without Ask.
- Probe: `GET /mi/v1/profiles/{id}/actions` **404** (3.1 + re-probe 2026-09-19). **Hide ledger.**

## Live Ask (this lab)

`POST …/meetings/b11cb928-…/ask` `{ question: "what did we decide about Friday?" }` → citation `official_field_ref` snippet “ship Friday.”  
Nonsense → `abstained: true`, `citations: []`, answer `not found in available evidence`. UI copy: **“Not in the official archive.”** (not a red error).

Sessions: `POST …/ask/sessions` → `{ id, scope }`; turns `{ question }` → `{ seq, turn_id, answer, abstained, citations }`; GET `{ session, turns[] }`.

Purge: `POST /mi/v1/retention/purge` — **no body** (`retention.go` ignores JSON). Response `{ purged_generations, deleted_segments }`. Empty `retention` / `transcript_days: 0` is a no-op (test `TestRetention_ZeroDisabledNoop`). Still require typed `PURGE` in the UI. Do not put Purge on the dashboard next to New meeting.

## Scope

1. `src/pages/mi/AskPane.jsx` — one-shot + session thread. Copy: “Each turn re-reads the archive.” Citations list (`kind`, snippet). Abstain = honesty.
2. Mount on `MeetingDetail` (Ask tab; disable if `cancelled` or no transcript/draft/official) and `ProfileDetail`.
3. `src/pages/mi/Retention.jsx` + `MiShell` route `/MI/admin/retention` in a muted footer. Two-step + type `PURGE`. Show counts. No keyboard shortcut.
4. **No** `ActionLedger.jsx` — probe 404.
5. **No** lab-sfu/mcu (stretch absent).
6. Client comment remains: actions 404.

## Out of scope

- Case A studio / media WS
- CC chat
- Inventing citations
- Firing purge as a required data-destroying verify (UI gate + optional no-op POST)

## Exit criteria

1. One-shot + session Ask on official meeting `b11cb928-…`.
2. Abstain shows “Not in the official archive.” + empty citations.
3. Ledger hidden (404).
4. Purge: `purge` disabled; `PURGE` enabled; not one-click.
5. No Engineer lab-sfu control.

## Verify

- One-shot Friday → citation; xyzzy → abstain.
- Session: two turns; GET session has both.
- Profile Ask on `edea14e5-…`.
- Retention page: wrong confirm stays disabled.
- Optional POST purge → counts (expect 0 on this profile).

## Risks

| Risk | Mitigation |
|---|---|
| Purge on a profile with days set | Lab `ui-mi-demo` retention `{}` → no-op. Still typed confirm. |
| Ask 4xx on cancelled | Disable with lifecycle reason. |

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
