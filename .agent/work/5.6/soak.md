# 5.6 — soak checklist (agent evidence — not owner Pass)

Date: 2026-09-21. Orch `:8011` up (`health` ok, db true). UI `:5183` started for this soak. Profile `edea14e5-…` (ui-mi-demo desk).

| # | Item | Result | Notes |
|---|---|---|---|
| A1 | KB token field | **Pass** | Visible on profile |
| A2 | Import people CSV | **Skip** | No human file pick this run |
| A3 | Enable KG | **Skip** | Button visible; status off; click intercepted by toast overlay — human re-check |
| A4 | Other docs separate | **Pass** | “Other docs (standing library)” + directory copy ≠ prompt |
| B5 | Inbox confirm | **Skip** | Inbox `[]` — seed pending alias first (lab/MI.32 path) |
| B6 | Inbox reject | **Skip** | Same — empty pending |
| B7 | Insights toggles persist | **Skip** | Toggles visible default off; save/reload not exercised |
| B8 | Refresh when flags off | **Skip** | Needs meeting with draft + human Refresh |
| C9–C13 | Meeting three surfaces | **Skip** | Needs Case B → MoM → flags on; human path |
| D14 | Add terminology + list | **Pass*** | List proxy returns seeded `soak-api-term`; UI empty-state cleared after seed. UI Add button not proven (automation fill/toast). |
| D15 | No CC on MI path | **Pass** | Home copy + nav only MI |
| D16 | Dirty product switch | **Skip** | Not exercised this run |

\* Not a full owner Pass for D14 UI Add.

## Human remaining

1. Import tiny people CSV; Enable KG; confirm status after reload.  
2. Seed inbox candidate → Confirm / Reject.  
3. Enable insights flags → Case B → MoM → Summary/Feedback → edit MoM → stale → Refresh → Approve with stale.  
4. Add terminology from UI and confirm list row.

Do **not** treat this file as human owner Pass.
