# Admin UI Wave 5 — AUTOPILOT runbook (MI memory + insights)

**Programme:** [PROGRAMME.md](./PROGRAMME.md) + [WAVE_5_GAP.md](./WAVE_5_GAP.md)  
**Repo primary:** `aiorchestrator-admin-ui` (UI-only commits)  
**Backend read-only:** `com.coraltele.aiorchestrator` — `/mi/v1` + docs `15` / `08` / facade (no Go edits)  
**L3 SoT:** `docs/phases/5.1_*.md` … `5.6_*.md`  
**L4 artifacts:** `.agent/work/5.N/` (`plan.md`, `implementation.md`, `review.md`, `summary.md`, optional `blockers.md`)  
**Resume pointer:** `.agent/work/CONTINUE_WAVE5.md`  
**Prior waves:** **0.1–4.2 Closed** — do **not** redo them.

This file is the continuous / overnight runbook for Wave 5. The **owner paste** is below. The agent must re-read this file and `CONTINUE_WAVE5.md` at the start of every phase.

**Multi-root OK:** workspace may include both `aiorchestrator-admin-ui` and `com.coraltele.aiorchestrator`. **Commits and code changes only in admin-ui.** Orchestrator is for reading contracts / probing live APIs.

---

## Owner paste prompt (authorized)

Copy everything inside the fence into a **new** agent turn (prefer workspace with both repos; primary edits in `aiorchestrator-admin-ui`):

```text
AUTOPILOT ADMIN-UI WAVE 5 AUTHORIZED — MI memory + Meeting Summary + AI Feedback UI

PRIMARY REPO: aiorchestrator-admin-ui (UI commits only).
ORCHESTRATOR: com.coraltele.aiorchestrator is READ-ONLY (probe APIs / read docs/facade). Do NOT edit Go, SQL, or web/mi lab except reading.

Read and obey every turn:
  aiorchestrator-admin-ui/docs/phases/ADMIN_UI_WAVE5_AUTOPILOT.md
  aiorchestrator-admin-ui/docs/phases/WAVE_5_GAP.md
  aiorchestrator-admin-ui/docs/phases/PROGRAMME.md
  aiorchestrator-admin-ui/.agent/work/CONTINUE_WAVE5.md
  the active L3: aiorchestrator-admin-ui/docs/phases/5.N_*.md

Skills (read the skill for the role you are playing, every phase):
  C:\Users\user\.cursor\skills\coral-phase-planner\SKILL.md
  C:\Users\user\.cursor\skills\coral-phase-coder\SKILL.md
  C:\Users\user\.cursor\skills\coral-phase-reviewer\SKILL.md
  C:\Users\user\.cursor\skills\coral-phase-summarizer\SKILL.md
Also read role isolation:
  C:\Users\user\Documents\GitHub\.cursor\rules\coral-agent-planner.mdc
  C:\Users\user\Documents\GitHub\.cursor\rules\coral-agent-coder.mdc
  C:\Users\user\Documents\GitHub\.cursor\rules\coral-agent-reviewer.mdc
  C:\Users\user\Documents\GitHub\.cursor\rules\coral-agent-summarizer.mdc
  C:\Users\user\Documents\GitHub\.cursor\rules\coral-agent-commits.mdc

DESIGN LOCK (do not change):
  L2 law (kernel): docs/meeting-intelligence/15_PROFILE_MEMORY_AND_INSIGHTS.md Solution v3.
  Production UI path = /MI/admin on localhost:5183 — NOT a rewrite of :8011/mi thin lab.
  MoM = meeting truth (edit + approve). Summary = skim of this meeting only. AI Feedback = advice
  (never Official / never Ask-indexed / never PATCH into draft).
  Profile memory inbox = profile-level kb_alias|term_alias; confirm/reject; write gate = X-MI-KB-Token when env set.
  rules.insights.summary / rules.insights.feedback default OFF; independent of rules.kb.
  Refresh insights must NOT regenerate MoM. Approve must NOT block on stale insights.
  No advice_at_approve. No auto-confirm. No auto-create people. No embeddings/PDF/V2 login.
  Do not invent APIs missing from live facade.go. Do not skip or merge phases.

PRIOR WORK:
  Waves 0.1–4.2 are Closed (ADMIN_UI_AUTOPILOT_DONE.md). Do not redo CC or MI 3.1–3.5 screens.
  Kernel MI.31–MI.36 already Closed — UI consumes those APIs; do not re-implement backend.

GIT:
  Branch: main (or current admin-ui branch). Do not push.
  Commits: human author only. Message form: `admin-ui 5.N: <why>`.
  No Co-authored-by / AI trailers. If a hook appends Co-authored-by: do not amend; do not --no-verify.
  Do not fold unrelated dirty WIP into phase commits.
  Never commit .env, tokens, node_modules, or secrets.

LOOP (non-negotiable — no cheating):
  for each phase in 5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6:
    1. PLANNER  — .agent/work/5.N/plan.md with # agent-approval result:pass
                  (Already implemented from git; cite L3 exit criteria; no app code)
    2. CODER    — implement THAT plan only; implementation.md; verify from L3
    3. REVIEWER — review.md vs plan + L3 exit criteria; fail → Coder (max 2 fix loops)
                  then blockers.md and STOP if still failing
                  NEVER Summarizer after a failing review
    4. SUMMARIZER — re-run verify; summary.md; git commit `admin-ui 5.N: <why>`;
                    record SHA in summary.md; update CONTINUE_WAVE5.md to next phase
    5. Only then start the next phase id
  After 5.6: write .agent/work/ADMIN_UI_WAVE5_AUTOPILOT_DONE.md with SHAs + soak ticks; STOP.
  Do not start CC redesign, Supervisor, embed-into-Go, or kernel Go work.

VERIFY (UI programme):
  Default: npm run lint on touched files.
  Prefer orch on :8011 + npm run dev (localhost:5183) for manual/proxy checks listed in L3.
  Not go test. Do not fake 5.6 Pass — honest Skip + human steps in blockers/soak note.

PHASE INTENT (do not merge):
  5.1  mi/client.js + types: inbox, directory CSV, KG enable, insights refresh, terminology
  5.2  Profile directory people/products + KB token + Enable KG (Other docs stay separate)
  5.3  Memory inbox confirm/reject + rules.insights toggles (default off)
  5.4  Meeting MoM | Summary | Feedback panes + stale + Refresh insights
  5.5  Terminology glossary + home trust legend/badges
  5.6  Human soak only (verification; no new features)

HARD RULES:
  - One phase id in flight. Never skip Planner, Reviewer, or Summarizer.
  - Never mark Closed without green verify from the phase plan/L3.
  - CC firewall: do not change Call Center validators/builder/engines except shared chrome reuse.
  - MI firewall the other way: do not put CC flows/pins on MI screens.
  - Never write Feedback/Summary into draft PATCH.
  - Never send CC Bearer as MI ACL; V1 MI is open + optional X-MI-KB-Token for writes.
  - Do not default insights flags on in the UI.
  - Do not replace this contract with a new design.

If CONTINUE_WAVE5 says a phase is mid-flight, resume that role — do not restart Closed phases.
Begin now at the phase/role named in CONTINUE_WAVE5.md.
```

---

## Agent protocol (non-negotiable)

### Loop

```
while phase in [5.1, 5.2, 5.3, 5.4, 5.5, 5.6]:
  read CONTINUE_WAVE5.md + this runbook + docs/phases/5.N_*.md + WAVE_5_GAP.md + prior summary
  if phase already Closed in CONTINUE_WAVE5 and git has the commit → skip
  Planner → plan.md (cite L3 exit criteria; Already implemented from git)
  if plan result blocker (human/env that cannot be worked around) → STOP autopilot
  Coder → implementation.md
  Reviewer → review.md
  if review fail:
    Coder fix (same phase only); max 2 extra loops; then blockers.md and STOP that phase
  else:
    Summarizer → re-run verify; summary.md; commit "admin-ui 5.N: <why>"; record SHA
  update CONTINUE_WAVE5.md → next phase
after 5.6:
  write .agent/work/ADMIN_UI_WAVE5_AUTOPILOT_DONE.md
  stop
```

### One phase in flight

Never start 5.2 Coder before 5.1 Summarizer commit.  
Never skip Planner because “the L3 file is already detailed” — still write `.agent/work/5.N/plan.md`.

### Skills vs L3

Global coral-phase skills may mention Go/`go test`. For this programme:

- **Plan SoT** = `docs/phases/5.N_*.md` + Planner `plan.md`.
- **Verify** = phase Verify section (`npm run lint`, browser `http://localhost:5183`, curl via Vite `/mi/v1` proxy).
- Keep `npm run dev` running after client/proxy changes when needed.

### Hard rules

- UI-only commits in `aiorchestrator-admin-ui`.
- Orchestrator: **read** only (facade, doc 15/08, live probe).
- Never commit `.env`, tokens, or `node_modules`.
- Do not push.
- Do not create Redmine tickets or send mail.
- **5.6** is human soak. Tick what this agent can prove; do not fake Pass.

### Commit hygiene

- Summarizer commits only after Reviewer **pass** and re-verify **green**.
- Single `-m`; no `Co-authored-by`, `Signed-off-by`, or Cursor trailers.
- Prefer committing application `src/` + any required L3 typo fixes. Force-add `.agent/work/5.N/*` artifacts if the repo tracks prior wave work the same way; otherwise keep artifacts local and record SHA in CONTINUE.

---

## Phase intent (do not merge)

| Id | Must deliver | Must not |
|---|---|---|
| **5.1** | Client + types for Wave 5 routes + probe notes | React screens |
| **5.2** | Directory CSV + KB token + Enable KG | Inbox / insights panes |
| **5.3** | Inbox confirm/reject + insights flag toggles | Meeting Summary UI |
| **5.4** | MoM \| Summary \| Feedback + stale + refresh | Glossary rewrite / MoM regen |
| **5.5** | Terminology glossary + home legend | New APIs / lab runner |
| **5.6** | Soak ticks + DONE.md | New features |

---

## Honest limits

| Area | Autopilot realistic |
|---|---|
| 5.1–5.5 UI code + commits | Yes |
| Lint + proxy smoke if orch `:8011` up | Yes |
| 5.6 full human Case B → insights with production Think | Only if lab data + orch up; else honest Skip |
| Kernel Go / migrations / web/mi redesign | **No** |

---

## After DONE

Owner may start embed-into-Go, Supervisor, or further MI ACL — **not** under this AUTOPILOT.
