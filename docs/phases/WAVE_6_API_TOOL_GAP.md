# Wave 6 gap — External API Tool + Typed Listen (UI sync)

**Status:** AUTOPILOT authorized (2026-09-22). Runbook: [ADMIN_UI_WAVE6_AUTOPILOT.md](./ADMIN_UI_WAVE6_AUTOPILOT.md).  
**Backend:** `com.coraltele.aiorchestrator` doc 23 Locked; L4 **API.0–API.9 Closed**.  
**UI repo:** `aiorchestrator-admin-ui` only. Consume Control API; no Go changes in this wave.  
**Parent law:** [PROGRAMME.md](./PROGRAMME.md) hard rules still apply (patch-not-rebuild JSON, no `cx`, secrets write-only, catalog-first enums).

---

## Operator goal (end state)

Configure a CRM-capable Call Center desk **entirely from `/CC/admin`**:

1. Profile → API integrations (non-secret) + timezone / date_order  
2. Profile → API secrets (masked PUT/GET)  
3. Publish profile (server snapshots secrets)  
4. Flow builder → Tool `api` + `api_id` + three `tool_result` edges + Speak templates  
5. Flow publish with `profile_id` (+ version|latest) so `api_id` resolves  
6. ListenSlot typed input + length_rule where needed  
7. Pin + chat smoke proves lookup → “Hello {{slot.customer_name}}”

Today the React admin covers industrial profile + graph through VA/CC/NC eras, but **nothing for doc 23**.

---

## Backend contracts the UI must call (already shipped)

| Area | API / document field | Notes |
|---|---|---|
| Profile integrations | `Document.api_integrations[]`, `timezone`, `date_order` | Publish validates; secrets never in JSON |
| Secrets | `GET/PUT/DELETE /v1/profiles/{id}/api-secrets[/{api_id}]` | Masked; publish fails if `auth_type≠none` and secret missing |
| Catalog | `GET /v1/meta/catalog` | Now includes `api` in `tools`, plus `api_tool_result_options`, `api_success_modes`, `api_auth_types`, `listen_input_types`, `date_order` |
| Flow Tool | `tool: "api"`, `api_id`, `prompt_ref` (wait), edges `tool_result` + `option` ∈ success\|fail\|error | |
| Flow publish | Query/header `profile_id` + `profile_version` (default `latest`) when flow has Tool api | OD-API-26 |
| Speak templates | `{{slot.*}}`, `{{session.ani\|language\|caller_name\|session_id}}` in prompts | Unknown `session.*` fails publish |
| ListenSlot | `input_type`, `length_rule: {op,n}` | Legacy validator still required |

**Do not** use Inform `http_retrieve` / binding CRM as the write path.

**Ignore** lab-only `web/admin/profiles.html` textarea in the Go repo — production path is this React app.

---

## Current UI baseline (what exists)

| Surface | File(s) | Today |
|---|---|---|
| Profile editor | `src/pages/Profiles.jsx`, `profile/Industrial.jsx` | Product, intents, barge, audio, TTS — **no** api_integrations / timezone / date_order / secrets |
| Profile client | `src/api/client.js` | Draft/publish/validate — **no** api-secrets methods |
| Types | `src/api/types.js` | `TOOL_VERBS = ['transfer','hangup']` only |
| Flow Tool inspector | `src/pages/builder/Inspector.jsx` | Verb select from catalog (will show `api` once catalog loads) but **no** `api_id`, no success/fail/error edge helper; copy still says tools are irreversible |
| Slot editor | `src/pages/builder/SlotEditor.jsx` | key/validator/enum/regex/confirm/redact/class — **no** input_type / length_rule |
| Client validate | `src/lib/flowValidate.js` | Transfer matrix checks OK; **warns that `tool_result` is unused** (wrong after API.3); no api three-edge check; no Speak template scan; no profile_id on publish |
| Profile validate | `src/lib/profileValidate.js` | No api_integrations rules |
| Tutorial / setup | `src/lib/setupSteps.js`, Tutorial | No CRM/API step |
| Field guide | `src/lib/fieldGuide.js` | No API Tool / template docs |

---

## Gap inventory (implement these)

### G1 — Profile: API integrations editor

- New section on Profiles (or Industrial sibling): list/create/edit/delete rows in `api_integrations[]`.
- Fields (V1): id, display_name, method, url, kind (`safe_read`\|`write`), timeout_ms, auth_type, auth_header_name, static_headers, content_type fixed JSON, request_map / response_map tables, success mode + http_ok / fail_statuses / success_requires / bool_* / compare_* / presence_*, idempotency, caps, allow_insecure_http (lab).
- Also: `timezone` (IANA), `date_order` (catalog `date_order` or fallback `dmy|mdy|ymd`).
- Patch-into full draft document; Advanced JSON still preserves unknowns.
- Client preview: unique id, https (unless lab flag), write ⇒ success_requires (or http_only+204).

### G2 — Profile: API secrets (masked)

- `api.getProfileApiSecret` / `put` / `list` / `delete` in `client.js` → `/v1/profiles/{id}/api-secrets…`
- Per-integration secret panel: set bearer/api_key/basic/headers payload; show `auth_set` + preview only.
- Block publish CTA when any integration needs auth and secret not set (mirror server 422).
- Never put secrets in draft JSON or localStorage.

### G3 — Flow builder: Tool `api`

- When `tool === 'api'`: require `api_id` (dropdown from **selected profile** draft/published integrations — need a profile picker or pin-aware default on the builder).
- Default `interrupt: off` for api tools; `prompt_ref` labelled “wait / filler (optional)”.
- Edge assistant: ensure three outgoing `tool_result` edges with options success / fail / error (create stubs to Speak/End if missing).
- Update inspector copy: api is **non-terminal**; transfer/hangup remain terminal.
- Prefer catalog `tools` / `api_tool_result_options`; keep `TOOL_VERBS` fallback including `api`.

### G4 — Flow publish: profile resolve

- Publish/validate requests that include Tool api must send `?profile_id=…&profile_version=latest` (or header).
- UI must bind a profile for the flow (saved preference per flow id in localStorage is OK; not in document).
- Show server `api_id_unknown` / `api_profile_required` errors in words.

### G5 — Speak templates

- Prompt editor hint: allowlisted tokens.
- Client preview: unknown `session.*` → error; well-formed `slot.*` OK; optional “keys used” chip list.
- Do not invent expression language.

### G6 — Typed ListenSlot

- SlotEditor: `input_type`, `length_rule` `{op,n}` when phone/number.
- Confirm default-on suggestion for number/phone/email (operator can clear).
- `flowValidate` + types: catalog `listen_input_types` with fallback list.
- Note timezone required on profile when any slot uses `date`/`time`/`datetime` (server publish rule).

### G7 — Client validators truth

- **Remove** the false warning that `tool_result` is unused.
- Add checks: Tool api needs `api_id`; three distinct tool_result options; optional template scan.
- Profile validate: duplicate api id, insecure url, write without requires.

### G8 — Catalog / types / tutorial

- Consume new catalog keys when present.
- Update `types.js` fallbacks: `TOOL_VERBS`, input types, success modes, auth types, date_order.
- Tutorial + setupSteps: optional step “API integrations + secret + Tool api edges” after Bindings / before Pins.
- fieldGuide entries for Tool api, secrets, templates.

### G9 — Soak (UI)

- Checklist: create integration + secret → publish profile → build api flow with three edges + template Speak → publish with profile_id → pin → chat smoke with stub CRM (or documented lab host).
- No live Pass required in UI phase if chat stub works.

---

## Suggested phase split (Wave 6)

| Id | Outcome | Depends |
|---|---|---|
| **6.1** | Types + catalog + fix `tool_result` lie + client.js secrets API | Study |
| **6.2** | Profile api_integrations + timezone/date_order form | 6.1 |
| **6.3** | Profile api-secrets masked UI + publish gate | 6.2 |
| **6.4** | Flow Tool api + three edges + profile_id on publish | 6.1, 6.2 |
| **6.5** | Speak template hints + ListenSlot input_type/length_rule | 6.1 |
| **6.6** | Tutorial/setupSteps/fieldGuide + UI soak | 6.2–6.5 |

Serial: **6.1 → 6.2 → 6.3 → 6.4**; **6.5** can parallel after 6.1; **6.6** last.

---

## Explicitly out of Wave 6

- Diagnostic-centre production desk content package  
- OAuth / HMAC / mTLS / XML  
- Supervisor audit browser product  
- Meeting Intelligence screens  
- Go kernel / migration changes  
- Replacing Inform CRM bindings with Tool(api) automatically  

---

## Verify later (when implementing)

```text
# Catalog shows api
curl -s localhost:8011/v1/meta/catalog | jq '.tools, .listen_input_types, .date_order'

# UI smoke (manual)
# 1. Profile: add lookup_by_ani + PUT secret + publish
# 2. Flow: Tool api + three tool_result + Speak Hello {{slot.customer_name}}
# 3. Publish flow with profile_id → pin → chat
```
