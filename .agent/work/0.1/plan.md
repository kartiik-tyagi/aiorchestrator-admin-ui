# 0.1 — L4 plan (Planner)

**Phase:** 0.1  
**L3:** `docs/phases/0.1_product_home_shells.md`  
**Programme:** `docs/phases/PROGRAMME.md`  
**Role:** Planner only — no application code this artifact  

---

## Already implemented (from git)

`git log --oneline -20` on `aiorchestrator-admin-ui` `main`:

| Commit | What | Do not redo |
|---|---|---|
| `f7a918c` | first commit — Vite React admin, pages, client, validators | Existing CC screens |
| `05d7092` | flow builder modification | Canvas / Inspector behaviour |

Working tree (not prior-phase Closed work):

- `README.md` modified (phase-plan pointer) — not 0.1 shell
- Untracked `docs/phases/*` (L3 + this AUTOPILOT) — do not treat as coded 0.1
- Untracked `.agent/` — artifacts only; Summarizer should not commit `.agent/work/`

**Nothing in git yet** implements product picker, `/CC/admin`, `/MI/admin`, or `/mi/v1` proxy. Current app is a single shell at `/`, `/engines`, …

---

## Goal (smallest slice)

Split the existing single shell into a product picker plus two product shells. **No** new CC or MI form fields. Layout still writes `cx` (1.1). Bindings/validators unchanged.

---

## In scope

1. `/` — two equal cards: Call Center (“Answer phone calls”) / Meeting Intelligence (“Minutes and Ask on meetings”). No CC sidebar on this page.
2. `CcShell` — move today’s Shell (sidebar, topbar, `CatalogProvider`, CC routes). Brand-sub **Call Center**. Nav paths under `/CC/admin`. Ctrl+B collapse stays here.
3. `MiShell` — own sidebar + token topbar only (no tenant, no “Ready for sessions”). Brand-sub **Meeting Intelligence**. Placeholder home only. **No** `CatalogProvider`. No fake MI CRUD.
4. Product switcher on both shells: Call Center | Meeting Intelligence.
5. Locked routes from L3 (exact).
6. `Navigate replace` legacy: `/engines`, `/profiles`, `/flows`, `/flows/:flowId/builder`, `/bindings`, `/pins`, `/settings`, `/tutorial` → `/CC/admin/…`. `/CC` → `/CC/admin`. `/MI` → `/MI/admin`. Unknown `/CC/*` or `/MI/*` → that product home; else `/`.
7. Update every in-app `to`/`Link`: `setupSteps.js`, `fieldGuide.js`, Dashboard, Pins, Tutorial, Flows, FlowBuilder, App nav.
8. Vite: add HTTP proxy `/mi/v1` → `ORCH` (same as `/v1`). Keep `/v1` and `/edge`.
9. `src/api/mi/client.js` stub commenting that 3.1 fills it. Keep `src/api/client.js` working. Optional: move to `src/api/cc/client.js` and re-export from old path — **only if it does not break imports**. Prefer re-export if moved.
10. README: `localhost:5183` + new paths.

Do **not** rename `Dashboard.jsx` / other page files.

---

## Out of scope

- Any new CC/MI form fields, builder, validators, bindings retrieve, `cx` fix
- MI health display (optional curl only)
- CatalogProvider on MI
- CSS redesign
- Supervisor, Go, catalog
- Phases 1.1–4.2

---

## File touch list

| File | Action |
|---|---|
| `src/App.jsx` | Routes + compose shells + picker |
| `src/pages/Home.jsx` | **New** picker |
| `src/shells/CcShell.jsx` | **New** (today’s Shell) |
| `src/shells/MiShell.jsx` | **New** placeholder |
| `src/pages/mi/Home.jsx` | **New** if cleaner than inline MiShell placeholder — still no CRUD |
| `src/lib/setupSteps.js` | `/CC/admin/...` |
| `src/lib/fieldGuide.js` | `/CC/admin/...` |
| `src/pages/Dashboard.jsx` | Links |
| `src/pages/Pins.jsx` | Builder links |
| `src/pages/Tutorial.jsx` | Links |
| `src/pages/Flows.jsx` | Builder link |
| `src/pages/FlowBuilder.jsx` | Back to flows |
| `vite.config.js` | `/mi/v1` |
| `src/api/mi/client.js` | Stub |
| `src/api/cc/client.js` | Optional move + re-export |
| `README.md` | Paths |
| `src/styles.css` | Picker cards only if existing classes are not enough (minimal) |

---

## Exit criteria (from L3 — testable)

1. `/` shows exactly two product cards.
2. `/CC/admin` shows today’s dashboard and CC-only nav.
3. `/MI/admin` shows MI-only chrome and a non-broken placeholder (no CC screens).
4. Every legacy CC URL listed in L3 lands on the equivalent `/CC/admin/…` page.
5. `SETUP_STEPS` / dashboard setup strip links do not 404.
6. Vite `/mi/v1` proxy is present (`ORCH_URL` still overrides the target).
7. No CC page imports MI types; no MI file imports flow/profile validators.

---

## Verify (Coder + Summarizer)

- Grep leftover `to: '/engines'` etc. (except redirect table in `App.jsx`).
- Browser `http://localhost:5183/`: picker → CC dashboard; picker → MI placeholder; switcher both ways.
- `http://localhost:5183/engines` ends at `/CC/admin/engines`.
- Live builder URL under `/CC/admin/flows/<id>/builder` still loads (cx write OK).
- `curl http://localhost:5183/v1/health` still orch health.
- Optional: `curl http://localhost:5183/mi/v1/health`.

---

## Risks

| Risk | Mitigation |
|---|---|
| Missed hard-coded `/engines` | Grep `to: '/`, `Link to="/`, `href="/` before Reviewer |
| CatalogProvider on root | Provider only inside `CcShell` |
| Vite IPv6 | Docs/verify use `localhost` not `127.0.0.1` for the UI |
| Unrelated dirty `docs/` / `.agent/` | 0.1 commit = application shell (+ README path note). Do not require committing `.agent/work`. |

---

## Architecture refs

- L3 `docs/phases/0.1_product_home_shells.md`
- `docs/phases/PROGRAMME.md` (two products, no mixed nav)
- Orchestrator doc 13 (consoles) — read only; do not restore desk UIs
- MI doc 01 / 08 — read only; no `/mi/v1` UI yet

---

## Handoff

Ready for **Coder** on **0.1**. Implement this plan only.

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
