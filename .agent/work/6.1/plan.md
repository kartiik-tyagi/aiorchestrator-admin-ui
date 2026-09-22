# Phase 6.1 — plan

**Role:** Planner  
**L3:** `docs/phases/6.1_types_secrets_validator.md`  
**Gap:** `docs/phases/WAVE_6_API_TOOL_GAP.md` G7 + client/types slice of G2/G8

## Already implemented (from git)

- Waves 0.1–5.6 Closed on `main` (latest: `00b1772` / `06f45cc`).
- CC industrial profile + flow builder exist; **no** api_integrations, api-secrets client, or Tool `api` validator truth.
- Study artifact `WAVE_6_API_TOOL_GAP.md` + L3s 6.1–6.6 + runbook written this session (uncommitted docs only).

## Scope (smallest slice for L3 exit)

1. **types.js** — `TOOL_VERBS` += `api`; add fallbacks `API_AUTH_TYPES`, `API_SUCCESS_MODES`, `API_KINDS`, `LISTEN_INPUT_TYPES`, `DATE_ORDER`, `API_TOOL_RESULT_OPTIONS`, `SESSION_TEMPLATE_KEYS`, `LENGTH_RULE_OPS`; extend MetaCatalog JSDoc; slot/tool typedef notes.
2. **client.js** — `listProfileApiSecrets`, `getProfileApiSecret`, `putProfileApiSecret`, `deleteProfileApiSecret`; extend `publishFlow`/`validateFlow` with optional query `{ profile_id, profile_version }` (prep for 6.4, no UI yet).
3. **flowValidate.js** — remove false `tool_result` unused warn; add Tool api `api_id` + three distinct tool_result options; scan prompts for unknown `{{session.*}}`.
4. **profileValidate.js** — duplicate api id; http without allow_insecure_http; write without success_requires (unless http_only + 204-only).

## Out of scope

- React forms (6.2+), tutorial (6.6), Go.

## Exit criteria (testable)

1. Secrets methods on `api` match Control paths.
2. `TOOL_VERBS` includes `api`; catalog typedefs updated.
3. No “tool_result unused” warning string in flowValidate.
4. Preview errors for missing three-edges / unknown session template / bad api_integrations.
5. `npm run lint` clean on touched files.

## Risks

- Live orch may be down — client methods still match Go `api_secrets.go`.
- Template scanning must only flag `session.*` unknowns (not invent expression language).

## Files

`src/api/types.js`, `src/api/client.js`, `src/lib/flowValidate.js`, `src/lib/profileValidate.js`

# agent-approval
```yaml
result: pass
ids:
  - reviewed_prior_commits
  - cites_phase_yaml
  - cites_docs
  - exit_criteria_listed
  - out_of_scope
  - no_vendor_early
  - risks
```
