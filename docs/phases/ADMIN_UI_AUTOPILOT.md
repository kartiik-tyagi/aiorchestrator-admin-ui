# Admin UI sync — AUTOPILOT runbook

**Programme:** [PROGRAMME.md](./PROGRAMME.md) + L3 files in this folder  
**Repo:** `aiorchestrator-admin-ui` only (no Go, no catalog, no orchestrator source)  
**L3 SoT:** `docs/phases/<id>_*.md` (OD-12-1 style)  
**L4 artifacts:** `.agent/work/<phase-id>/` (`plan.md`, `implementation.md`, `review.md`, `summary.md`, optional `blockers.md`)  
**Resume pointer:** `.agent/work/CONTINUE.md`

This file is the overnight / continuous runbook. The **owner paste** is in § Owner paste. The agent must re-read this file and `CONTINUE.md` at the start of every phase.

---

## Owner paste prompt (authorized)

Copy everything inside the fence into a **new** agent turn with workspace including `aiorchestrator-admin-ui`:

```text
AUTOPILOT ADMIN-UI 0.1–4.2 AUTHORIZED

Read and obey every turn:
  aiorchestrator-admin-ui/docs/phases/ADMIN_UI_AUTOPILOT.md
  aiorchestrator-admin-ui/docs/phases/PROGRAMME.md
  aiorchestrator-admin-ui/.agent/work/CONTINUE.md
Read the matching L4 skill before each role:
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

1. L3 source of truth is aiorchestrator-admin-ui/docs/phases/*.md — do not invent screens or APIs.
2. Run continuous four-role L4 for every phase in order, without stopping for "continue":
   0.1 → 1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 2.3 → 2.4 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 4.1 → 4.2
   For each phase:
     Planner  → .agent/work/<id>/plan.md (pass) — no app code
     Coder    → implement THAT plan only → implementation.md
     Reviewer → score every exit criterion → review.md
                (fail → Coder fix same phase; max 2 fix loops then blockers.md)
     Summarizer → re-verify independently → summary.md
                  git commit only if review pass AND verify green
                  then update CONTINUE.md and start the NEXT phase in the same session
3. Repo = aiorchestrator-admin-ui only. No Go, SQL, catalog, or orchestrator edits.
4. Product split: /CC/admin = Call Center config; /MI/admin = Meeting Intelligence.
   CC phases must not build MI CRUD (except 0.1 shell + 4.1 chrome).
   MI phases must not edit CC validators/builder except shared chrome in 4.1.
5. Hard UI rules from PROGRAMME.md: never write flow cx; never reconstruct docs from empty forms;
   never DELETE bindings; never delete MI profiles; secrets write-only; no Supervisor.
6. Do not push. Commits use the repo human git identity only. No Co-authored-by / AI trailers.
   Message form: `admin-ui <id>: <why>`
7. Do not fold unrelated dirty WIP into a phase commit.
8. If blocked on orch/Postgres/Sarvam/live SIP: finish all UI code + browser/proxy verify that
   does not need the missing env; write blockers.md with exact human steps; do NOT fake 4.2 Pass.
9. Resume from CONTINUE.md — do not redo a phase whose summary.md is Closed + committed.
10. After 4.2: write .agent/work/ADMIN_UI_AUTOPILOT_DONE.md with commit SHAs and soak ticks; STOP.
```

---

## Agent protocol (non-negotiable)

### Loop

```
while phase in [0.1, 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2]:
  read CONTINUE.md + this runbook + docs/phases/<id>_*.md + prior summary
  if phase already Closed in CONTINUE.md and git has the commit → skip
  Planner → plan.md (must cite L3 exit criteria; Already implemented from git)
  if plan result blocker (human/env that cannot be worked around) → STOP autopilot
  Coder → implementation.md
  Reviewer → review.md
  if review fail:
    Coder fix (same phase only); max 2 extra loops; then blockers.md and STOP that phase
  else:
    Summarizer → re-run verify; summary.md; commit "admin-ui <id>: <why>"; record SHA
  update CONTINUE.md → next phase
after 4.2:
  write .agent/work/ADMIN_UI_AUTOPILOT_DONE.md
  stop
```

### One phase in flight

Never start 1.1 Coder before 0.1 Summarizer commit.  
Never skip Planner because “the L3 file is already detailed” — still write `.agent/work/<id>/plan.md` (smallest slice that meets L3 exit criteria; do not re-invent the L3).

### Skills vs L3

Global coral-phase skills mention `.agent/phases/*.yaml` and `go test`. For this programme:

- **Plan SoT** = `docs/phases/<id>_*.md` plus the Planner’s `plan.md`.
- **Verify** = phase file Verify section (browser on `http://localhost:5183`, curl via Vite proxy, grep). Not `go test`.
- After 0.1, keep `npm run dev` running or restart it when Vite config changes.

### Hard rules

- UI-only. Firewall: do not edit `com.coraltele.aiorchestrator` except **reading** APIs/docs.
- Never commit `.env`, tokens, or `node_modules`.
- Do not push.
- Do not create Redmine tickets or send mail.
- 4.2 is a **human soak**. Tick what this agent can prove (proxy, GET compares, no-op saves). Live DID / MI approve against a real meeting: do not fake Pass — leave a soak table with Skip + reason.

### Commit hygiene

- Summarizer commits only after Reviewer **pass** and re-verify **green**.
- Single `-m`; no `Co-authored-by`, `Signed-off-by`, or Cursor trailers.
- Do not commit `.agent/work/` unless the repo already tracks it; prefer committing `docs/phases/` only when a phase file must be corrected (typo / exit criterion fix). Application source is the main commit.

---

## Phase intent (do not merge)

| Id | Must deliver | Must not |
|---|---|---|
| **0.1** | Picker + `/CC/admin` + `/MI/admin` shells + redirects + `/mi/v1` proxy | New CC/MI form fields |
| **1.1** | Layout in localStorage; no `cx` on the wire | Inspector industrial fields |
| **1.2** | Binding retrieve fields; remove delete | New profile/flow editors |
| **1.3** | Validator truth (Decide/globals/slots/`cx`) | Inspector UI for those fields |
| **2.1** | Profile industrial + draft/validate | Flow inspector |
| **2.2** | Flow inspector industrial + flow validate API | Dashboard rewrite |
| **2.3** | Dashboard warnings + per-pin APIs | Tutorial rewrite (2.4) |
| **2.4** | Dirty guards + create-from-UI + copy | MI CRUD |
| **3.1** | MI client + home health | Profile/meeting CRUD |
| **3.2** | MI profiles + KB | Meetings / Ask |
| **3.3** | Meetings + Case B + transcript | Approve / Ask |
| **3.4** | Draft / approve / official / export | Ask / purge |
| **3.5** | Ask + ledger-if-present + purge confirm | Case A studio (stretch only) |
| **4.1** | Shared chrome / dirty switcher | New product fields |
| **4.2** | Soak ticks + DONE.md | New features |

---

## Honest limits

| Area | Autopilot realistic |
|---|---|
| 0.1–4.1 UI code + commits | Yes |
| 4.2 no-op GET compares + smoke test if orch up | Yes |
| 4.2 live DID / real MI approve on production meetings | Only if lab data and owner allow; else checklist + honest Skip |
| Backend / catalog / DB recreate | **No** |

---

## After DONE

Owner may start a **new** programme (Supervisor, embed-into-Go, catalog expansion). Not under this AUTOPILOT.
