# 2.2 — L4 implementation (Coder)

Inspector industrial fields + flow globals/policy inherit + POST validate + version inspect.
Listen multi-repair is a warning so live inbound matches server 200. No `cx` writes.

## Files

| File | Change |
|---|---|
| `src/api/client.js` | `validateFlow`, `listFlowVersions` |
| `src/api/types.js` | `INTERRUPT_MODES` = inherit\|off\|on\|after_ms; slot/decide/listen_policy/policy typedefs |
| `src/lib/flowValidate.js` | listen repairs>1 warning; conversation_policy ranges; node interrupt rules |
| `src/pages/builder/Inspector.jsx` | Interrupt/delivery, listen_policy, intents, slot, decide; flow globals + profile picker + policy |
| `src/pages/builder/SlotEditor.jsx` | ListenSlot typed fields |
| `src/pages/builder/DecideEditor.jsx` | Ordered rules + else |
| `src/pages/builder/FlowPolicy.jsx` | Flow-level override; omitted keys stay omitted |
| `src/pages/FlowBuilder.jsx` | Pin-default catalog profile; Check + validate-before-publish; version list inspect read-only |

## Verify

- Live inbound GET: welcome `mandatory_delivery: true`; hub/sales_room `listen_policy.exhausted_edge_id` + `global_intents[]`; pick_lang listen_policy; globals 8 ids; no `conversation_policy`.
- Client `validateFlow` on inbound: **0 errors**, 8 warnings (7 listen multi-repair + unreachable end).
- `POST /v1/flows/coral-telecom-inbound/validate` → 200 `{ok:true}`.
- Broken Decide POST validate → 422 `Decide rules required`.
- `GET …/versions` → 1–6; `GET …/versions/6` 35 nodes, no `cx`.
- Vite `:5183` serves FlowBuilder + Inspector 200. oxlint clean except existing warnings.
- Did **not** PUT/publish live inbound (avoid mutating lab draft). Publish path calls `validateFlow` then existing draft/publish.

No unit-test runner in this repo; fixtures checked via node import of `flowValidate.js`.

```yaml
# agent-approval
role: coder
result: pass
checklist:
  - id: plan_followed
    pass: true
  - id: verify_commands
    pass: true
  - id: tests_or_reason
    pass: true
  - id: no_scope_creep
    pass: true
  - id: no_secrets
    pass: true
blocker: null
```
