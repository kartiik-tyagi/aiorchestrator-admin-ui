# Admin UI sync programme — lock

**Repo:** `aiorchestrator-admin-ui` only.  
**Backend:** consume existing Control API (`/v1`) and MI API (`/mi/v1`). **No Go, SQL, or catalog changes.**  
**Products:** Call Center at `/CC/admin`, Meeting Intelligence at `/MI/admin`.  
**Status:** Waves **0.1–6.6** Closed. Wave **6** DONE — [ADMIN_UI_WAVE6_AUTOPILOT_DONE.md](../.agent/work/ADMIN_UI_WAVE6_AUTOPILOT_DONE.md).  
**Prior:** Wave **5** — [WAVE_5_GAP.md](./WAVE_5_GAP.md) Closed.  
**Next:** Wave **7** (MI minutes: document view, editing, draft/official PDF download) — **Ready**. Backend is orchestrator doc `docs/meeting-intelligence/16_MOM_DOCUMENT_AND_EXPORT.md` (MI.37–MI.40), delivered by the orchestrator programme; this repo still makes no Go/SQL change.

These documents are the coding source of truth for this programme. Do not invent screens, fields, or APIs that are not listed here.

---

## Two products, one app

| | Call Center | Meeting Intelligence |
|---|---|---|
| Job | Make a DID answerable: engines → profile → knowledge → graph → pin | Capture or ingest a meeting → official minutes → Ask → compound profile memory |
| Law | Conversation graph + intent catalog | Profile snapshot + official MoM + cite-or-abstain |
| APIs | `/v1/*` | `/mi/v1/*` |
| Home | `/CC/admin` | `/MI/admin` |
| Must never | Show MI meetings, MoM, Ask | Show CC flows, pins, barge, STT/TTS engines as CC config |

Shared chrome (theme, toasts, token box). Separate nav, API clients, and words.

---

## Operator journeys

**Call Center — “I want the phone answered correctly”**

1. Open Call Center → see what still blocks live answer (plain language).
2. Bind listen / think / speak and store vendor keys once.
3. Edit the same profile the lab already uses: product, intents, barge/listen policy, audio levels, voice pace.
4. Edit FAQ so retrieve still keys on intent + department + product + aliases.
5. Draw / edit the live graph: globals, interrupt, listen policy, Decide, slots — then publish without 422.
6. Pin profile → flow, press one smoke-test, hear the greeting.

**Meeting Intelligence — “I want minutes I can trust, then ask them, then compound memory”**

1. Open MI → health is up.
2. Create/edit an MI profile (languages, MoM sections, rules, retention). Add Other KB docs.
3. Seed people/products directory; enable KG when ready (Wave 5).
4. Confirm/reject memory inbox suggestions; turn Summary/Feedback flags on only when wanted (Wave 5).
5. Create a meeting on that profile.
6. Case B: paste transcript → see job/draft → edit draft → approve → official + export.
7. Read Meeting Summary / AI Feedback; refresh when stale — never save advice into MoM (Wave 5).
8. Ask the meeting or the profile; see citations or an honest abstain.
9. Optional: terminology glossary; retention purge with a hard confirm.

---

## Hard rules (every phase)

1. **No backend change.** If `GET /v1/meta/catalog` lacks an enum (intent scope/action, slot validators), the UI uses a **closed constant that matches the Go source**, labeled as a fallback, and still prefers the catalog when the key appears later.
2. **Never write `cx` into a flow document.** Canvas positions live in `localStorage` only (`orch_cc_layout:<flowId>`).
3. **Never reconstruct a document from an empty form.** Load full JSON → patch only the fields the screen shows → send the whole object back. Unknown keys survive.
4. **Publish validate is the gate.** Client checks are a preview; the server still decides. Show the server envelope in words.
5. **Secrets stay write-only.**
6. **Bindings have no DELETE.** Disable / enable only.
7. **MI has no profile delete.** Update only.
8. **Do not build Supervisor** or a second full chat product. Pin smoke-test (`clock=chat`) stays.
9. **Do not treat a meeting as a CC flow.**
10. **Do not invent MI profile fields** the store does not have.
11. **Catalog-driven enums** (doc 13 OD-13-3) whenever the catalog has the list.
12. **Wave 5 trust:** MoM = truth; Summary = skim; Feedback = advice never Official / never Ask-indexed. Insights flags default **off**. Refresh insights must not regenerate MoM. Inbox confirm is not MoM approve.

---

## Already in the UI (do not rebuild)

- Engines, credentials, settings, fallback
- Profile identity / modes / language / routers / skills / ladder / hop fallback
- Flow canvas, prompts, matrix, `binding_refs`
- Pin list + chat smoke test
- Tutorial + `SETUP_STEPS` (rewrite paths/copy when a phase says so)
- MI Home / Profiles / Meetings / Draft / Approve / Official / Ask / Retention (3.1–3.5)
- Shared polish + product switch dirty guard (4.1)

---

## Explicitly out of the programme

- Any Go / SQL / catalog / OpenAPI change
- Embedding this app into the Go binary
- Supervisor session / audit / recording browser
- Full user-chat console
- Restoring purged desk UIs
- Shared layout sync across browsers (no backend field allowed)
- Case A media studio as a first-class operator path (lab SFU/MCU is stretch in 3.5 only)
- Replacing `:8011/mi` thin lab (keep as soak lab; production path is `/MI/admin`)
- `advice_at_approve`, embeddings, PDF-as-source, auto-create people, auto-confirm aliases

---

## Serial order

```text
0.1 → 1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 2.3 → 2.4 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 4.1 → 4.2
                                                                                    ↓
                                                              5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6
```

Waves **0–4 Closed**.  
Wave **5** (memory + insights): start at **5.1**. Do not skip client (5.1) before screens.  
**5.6** is human soak only (like 4.2).

Wave **7** (MI minutes) interleaves with orchestrator phases:

```text
MI.37 → MI.38 → 7.1 → 7.2 → 7.3 → 7.4 → MI.39 → 7.5 → MI.40 → 7.6
```

**7.2** must close before any editing UI (7.3) ships. **7.6** ends in a human soak.

---

## Architecture refs (read, do not implement from)

**Call Center:** orchestrator `docs/01`, `03`, `13`, `19`/`19a`, `20`, `21`; `internal/profile/*`; `internal/flow/*`; `internal/control/server.go` + `ui.go`.  
**MI:** `docs/meeting-intelligence/01`, `08`, `12`, **`15`** (Profile memory + insights); `internal/mi/facade/facade.go`.  
**This repo:** `README.md`, `src/api/client.js`, `src/api/mi/client.js`, `src/api/types.js`, `src/lib/{flowValidate,profileValidate,layout}.js`, [WAVE_5_GAP.md](./WAVE_5_GAP.md).
