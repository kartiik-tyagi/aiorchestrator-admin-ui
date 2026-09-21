# 0.1 — L4 review (Reviewer)

**Phase:** 0.1  
**Plan:** `.agent/work/0.1/plan.md`  
**Implementation:** `.agent/work/0.1/implementation.md`  
**Role:** Reviewer only — no application code this artifact  

---

## Diff vs plan

Application slice matches the plan file-touch list. Optional `src/api/cc/client.js` move was skipped; `src/api/client.js` still works (plan allowed). Extra `src/shells/ProductSwitch.jsx` is the shared switcher, not scope creep.

Untracked `docs/` and `.agent/` are L3/autopilot artifacts, not 0.1 product code. Summarizer must not fold them into the phase commit.

---

## Exit criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `/` shows exactly two product cards | **pass** | Headless Chrome: two equal cards, no sidebar |
| 2 | `/CC/admin` shows today’s dashboard and CC-only nav | **pass** | Dashboard + engines/profiles/bindings/flows/pins/settings; brand-sub Call Center; Ready for sessions |
| 3 | `/MI/admin` shows MI-only chrome and a non-broken placeholder (no CC screens) | **pass** | Home only; no tenant/engines; “Admin — later phases”; no CatalogProvider |
| 4 | Every legacy CC URL lands on `/CC/admin/…` | **pass** | `App.jsx` `Navigate replace` table; `/engines` rendered Engines under CcShell |
| 5 | `SETUP_STEPS` / dashboard setup strip links do not 404 | **pass** | All `to` values are `/CC/admin/...`; dashboard checklist rendered |
| 6 | Vite `/mi/v1` proxy present (`ORCH_URL` still overrides) | **pass** | `vite.config.js`; `curl localhost:5183/mi/v1/health` → meeting_intelligence ok |
| 7 | No CC page imports MI types; no MI file imports flow/profile validators | **pass** | Grep: MI files import neither validator; CC pages do not import `api/mi` |

---

## Locks

- Admin-ui only — no Go/SQL/catalog/orchestrator edits  
- No new CC/MI form fields, no builder/validator/bindings/`cx` work  
- Secrets write-only unchanged  
- No Supervisor  
- CatalogProvider only inside `CcShell`  
- Hard UI rules not violated this phase  

---

## Verify (independent of Coder chat)

- `curl http://localhost:5183/v1/health` → `{"db":true,"status":"ok","store_backend":"postgres"}`  
- `curl http://localhost:5183/mi/v1/health` → `{"db":true,"product":"meeting_intelligence","status":"ok"}`  
- Grep leftover `to: '/engines'` etc. in `src` — empty  
- Builder `/CC/admin/flows/coral-telecom-limited-welcome/builder` still loads (cx write still present — in scope to leave until 1.1)  

---

## Findings

None blocking. Nit: Cursor browser MCP was unavailable; verification used headless Chrome + proxy curl.

```yaml
# agent-approval
role: reviewer
result: pass
checklist:
  - id: checked_vs_plan
    pass: true
  - id: locks_checked
    pass: true
  - id: findings_actionable
    pass: true
  - id: no_rewrite
    pass: true
blocker: null
```
