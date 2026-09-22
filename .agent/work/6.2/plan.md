# Phase 6.2 — plan

**Role:** Planner  
**L3:** `docs/phases/6.2_profile_api_integrations.md`  
**Prior:** 6.1 `d3bc235`

## Already implemented

- types/validators/client secrets (6.1)
- Profiles.jsx + Industrial.jsx industrial CC form
- No api_integrations UI yet

## Scope

1. New `src/pages/profile/ApiIntegrations.jsx` — timezone, date_order, list of integrations with V1 fields (id, display_name, method, url, kind, timeout_ms, auth_type, auth_header_name, static_headers as string pairs, request_map/response_map tables, success block, idempotency, caps, allow_insecure_http).
2. Mount in `Profiles.jsx` after Industrial; extend `emptyDoc` with `timezone`, `date_order`, `api_integrations: []`.
3. Patch-not-rebuild; catalog enums with type fallbacks.

## Out of scope

Secrets UI (6.3), flow Tool (6.4).

## Exit criteria

1. Can add lookup-shaped integration via form  
2. timezone + date_order editable  
3. Draft save preserves api_integrations (patch into doc)  
4. lint clean  

## Risks

- Large form — keep one expanded row editor; omit obscure success subfields behind mode select.

## Files

`src/pages/profile/ApiIntegrations.jsx` (new), `src/pages/Profiles.jsx`

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
