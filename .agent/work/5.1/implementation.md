# 5.1 — L4 implementation (Coder)

MI client wrappers for Wave 5 routes + JSDoc types. No React pages.

## Files

| Path | Change |
|---|---|
| `src/api/mi/client.js` | KB token helper; FormData/`text/csv` import; raw CSV export; inbox confirm/reject; people/products CSV; enableKg; deleteKbDoc; entities; refreshInsights; terminology + alias confirm/reject; probe note 2026-09-21 |
| `src/api/mi/types.js` | `MemoryInboxItem`, `MiInsightsFacet`, `MiFeedback*`, `MiKbEntity`; meeting facet gains `insights` |

## Probe (live :8011, 2026-09-21)

| Route | Result |
|---|---|
| `GET /mi/v1/health` | 200 |
| `GET /mi/v1/meta` | 404 |
| `GET …/profiles/{id}/actions` | 404 |
| `GET …/memory/inbox` (missing profile) | 404 `profile_not_found` |
| `GET /mi/v1/kb/entities` | 200 |
| `GET /mi/v1/terminology` | 200 |

CSV import: string → `Content-Type: text/csv`; `Blob`/`File` → multipart `file`. enableKg body `{ step }` default `enabled`.

## Verify

```text
npm run lint
# exit 0 (pre-existing warnings only; no errors on touched files)
```

No UI file changes. No CC Bearer on MI calls. No invented `/mi/v1/meta` or actions ledger.

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
    note: API-only; lint is programme verify; probe documented
  - id: no_scope_creep
    pass: true
  - id: no_secrets
    pass: true
blocker: null
```
