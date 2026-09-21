# 0.1 — L4 implementation (Coder)

**Phase:** 0.1  
**Plan:** `.agent/work/0.1/plan.md`  
**Role:** Coder only — this artifact, not summary  

---

## What changed

Split the single-shell app into a product picker plus two product shells. No CC or MI form fields. `src/api/client.js` stayed in place (optional `cc/client.js` move skipped — existing imports keep working).

| File | Action |
|---|---|
| `src/pages/Home.jsx` | New picker — two equal cards |
| `src/shells/CcShell.jsx` | Today’s Shell + CatalogProvider + CC routes under `/CC/admin` |
| `src/shells/MiShell.jsx` | Own chrome, token topbar, no CatalogProvider |
| `src/shells/ProductSwitch.jsx` | Call Center \| Meeting Intelligence |
| `src/pages/mi/Home.jsx` | Placeholder only |
| `src/api/mi/client.js` | Stub — 3.1 fills it |
| `src/App.jsx` | Compose picker + shells + legacy `Navigate replace` |
| `src/lib/setupSteps.js` | `/CC/admin/...` |
| `src/lib/fieldGuide.js` | `/CC/admin/...` |
| `src/pages/Dashboard.jsx` | Pin link |
| `src/pages/Pins.jsx` | Builder link |
| `src/pages/Tutorial.jsx` | Links |
| `src/pages/Flows.jsx` | Builder nav |
| `src/pages/FlowBuilder.jsx` | Back to flows |
| `vite.config.js` | `/mi/v1` HTTP proxy (same `ORCH` / `ORCH_URL`) |
| `src/styles.css` | Picker + product-switch only |
| `README.md` | `localhost:5183` + new paths |

Page files (`Dashboard.jsx` etc.) were not renamed.

---

## Plan items

1. `/` two cards, no CC sidebar — done  
2. `CcShell` with brand-sub Call Center, Ctrl+B — done  
3. `MiShell` token-only topbar, placeholder, no CatalogProvider — done  
4. Product switcher on both shells — done  
5. Locked routes — done  
6. Legacy redirects — done  
7. In-app `to`/`Link` updates — done  
8. Vite `/mi/v1` — done  
9. `src/api/mi/client.js` stub; `client.js` kept — done (no move)  
10. README paths — done  

---

## Tests

None added. This phase is route/chrome only; no new validators or API wrappers. Verify is browser + grep + proxy curl.

---

## Verify

```text
rg "to: '/(engines|profiles|flows|bindings|pins|settings|tutorial)'" src
# expect empty except App.jsx redirect table (those use path= not to:)

curl http://localhost:5183/v1/health
curl http://localhost:5183/mi/v1/health

Browser http://localhost:5183/
  picker → /CC/admin dashboard
  picker → /MI/admin placeholder
  product switcher both ways
  http://localhost:5183/engines → /CC/admin/engines
  /CC/admin/flows/<id>/builder still loads
```

Vite must be restarted once so the new `/mi/v1` proxy is live.

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
