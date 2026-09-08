# Orchestrator Admin UI

A React (JavaScript) admin console for configuring **`com.coraltele.aiorchestrator`** — the Coral LLM voice
call-centre orchestrator.

Standalone: this project does not live in the orchestrator repo and changes no Go source. It talks to
the Control API over HTTP, so it can be developed and deployed independently.

```bash
npm install
npm run dev      # http://localhost:5183
```

The orchestrator must be running on `:8011`. Point elsewhere with `ORCH_URL=http://host:port npm run dev`.

> Vite 8 binds IPv6 only, so use **`localhost:5183`**, not `127.0.0.1:5183`.

---

## What the orchestrator needs configured

Nine domains, all through the Control API. Configuration lives in Postgres — migrations create schema
only and never insert data, so a fresh database is empty until something writes to it.

| Screen | Domain | Endpoints |
|---|---|---|
| Dashboard | health, readiness, blockers | `/v1/health`, `/v1/platform/status`, `/v1/gateways`, `/v1/meta/catalog` |
| Engines & credentials | which gateway serves listen/think/speak; vendor API keys | `/v1/tenant/engines`, `/v1/tenant/credentials*` |
| Answer pins | profile → published flow version (+ DID) | `/v1/tenant/answer-pins` |
| Profiles | the bot identity document, immutable versions | `/v1/profiles`, `/v1/profiles/{id}/versions` |
| Flows | flow registry | `/v1/flows`, `/v1/flows/{id}` |
| Flow builder | the `coral.flow.v1` graph: draft, publish, version inspect | `/v1/flows/{id}/draft`, `/v1/flows/{id}/versions` |
| Bindings | knowledge/CRM sources for `Inform` nodes | `/v1/bindings*` |
| Settings & fallback | tenant key/value; failure WAV prompts | `/v1/tenant/settings*`, `/v1/tenant/fallback*` |

**A call is answerable when:** engines are bound → a profile is published → a flow is published → a pin
ties them together. The dashboard shows exactly which of those is missing.

### ⚠️ `api/openapi.yaml` in the orchestrator repo is stale

It is a "Phase B stub" at v0.1.0: no flows, bindings, engines, credentials, settings or pins; the
`clock` enum is missing `chat`; and it documents `/v1/kb/*` endpoints that migration
`016_drop_kb.sql` removed. **Do not generate a client from it.** The Go handlers under
`internal/control/` plus `GET /v1/meta/catalog` are the real contract, and `src/api/types.js` mirrors
them by hand.

---

## Design rules this console follows

These come from the orchestrator's own locked docs — worth knowing before changing anything.

1. **Catalog-driven enums** (doc 13, OD-13-3). Every node type, edge kind, tool, clock, disposition
   code and locale dropdown is populated from `GET /v1/meta/catalog`. The UI must never offer a value
   the kernel would reject, and must never hard-code these lists.
2. **Graph is law.** Transfer destinations come from the routing matrix — never typed onto a node.
3. **Publish validate is the gate.** `src/lib/flowValidate.js` and `src/lib/profileValidate.js` mirror
   the Go validators so problems surface before publishing, but the server always re-validates. Keep
   them in sync with `internal/flow/validate.go` and `internal/profile/validate.go`.
4. **Secrets are write-only.** Credentials show `api_key_set` plus a masked preview, never the key.

### Canvas layout persistence

`coral.flow.v1` has no node coordinates. The builder auto-lays out by BFS depth from the Entry node,
then persists positions into `doc.cx.layout`. `cx` is declared in the Go `Document` struct but never
read by the runtime, and the JSON decoder ignores unknown fields — so layout round-trips through draft
save and publish without affecting validation or call behaviour.

---

## What this fixes versus the old embedded console

The console served from the Go binary at `:8011/admin/` has three defects this one does not:

- **Profile publish dropped the `language` block.** The old form built its document from a fixed set of
  fields with no `language` key, so republishing a profile stored `language: null` — silently losing
  the locale allowlist on a product whose headline feature is multilingual. Verified by publishing that
  exact document shape against a live server.
- **Only the first locale of a prompt was editable** (`Object.keys(locales)[0]`), so 10 of the 11 TTS
  locales were unreachable.
- **The graph editor was flat form cards** — 84 of them for the real 19-node/65-edge desk flow.

It also exposes the profile sections the old console had no fields for at all: `grounding`,
`knowledge.http_kb`, `skills`, `rules`, `playbook`, `response` (ladder/clips/templates), `fallback`
hop degradation, `templates`, `analytics`, `hot_swap_allowed`, and the `knowledge`/`translate` routers.

---

## Authentication

The server enforces `Authorization: Bearer` **only when its `AuthToken` is non-empty**
(`internal/control/server.go`), populated from the `CONTROL_AUTH_TOKEN` env var or the
`control.auth_token` system setting. When neither is set the Control API is completely open —
unauthenticated writes succeed. The token box in the top bar sends a token when you save one, so this
console works either way. Set that setting before exposing `:8011` beyond loopback.

---

## Layout

```
src/
  api/
    types.js       JSDoc typedefs + closed-set constants mirroring the Go structs
    client.js      fetch wrapper; ApiError carries the server's error envelope
    catalog.jsx    catalog + gateways + platform status context
  lib/
    flowValidate.js     mirror of internal/flow/validate.go
    profileValidate.js  mirror of internal/profile/validate.go
    layout.js           BFS auto-layout for the canvas
  components/ui.jsx     fields, sections, toasts, useAsync
  pages/
    Dashboard, Engines, Profiles, Flows, Bindings, Pins, Settings
    FlowBuilder.jsx     React Flow canvas
    builder/            GraphNode, Inspector
```

**Plain JavaScript — no TypeScript, no build-time type checking.** `src/api/types.js` keeps the
backend contract as JSDoc `@typedef` blocks, so editors still offer autocomplete and hover docs on
the API shapes without a compile step. It also exports the closed-set constants (`FLOW_SCHEMA_ID`,
`NODE_TYPES`, `EDGE_KINDS`, `TOOL_VERBS`, `PORTS`) — but at runtime always prefer the live catalog
from `GET /v1/meta/catalog` over those constants, so the UI tracks the server.

No component library — plain CSS with variables in `src/styles.css`, dark-first.

`npm run format` runs Prettier over `src/`.

## Deploying inside the Go binary (not done)

The orchestrator serves its current consoles via `//go:embed` in `web/embed.go`. To ship this one the
same way: `npm run build`, copy `dist/` into the orchestrator repo, add it to the embed directive, and
mount it in `internal/control/ui.go`. That requires editing Go source, which was deliberately out of
scope here.
