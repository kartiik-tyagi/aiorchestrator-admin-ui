# Orchestrator Admin UI

A React (JavaScript) admin console for configuring **`com.coraltele.aiorchestrator`** — the Coral LLM voice
call-centre orchestrator.

Standalone: this project does not live in the orchestrator repo and changes no Go source. It talks to
the Control API over HTTP, so it can be developed and deployed independently.

```bash
npm install
npm run dev      # http://localhost:5183
```

Open **`http://localhost:5183/`** — product picker. Vite 8 binds IPv6 only: use **`localhost:5183`**, not `127.0.0.1`.

| Product | Operator home | Job |
|---|---|---|
| Call Center | `http://localhost:5183/CC/admin` | Make a DID answerable (engines → profile → graph → pin). Tenant + engine status live **only here**. |
| Meeting Intelligence | `http://localhost:5183/MI/admin` | Capture or ingest a meeting → official minutes → Ask. No CC catalog, pins, or barge. Retention purge is under `/MI/admin/retention`, not the home buttons. |

Old bookmarks (`/engines`, `/profiles`, `/flows`, `/bindings`, `/pins`, `/settings`, `/tutorial`) redirect into `/CC/admin/…`. The product switcher confirms before leaving unsaved CC profiles/flows or MI desks/drafts.

The orchestrator must be running on `:8011`. Point elsewhere with `ORCH_URL=http://host:port npm run dev`. Vite proxies `/v1`, `/mi/v1`, and `/edge` to that origin.

> Vite 8 binds IPv6 only, so use **`localhost:5183`**, not `127.0.0.1:5183`.

**Phase plans (UI-only sync with the live kernel, Call Center + Meeting Intelligence):** start at [`docs/phases/README.md`](docs/phases/README.md). Programme lock: [`docs/phases/PROGRAMME.md`](docs/phases/PROGRAMME.md). Wave 5 (memory + insights gaps): [`docs/phases/WAVE_5_GAP.md`](docs/phases/WAVE_5_GAP.md). Do not implement from this README — implement one phase file at a time.

---

## What the orchestrator needs configured

Nine domains, all through the Control API. Configuration lives in Postgres — migrations create schema
only and never insert data, so a fresh database is empty until something writes to it.

The sidebar is ordered as the configuration order — work top to bottom. A first-run walkthrough lives
at **`/CC/admin/tutorial`** (also linked from the Call Center dashboard). The order is defined once in
`src/lib/setupSteps.js`, which the sidebar and the dashboard checklist both read. New profiles start
with an empty intent catalog. FAQ bindings need retrieve keys (intents/aliases) or they only match
questions. Canvas layout is `localStorage` only — never write `cx` on the flow.

| # | Screen | Domain | Endpoints |
|---|---|---|
| — | Dashboard | health, setup checklist | `/v1/health`, `/v1/platform/status`, `/v1/gateways`, `/v1/meta/catalog` |
| 1 | Engines & credentials | which gateway serves listen/think/speak; vendor API keys | `/v1/tenant/engines`, `/v1/tenant/credentials*` |
| 2 | Profiles | the bot identity document, immutable versions | `/v1/profiles`, `/v1/profiles/{id}/versions` |
| 3 | Bindings | knowledge/CRM sources for `Inform` nodes (optional) | `/v1/bindings*` |
| 4 | Flows + builder | the `coral.flow.v1` graph: draft, publish, version inspect | `/v1/flows*` |
| 5 | Answer pins | profile → published flow version (+ DID), plus a chat smoke test | `/v1/tenant/answer-pins`, `/v1/sessions*` |
| 6 | Settings & fallback | tenant key/value; failure WAV prompts (optional) | `/v1/tenant/settings*`, `/v1/tenant/fallback*` |

**A call is answerable when:** engines are bound → a profile is published → a flow is published → a pin
ties them together. The dashboard shows exactly which of those is missing.

### ⚠️ `ready_for_sessions` is not what it sounds like

`GET /v1/platform/status` computes readiness from the database, the engine binding, the gateway
registry, and whether **at least one profile row exists** (`internal/control/ui.go`). It does not
check that the profile has a published *version*, that any flow exists or is published, or that an
answer pin points at them. So the server reports `ready` while every call is still refused with
`422 flow_pin_required`. The dashboard's own checklist (`src/lib/setupSteps.js`) applies the stricter
test and is the one to trust. Note also that an unpublished flow reports `current_version: 0`, not
`null` — checking for null counts drafts as published.

### Deleting configuration

Four `DELETE` endpoints were added to the orchestrator's Go backend to support this console
(`internal/control/delete.go`, `internal/store/store_delete.go`):

| Endpoint | Guards |
|---|---|
| `DELETE /v1/profiles/{id}` | 409 if an answer pin references it, or if any session used it |
| `DELETE /v1/flows/{id}` | 409 if an answer pin references it; draft + versions cascade |
| `DELETE /v1/bindings/{id}` | 409 if a published flow Informs from it |
| `DELETE /v1/tenant/credentials/{gateway_id}` | none — keys have no dependents |

All return `204 No Content` on success and `404` for an unknown id. **Deleting configuration never
touches evidence** — sessions, transcripts and audit rows are always left alone, which is exactly
why a profile that has answered calls cannot be removed.

Bindings also support a reversible soft delete: set `status: disabled` and
`internal/runtime/graph/inform.go:55` stops serving it, without losing the content.

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

### Keyboard and layout

| Key | Does |
|---|---|
| `Ctrl`/`Cmd` + `B` | Collapse or expand the sidebar (persists in `localStorage`) |
| `Ctrl`/`Cmd` + `Alt` + `B` | Builder: hide or show the right-hand panel (persists) |
| `Del` / `Backspace` | Delete the selected node or edge |
| `Esc` | Leave the focused inspector field; press again to deselect |
| `Shift` + click a node | Connect from the selected node (or the selected edge's source) — click several in a row to fan out |
| `Ctrl` + `Z` / `Ctrl` + `Shift` + `Z` | Undo / redo — 50 steps, covers every edit including node moves; rapid typing folds into one step |
| `Ctrl` + `S` | Save draft (works while typing too) |

Other shortcuts are suppressed while focus is in an input, textarea or dropdown.

**Wiring the graph.** Drag a palette block onto the canvas to place it, or click it to add below the
selected node. Drag from a node's bottom dot and drop anywhere on another node's card. A new edge's
kind is guessed from its source — `intent` out of a Listen node, `next` out of Entry/Speak/Inform,
`repair` for an Inform's second edge — and the intent box takes focus so you can type straight away.
Click an edge label to select that edge; select a node to highlight its edges and fade the rest.
Parallel edges between the same two nodes fan apart with stacked labels.

**Clean vs Detailed lines.** The toggle at the canvas's top right sets how edges draw. *Clean* (the
default) keeps every line faint and unlabelled until you hover or select a node, then shows only that
node's connections — blue leaving it, green arriving. *Detailed* draws every line and label.

**Connections panel.** Selecting a node lists what it *connects to* and what it is *connected from*,
one row per edge: kind, intent, and the node at the other end. Click a row to edit it in place, click
the other node's chip to jump to it, hover a row to highlight that line on the canvas. "Connect to a
node…" is a searchable picker (type, ↑↓, Enter) with an optional kind override; the new edge opens with
its intent focused, and Enter walks intent → option → back to the picker, so a whole fan-out can be
wired from the keyboard without dragging a line.

**The right-hand panel** folds to a rail (validation state, connection count, jump-to-section buttons),
resizes by dragging its left edge (double-click resets), and every section in it collapses. Panel
width, open/closed, line mode and each section's state are remembered per browser.

The graph flows **top to bottom**:
BFS depth from the Entry node sets the row, siblings spread across it, and handles sit on the top and
bottom edges of each node.

### Canvas layout persistence

`coral.flow.v1` has no node coordinates. The builder auto-lays out by BFS depth from the Entry node,
then persists positions in this browser only (`localStorage` key `orch_cc_layout:<flowId>`). The
kernel rejects any non-empty `cx` (`validateCXRejected`). Save and Publish never write `cx`. A second
browser on the same flow auto-lays out.

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
    mi/client.js   Meeting Intelligence Control stub (filled in later phases)
  shells/
    CcShell.jsx    Call Center chrome + /CC/admin routes
    MiShell.jsx    Meeting Intelligence chrome + /MI/admin placeholder
  lib/
    flowValidate.js     mirror of internal/flow/validate.go
    profileValidate.js  mirror of internal/profile/validate.go
    layout.js           BFS auto-layout for the canvas
    flowGraph.js        edge-kind defaults, labels, ordering shared by canvas and panel
  components/ui.jsx     fields, sections, toasts, useAsync
  pages/
    Dashboard, Engines, Profiles, Flows, Bindings, Pins, Settings
    FlowBuilder.jsx     React Flow canvas
    builder/            GraphNode, FlowEdge, Inspector, Connections, NodePicker,
                        PanelSection (collapsible, remembered), icons
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
