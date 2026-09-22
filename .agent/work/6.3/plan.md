# Phase 6.3 — plan

**Role:** Planner  
**L3:** `6.3_profile_api_secrets.md`  
**Prior:** 6.2 `4f20929`

## Scope

1. `ApiSecrets.jsx` (or section in ApiIntegrations) — per integration with auth_type≠none: load masked status, form for auth_payload by type, put/delete via client.
2. Profiles publish: warn/block when any integration needs auth and list secrets show auth_set false.
3. Never store secrets in doc state.

## Out of scope

Flow Tool (6.4)

## Exit criteria

List/get/put/delete from UI; publish gate; lint; no secret in draft JSON.

# agent-approval
```yaml
result: pass
ids: [reviewed_prior_commits, cites_phase_yaml, cites_docs, exit_criteria_listed, out_of_scope, no_vendor_early, risks]
```
