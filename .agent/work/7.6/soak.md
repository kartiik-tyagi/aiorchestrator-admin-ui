# 7.6 soak — MI minutes (2026-09-25)

Environment: orchestrator built from the working tree (MI.37–MI.40), `HTTP_ADDR=:8012`, scratch Postgres DB `aiorch_mi_e2e` (migrations 001–030 applied), MI worker disabled, **no MI LLM configured**. Admin UI dev server on :5183 proxied to :8012. Browser: Microsoft Edge (headless) driven by playwright-core. Drafts were seeded through the store (the job pipeline needs a Sarvam Think gateway, which this environment does not have).

Result: **20/20 automated soak checks passed**, plus file-level checks below.

| # | Step | Result |
|---|---|---|
| 1 | Case B push via UI accepted; MoM job ran and failed closed (`model_invalid_output`, no LLM). Seeded draft: preview and downloaded PDF contain the same title, attendees, sections, decisions, actions, flags | PASS (LLM-dependent part not testable here) |
| 2 | Edit section, decision, owner + due → Save v2; untouched decision/action keep `ai_supported` + evidence; edited ones `reviewer_authored` | PASS |
| 3 | Two tabs: stale save → conflict dialog; Take theirs, then Keep mine → v5 | PASS |
| 4 | Edits survive tab switch; `?tab=mom` survives refresh; ← Meetings warns | PASS |
| 5 | Draft PDF, Word, Markdown, JSON downloaded; DRAFT watermark on every PDF page; docx has watermark header | PASS |
| 6 | Regenerate over edits → warning dialog → "Before regenerate" revision kept; draft unchanged after the (LLM-less) job failed | PASS |
| 7 | Soft gates must be ticked before Confirm; Official v1 → edit → Official v2; both downloadable, Official PDF has no watermark | PASS |
| 8 | Compare Official v2 vs current = no differences; restore the generated revision | PASS |
| 9 | Branding saved from the profile page (name, footer, PNG logo); oversize logo rejected in UI; company + logo + footer in PDF; branded .docx opened in Microsoft Word (COM) with 1 inline logo and the watermark header shape | PASS |
| 10 | 40 actions → 3-page PDF, table header repeated on every page, "Page x of 3" | PASS |

Not verifiable here: end-to-end MoM generation by the real LLM (step 1 first half). Everything after a draft exists was exercised against the real server and database.
