# Admin UI Wave 6 — AUTOPILOT runbook (External API Tool + Typed Listen)

**Programme:** [PROGRAMME.md](./PROGRAMME.md) + [WAVE_6_API_TOOL_GAP.md](./WAVE_6_API_TOOL_GAP.md)  
**Repo primary:** `aiorchestrator-admin-ui` (UI-only commits)  
**Backend read-only:** `com.coraltele.aiorchestrator` — Control `/v1` + doc 23 (no Go edits)  
**L3 SoT:** `docs/phases/6.1_*.md` … `6.6_*.md`  
**L4 artifacts:** `.agent/work/6.N/` (`plan.md`, `implementation.md`, `review.md`, `summary.md`, optional `blockers.md`)  
**Resume pointer:** `.agent/work/CONTINUE_WAVE6.md`  
**Prior waves:** **0.1–5.6 Closed**. Do **not** redo them.

This file is the continuous runbook for Wave 6. The **owner paste** is below. Re-read this file and `CONTINUE_WAVE6.md` at the start of every phase.

---

## Owner paste prompt (authorized)

```text
AUTOPILOT ADMIN-UI WAVE 6 AUTHORIZED — External API Tool + Typed Listen UI

PRIMARY REPO: aiorchestrator-admin-ui (UI commits only).
ORCHESTRATOR: com.coraltele.aiorchestrator is READ-ONLY (probe APIs / read docs). Do NOT edit Go, SQL, or catalog.

Read and obey every turn:
  aiorchestrator-admin-ui/docs/phases/ADMIN_UI_WAVE6_AUTOPILOT.md
  aiorchestrator-admin-ui/docs/phases/WAVE_6_API_TOOL_GAP.md
  aiorchestrator-admin-ui/docs/phases/PROGRAMME.md
  aiorchestrator-admin-ui/.agent/work/CONTINUE_WAVE6.md
  the active L3: aiorchestrator-admin-ui/docs/phases/6.N_*.md

Skills (read the skill for the role you are playing, every phase):
  C:\Users\user\.cursor\skills\coral-phase-planner\SKILL.md
  C:\Users\user\.cursor\skills\coral-phase-coder\SKILL.md
  C:\Users\user\.cursor\skills\coral-phase-reviewer\SKILL.md
  C:\Users\user\.cursor\skills\coral-phase-summarizer\SKILL.md
Also role isolation: coral-agent-planner/coder/reviewer/summarizer/commits.mdc

DESIGN LOCK:
  Backend API.0–API.9 Closed (doc 23 Locked). UI consumes Control API only.
  Secrets never in profile/flow JSON or localStorage.
  Never write flow cx. Patch-not-rebuild documents.
  Catalog-first enums; fallbacks in types.js when catalog key absent.
  Tool(api) is non-terminal; transfer/hangup remain terminal.
  Do not invent OAuth/HMAC/mTLS/XML. Do not replace Inform CRM with Tool(api) auto-migrate.
  Do not skip or merge phases.

PRIOR WORK:
  Waves 0.1–5.6 Closed. Do not redo MI memory or CC industrial screens except Wave 6 additions.

GIT:
  Branch: main (or current). Do not push.
  Commits: human author only. Message: `admin-ui 6.N: <why>`.
  No Co-authored-by / AI trailers. Never commit .env, tokens, node_modules.

LOOP:
  for each phase in 6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6:
    1. PLANNER  — .agent/work/6.N/plan.md with # agent-approval result:pass
    2. CODER    — implement THAT plan; implementation.md; verify from L3
    3. REVIEWER — review.md vs plan + L3; fail → Coder (max 2); then blockers.md STOP
    4. SUMMARIZER — re-verify; summary.md; commit `admin-ui 6.N: <why>`; update CONTINUE_WAVE6.md
  After 6.6: write .agent/work/ADMIN_UI_WAVE6_AUTOPILOT_DONE.md; STOP.

VERIFY: npm run lint. Prefer orch :8011 + npm run dev when available.
6.6 is soak — honest Skip if orch/CRM stub missing; do not fake Pass.

Begin at the phase/role named in CONTINUE_WAVE6.md.
```

---

## Agent protocol

```
while phase in [6.1, 6.2, 6.3, 6.4, 6.5, 6.6]:
  read CONTINUE_WAVE6 + this runbook + L3 + WAVE_6_API_TOOL_GAP
  if Closed in CONTINUE + git commit → skip
  Planner → plan.md
  Coder → implementation.md
  Reviewer → review.md (fail → fix ≤2 → blockers STOP)
  Summarizer → summary.md + commit + CONTINUE next
after 6.6 → ADMIN_UI_WAVE6_AUTOPILOT_DONE.md → STOP
```

### Phase intent (do not merge)

| Id | Must deliver | Must not |
|---|---|---|
| **6.1** | types + catalog typedefs + secrets client + fix `tool_result` lie + api Tool validate preview | Profile/flow React forms |
| **6.2** | Profile api_integrations + timezone/date_order form | Secrets UI |
| **6.3** | Masked secrets UI + publish gate | Flow Tool api |
| **6.4** | Tool api inspector + three edges + profile_id on publish | Tutorial |
| **6.5** | Speak template hints + ListenSlot input_type/length_rule | New APIs |
| **6.6** | Tutorial/setupSteps/fieldGuide + soak ticks | New features |

### Commit hygiene

- Summarizer only after Reviewer **pass** + verify green.
- Prefer `src/` + docs L3 fixes. Force-add `.agent/work/6.N/*` if prior waves track them.
- Do not push.
