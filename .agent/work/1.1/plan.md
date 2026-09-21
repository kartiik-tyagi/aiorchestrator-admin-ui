# 1.1 — L4 plan (Planner)

**Phase:** 1.1  
**L3:** `docs/phases/1.1_cc_layout_out_of_document.md`  
**Programme:** `docs/phases/PROGRAMME.md` rule 2 — never write flow `cx`  
**Role:** Planner only — no application code this artifact  

---

## Already implemented (from git)

| Commit | What | Do not redo |
|---|---|---|
| `f7a918c` | first admin UI + `withLayout` → `doc.cx.layout` | Pages themselves |
| `05d7092` | builder modifications | Canvas interaction |
| `1f5ccea` | **0.1** product picker + `/CC/admin` + `/MI/admin` | Shells, routes, `/mi/v1` proxy |

Working tree after 0.1 commit: untracked `docs/` (L3) and `.agent/` only. **Nothing in git** yet stores layout in `localStorage` or strips `cx` on the wire.

---

## Goal (smallest slice)

Stop writing canvas positions into `coral.flow.v1`. Persist `{ [nodeId]: { x, y } }` in `localStorage` key `orch_cc_layout:<flowId>`. `docForWire()` must omit `cx`.

---

## In scope

1. `src/lib/layout.js`
   - Delete or invert `withLayout` (must not write `cx`).
   - Add `LAYOUT_KEY(flowId) => orch_cc_layout:<flowId>`.
   - `readLocalLayout(flowId)` / `writeLocalLayout(flowId, layout)` — try/catch; private mode = no-op write, empty read.
   - `withoutCx(doc)` — omit `cx` (and do not copy it).
   - `resolveLayout(doc, flowId)`: localStorage first; if empty and `doc.cx.layout` exists, **migrate once** (copy into LS); then leftover `cx` for missing ids; then `autoLayout` for the rest. Do not fail save if LS throws.
   - Keep `autoLayout` as-is.
2. `src/pages/FlowBuilder.jsx`
   - On load / `replaceDoc` / `applyJson` / `loadVersion`: `resolveLayout(d, flowId)`, then `setDocState(withoutCx(d))` so in-memory draft has no `cx`.
   - Persist LS on node drag and on save/publish (after computing rounded live-node positions).
   - `docForWire = () => withoutCx(doc)` — never merge layout into the document. Also strip if Advanced JSON still has `cx`.
   - Relayout: `resolveLayout({ ...doc, cx: undefined }, flowId)` then write LS; do not put `cx` back on `doc`.
   - On node-id rename (existing `setLayout` remap): also rewrite the LS map for that flow.
   - Replace JSON help text that says Go/runtime never reads `cx`.
   - Fix comment “Moving a node … changes cx.layout”.
3. `src/pages/builder/Inspector.jsx` — rename must **not** write `d.cx.layout`. Remap happens via FlowBuilder layout state + LS (Inspector already receives `onRename` path that updates edges; stop mutating `cx`).
4. `README.md` — canvas layout is browser-local; kernel rejects non-empty `cx` (CC.2 / `validateCXRejected`).
5. `src/api/types.js` — JSDoc on `FlowDocument.cx` must not say the runtime ignores it. Mark as rejected / must not be sent.

Do **not** change node/edge JSON, validators (except the strip), or MI files.

---

## Out of scope

- New node fields (2.2), full validator truth (1.3), profile draft load (1.2)
- Shared layout across browsers
- Putting positions in `conversation_policy` or any published field
- MI screens

---

## File touch list

| File | Action |
|---|---|
| `src/lib/layout.js` | LS helpers, `resolveLayout(doc, flowId)`, `withoutCx`, remove `withLayout` write |
| `src/pages/FlowBuilder.jsx` | `docForWire`, load/migrate/strip, persist on drag/save, help text |
| `src/pages/builder/Inspector.jsx` | Rename without `cx` |
| `README.md` | Correct layout story |
| `src/api/types.js` | Honest `cx` JSDoc |

---

## Exit criteria (from L3 — testable)

1. `docForWire()` JSON has no `cx` key (or omitted/null).
2. Publish of a live inbound draft no longer returns `cx` / `policy_validation_failed` **when the rest of the graph is already valid**. If publish still fails for **other** validator reasons, GET draft after save must still have no `cx` — that satisfies the `cx` gate; do not fake a green publish.
3. Dragging a node, reload, positions restore **in this browser**.
4. Relayout does not reintroduce `cx` on the next save.
5. README / builder help / types JSDoc no longer claim Go ignores `cx`.

---

## Verify (Coder + Summarizer)

- Grep `withLayout`, `cx.layout` writes, “runtime never reads `cx`”, “Go ignores”.
- Open `http://localhost:5183/CC/admin/flows/coral-telecom-inbound/builder`.
- Move two nodes → Save draft → `GET /v1/flows/coral-telecom-inbound/draft?tenant_id=default` → no `cx`.
- Publish only if client errors are empty **and** server accepts; otherwise record the non-cx error. Hard refresh → positions stay.
- Optional incognito: auto-layout, no crash.
- `curl` draft after save must not contain `"cx"`.

---

## Risks

| Risk | Mitigation |
|---|---|
| Advanced JSON still includes `cx` | Strip on `docForWire` / `withoutCx` |
| localStorage quota / private mode | try/catch; fall back to auto-layout; save still succeeds |
| Operator exported JSON with `cx` | Migrate on load; do not promise shared positions |
| Live inbound graph may fail publish for non-cx reasons (Decide/globals) | Exit 2: prove `cx` is gone on GET; do not claim full publish if other errors remain |
| Rename forgets LS key | Remap layout state + `writeLocalLayout` in the existing rename handler |

---

## Architecture refs

- L3 `docs/phases/1.1_cc_layout_out_of_document.md`
- PROGRAMME.md hard rule 2
- Backend (read-only): `internal/flow/policy.go` `validateCXRejected`; `internal/flow/doc.go` `CX` is legacy opaque policy, not canvas

---

## Handoff

Ready for **Coder** on **1.1**. Implement this plan only.

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
