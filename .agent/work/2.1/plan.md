# 2.1 — L4 plan (Planner)

**Phase:** 2.1  
**L3:** `docs/phases/2.1_cc_profile_industrial.md`  
**Role:** Planner only  

## Already implemented

0.1–1.3 closed. Profiles still load **latest published only**, no draft/validate/version list, no catalog/policy/levels/TTS form.

## Goal

Draft-first profile edit; industrial sections via **patch/patchIn** only; client + server validate.

## In scope

Client: get/put draft, validate, list versions.  
`emptyDoc`: `product: call_center`, `intent_catalog: []`.  
Load: draft → latest → emptyDoc (never emptyDoc over a loaded doc).  
Save draft PUT full document. Check = POST validate.  
Sections: product, intent catalog table, conversation policy, audio levels, persona TTS.  
`profileValidate` ranges + catalog + dialLike.  
Version list read-only; copy-into-draft with confirm.

## Out of scope

Playbook visual builder, flow inspector, engines, MI.

## Files

`src/api/client.js`, `src/api/types.js`, `src/lib/profileValidate.js`, `src/pages/Profiles.jsx`, `src/pages/profile/Industrial.jsx`

## Exit criteria

L3 1–5 (three live profiles show stored industrial fields; no-op name save keeps catalog; invalid pace/RMS/id local; draft survives reload; version list).

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
