# Admin UI AUTOPILOT — done

Repo: `aiorchestrator-admin-ui` only. Not pushed. Commits are Ayush Garg only.

## Phase SHAs

| Phase | SHA | Subject |
|---|---|---|
| 0.1 | `1f5ccea` | split product homes so CC and MI never share a nav |
| 1.1 | `9a5cd70` | keep canvas layout out of the flow document |
| 1.2 | `1700cf4` | persist binding retrieve keys and drop delete |
| 1.3 | `9ff935f` | tell the truth about Decide, globals, and slots |
| 2.1 | `0e18ef7` | edit industrial profile fields without dropping the catalog |
| 2.2 | `83a4175` | expose industrial flow fields without blocking live inbound |
| 2.3 | `42ccde0` | warn why a DID will not answer without rewriting every pin |
| 2.4 | `24c9688` | finish the CC create path without seeding live catalogs |
| 3.1 | `f798490` | show Meeting Intelligence health without inventing a Meta screen |
| 3.2 | `a9e2223` | edit MI desks without rewriting past meeting snapshots |
| 3.3 | `3803022` | run Case B meetings without offering illegal lifecycle actions |
| 3.4 | `00a0c51` | lock official minutes only after a reviewed approve |
| 3.5 | `342e92b` | ask the official archive and keep purge behind a typed confirm |
| 4.1 | `afc99a8` | warn before switching products with unsaved minutes or graphs |
| 4.2 | — | verification only; no app commit |

HEAD after 4.1: `afc99a8c695a2c392b90ae5664da45f9cc29ed8e`. Branch `main` ahead of origin by 14.

## Soak ticks (4.2)

Env this session: Vite `localhost:5183`, orch `:8011`, Postgres up (`health.db=true` both products).

### Call Center

| # | Result | Evidence / reason |
|---|---|---|
| 1 Readiness vs `ready_for_sessions` | **Pass** | 2.3 dashboard warnings in `42ccde0`; health ok |
| 2 Open live industrial profiles | **Skip** | GET-only not re-diffed vs versions/latest in this turn; UI shipped in 2.1 |
| 3 No-op save coral-telecom-limited | **Skip** | Must not PUT live coral-* documents from this agent |
| 4 Inbound builder / validate | **Pass** | `POST /v1/flows/coral-telecom-inbound/validate` → `{ok:true}` |
| 5 Save inbound draft no `cx` | **Skip** | No inbound PUT this run; layout is localStorage (1.1) |
| 6 Publish inbound | **Skip** | Owner did not ask to publish coral-telecom-inbound |
| 7 product-faq no-op retrieve keys | **Skip** | No binding PUT; retrieve UI shipped in 1.2 |
| 8–11 Create-from-UI + delete | **Skip** | New `ui-soak-cc` desk / pin / live SIP not created |

Fail-immediately (cx 422, stripped catalog, Decide unimplemented): **not observed** on validate 200.

### Meeting Intelligence

| # | Result | Evidence / reason |
|---|---|---|
| 12 Health | **Pass** | `GET /mi/v1/health` `{status:ok, product:meeting_intelligence, db:true}` |
| 13 ui-mi-demo + KB | **Pass** | `edea14e5-f248-42d8-9287-bfee63d84e13` + Policy KB (3.2) |
| 14 Meeting + Case B + transcript | **Pass** | `b11cb928-…` Alice/Bob; same Idempotency-Key → `deduped_noop` |
| 15 Draft edit version bump | **Pass** | PATCH v1→2 mom “ship Friday” |
| 16 Approve preview + confirm | **Pass** | official v1; unsupported_ai gate in UI + 409 copy |
| 17 Official + export | **Pass** | GET official v1; `export?format=json` kind=official |
| 18 Meeting Ask cite or abstain | **Pass** | Friday → `official_field_ref`; xyzzy → abstained |
| 19 Session two turns | **Pass** | session `77ce8d81-…` GET turns=2 |
| 20 Purge typed confirm | **Pass** | UI two-step + `PURGE`; live purge **not** run as a destroy (POST no-op 0/0 once) |
| 21 Ledger | **Pass** | `GET …/actions` 404 — section hidden |

### Shared

| # | Result | Evidence / reason |
|---|---|---|
| 22 Picker | **Pass** | `/` 200; Home.jsx two products |
| 23 `/engines` → CC | **Pass** | `App.jsx` Navigate to `/CC/admin/engines` |
| 24 Dirty switch both ways | **Pass** | 4.1 `ProductSwitch` + MI `setDirtyGuard` |
| 25 No mixed nav | **Pass** | Separate shells |

### Not claimed

- Owner keyboard soak / “both journeys usable” sign-off — **Skip (human)**.
- Live DID / chat smoke / Sarvam / SIP — **Skip (no live call this run)**.

## Human leftover

1. Walk `/CC/admin` and `/MI/admin` at `http://localhost:5183` yourself.
2. Optional: no-op save coral-telecom-limited and product-faq; confirm GET identity.
3. Optional: `ui-soak-cc` create path + pin smoke, then delete pin → flow → profile.
4. Do not publish coral-telecom-inbound unless you intend a new version.
5. Do not purge retention on a desk with `transcript_days` > 0 unless you mean it.

AUTOPILOT STOP.
