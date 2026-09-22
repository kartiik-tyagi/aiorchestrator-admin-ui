# Phase 6.6 — soak ticks

| Check | Result | Note |
|---|---|---|
| Lint on Wave 6 sources | **Pass** | `npm run lint` exit 0 (pre-existing warnings only) |
| Catalog / orch :8011 live probe | **Skip** | Autopilot did not require orch up for UI code phases |
| Profile form: add integration + secret + publish | **Skip** | Needs orch + operator; UI surfaces exist (6.2–6.3) |
| Flow: Tool api + three edges + template + publish with profile_id | **Skip** | Needs orch; UI surfaces exist (6.4–6.5) |
| Pin + chat smoke CRM stub | **Skip** | Human / lab |

Human follow-up when orch is up:
1. Profiles → api_integrations + secret → Publish
2. Flows → bind profile → Tool api → Ensure edges → Speak `Hello {{slot.customer_name}}` → Publish
3. Pins → pin → chat smoke
