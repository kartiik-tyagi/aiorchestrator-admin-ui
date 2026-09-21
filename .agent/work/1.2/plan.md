# 1.2 — L4 plan (Planner)

**Phase:** 1.2  
**L3:** `docs/phases/1.2_cc_bindings_retrieve.md`  
**Programme:** never DELETE bindings; never reconstruct docs from empty/slim forms  
**Role:** Planner only — no application code this artifact  

---

## Already implemented (from git)

| Commit | What | Do not redo |
|---|---|---|
| `1f5ccea` | 0.1 shells / routes | Paths already `/CC/admin/bindings` |
| `9a5cd70` | 1.1 layout out of `cx` | Do not touch `layout.js` / builder |

Bindings page still: entry editor is id / questions / text; new entries `{ questions: [] }`; Delete calls `api.deleteBinding`; `setEntry` already spreads `...e` (keep that).

---

## Goal (smallest slice)

Persist retrieve keys on every inline_faq entry: `aliases`, `intents`, `department`, `product`. Remove Delete. Save sends the edited `entries` array as-is.

---

## In scope

1. `Bindings.jsx` — per-entry identity row (id, department, product); intents + aliases + questions chips; locale text. New entry template includes empty arrays/strings for all four retrieve fields plus `id`/`questions`/`text`. Hint: “These fields are how the bot finds the answer — not just the words.” Intent helper: “Must match an intent id on the profile that will use this binding.” Intent chips: `^[a-z0-9][a-z0-9_]{0,63}$` (drop/refuse invalid). Optional suggestions from other entries on this binding (no required profile fetch).
2. Remove Delete control + `removeBinding`. Keep Disable / Enable.
3. `types.js` — `InlineFaqEntry` gains `aliases`, `intents`, `department`, `product`.
4. `client.js` — remove `deleteBinding`.
5. `fieldGuide.js` — document the four retrieve fields.

**Do not** rebuild `{ id, questions, text }` on save. Keep `setEntry` spread. Do not send `api_key`. Do not change http_retrieve / CRM.

---

## Out of scope

- http_retrieve extras, CRM shape, Inform runtime, 1.3 validators, MI, profile industrial form (2.1)

---

## File touch list

| File | Action |
|---|---|
| `src/pages/Bindings.jsx` | Fields; remove delete; new-entry defaults |
| `src/api/types.js` | Typedef |
| `src/api/client.js` | Drop `deleteBinding` |
| `src/lib/fieldGuide.js` | Retrieve copy |

---

## Exit criteria (from L3)

1. Saving `product-faq` without touching extra fields leaves `intents`, `department`, `product`, `aliases` intact.
2. A new entry can set all four retrieve fields and they survive reload.
3. Delete binding control is gone; Disable / Enable still works.
4. Types/docs match the Go entry shape.

---

## Verify

- GET `/v1/bindings/product-faq` — note one entry’s retrieve keys.
- After implementation, no-op Save (UI) → GET again → same keys. If a scripted PUT is blocked, prove save payload is `entries` as loaded (`...e`) and do a GET-only compare of the current lab data.
- Grep: no Delete binding button; no `deleteBinding`.

---

## Risks

| Risk | Mitigation |
|---|---|
| Slim rebuild drops unknown keys | Always `{ ...e, ...p }`; save `entries` array |
| No-op save still 404s if binding missing | Use live `product-faq` |
| Intent chip typos | Pattern gate on add |

---

## Architecture refs

- L3 `docs/phases/1.2_cc_bindings_retrieve.md`
- PROGRAMME: no DELETE bindings
- Read-only: `inlineFAQEntry` in inform.go; no DELETE in control server

---

## Handoff

Ready for **Coder** on **1.2**.

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
