# 4.1 — L4 plan (Planner)

**L3:** `docs/phases/4.1_shared_polish.md`  
**Prior:** 3.5 Closed `342e92b`. No new product fields.

## Already implemented

- Shared `styles.css` + `ui.jsx`; ProductSwitch labels already “Call Center” / “Meeting Intelligence”.
- `dirtyGuard` + CC profile/builder `setDirtyGuard`. Switcher warns **CC → MI** only.
- CatalogProvider lives only in `CcShell`. FlowBuilder keydown only mounts on `/CC/admin/flows/:id`.
- Meeting poll already pauses when `document.hidden` (3.3).
- README already names both homes + `localhost:5183`.

## Scope (delta)

1. `ProductSwitch` — `confirmLeaveDirty` on **both** links (MI → CC too).
2. MI dirty: `ProfileDetail` + `DraftEditor` call `setDirtyGuard`; clear on save/unmount.
3. Copy: Meetings “snapshot stored” (not “pinned”). Keep contrast sentences that say MI is not flows/pins.
4. `README.md` — operator map table: `/CC/admin` vs `/MI/admin`, tenant/engines CC-only, Vite IPv6 localhost.
5. `MiShell` — collapse rail (same pattern as CC) so 360px is usable.
6. Grep: no mistaken CC words on MI screens; no MoM/Ask on CC screens.

## Out of scope

- New fields, Go embed, redesign, CatalogProvider on MI.

## Exit criteria

1. Shared chrome family.
2. Dirty CC → switch MI → cancel stays.
3. Dirty MI draft/profile → switch CC → same.
4. No catalog traffic on MI routes (provider not mounted).
5. Builder shortcuts not on MI meeting (listener not mounted).
6. README both homes + 5183.

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
