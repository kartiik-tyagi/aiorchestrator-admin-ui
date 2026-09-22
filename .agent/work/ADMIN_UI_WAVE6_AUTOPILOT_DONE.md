# Admin UI Wave 6 AUTOPILOT — DONE

**Closed:** 2026-09-22  
**Repo:** `aiorchestrator-admin-ui`  
**Backend prerequisite:** `com.coraltele.aiorchestrator` API.0–API.9 (doc 23) — consumed, not edited  
**Not pushed** (owner decides)

## Commit SHAs

| Phase | SHA | Message |
|---|---|---|
| 6.1 | `d3bc235` | speak the same Tool api vocabulary as the kernel before building forms |
| 6.2 | `4f20929` | declare CRM API integrations on the profile form without Advanced JSON |
| 6.3 | `30385a5` | keep API secrets write-only and block publish when auth is missing |
| 6.4 | `1b6827a` | wire Tool api flows to a bound profile and the three result edges |
| 6.5 | `81f57bc` | let operators type Listen slots and insert Speak template tokens |
| 6.6 | `772e8db` | teach the CRM API Tool path in setup, guide, and tutorial |

## Operator path now possible from `/CC/admin`

1. Profile → API integrations + timezone/date_order  
2. Profile → API secrets (masked) → Publish  
3. Flow → bound profile → Tool `api` + `api_id` → Ensure three `tool_result` edges  
4. Speak templates `{{slot.*}}` / `{{session.*}}`  
5. ListenSlot `input_type` / `length_rule`  
6. Publish flow with `profile_id` → pin → chat (human soak)

## Soak

See `.agent/work/6.6/soak.md` — lint Pass; live orch/CRM steps honest **Skip**.

## Out of programme (still)

OAuth/HMAC/mTLS, Supervisor audit browser, Inform→API auto-migrate, Go changes, live Pass fabrication.
