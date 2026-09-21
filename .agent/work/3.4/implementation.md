# 3.4 — L4 implementation (Coder)

Draft / two-step approve / official / JSON export on the 3.3 workspace. No Ask.

## Files

| Path | Change |
|---|---|
| `src/lib/miDraft.js` | **New** — `unsupportedFields`, `opSentence`, mom/claim parse |
| `src/pages/mi/DraftEditor.jsx` | **New** — sections + claims from payload; PATCH whole mom/decisions/actions; GET version guard |
| `src/pages/mi/ApproveWizard.jsx` | **New** — Review then Confirm; Confirm off while unsupported; maps `reconciliation` → `reconciliation_ops` |
| `src/pages/mi/OfficialPane.jsx` | **New** — official + history + export json; markdown 400 copy |
| `src/pages/mi/MeetingDetail.jsx` | Draft / Approve / Official tabs |
| `src/lib/miErrors.js` | unsupported / version conflict / no_draft / no_official |
| `src/api/mi/client.js` | export `?format=`; parse `{error,message}` string codes |

Lab: `b11cb928-…` PATCH mom v1→2, confirm official v1.

## Verify

```text
node miDraft unsupportedFields → decisions[0]
PATCH draft body → version 2
POST approve → reconciliation[]
POST approve/confirm → official_version 1
GET official + history n=1
GET export?format=json kind=official
stale confirm draft_version=1 → draft_version_conflict
export?format=markdown → only format=json
Browser tabs: Overview Transcript Draft Approve Official
```

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
