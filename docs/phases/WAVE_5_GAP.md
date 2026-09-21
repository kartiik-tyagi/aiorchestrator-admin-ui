# Wave 5 — Gap inventory (kernel MI.25–MI.36 vs Admin UI 3.x)

**Repo:** `aiorchestrator-admin-ui` only.  
**Backend law:** orchestrator `docs/meeting-intelligence/15_PROFILE_MEMORY_AND_INSIGHTS.md` (Solution v3) + live `internal/mi/facade/facade.go`.  
**Prior UI wave:** phases **3.1–3.5** + polish **4.1** Closed. Thin lab at `:8011/mi` is **not** the production UI.

This wave does **not** redesign Call Center. It closes Meeting Intelligence gaps so `/MI/admin` matches the production-ready API the kernel already ships.

---

## Trust classes (do not blur in UI)

| Class | Surfaces | Operator may |
|---|---|---|
| Meeting truth | Transcript, MoM draft, Official | Edit MoM → approve → Official |
| Org memory | Confirmed people/products aliases, terminology, open actions, Other docs | Confirm/reject; seed directory |
| Advice | Meeting Summary, AI Feedback | Read; refresh; **never** save into MoM or Official |

Ask continues to cite the archive only. Summary and Feedback are **never** Ask-indexed.

---

## Already covered (3.1–3.5 — do not rebuild)

- MI health / profile CRUD / Other KB paste  
- Meetings Case B → transcript → draft MoM → approve → Official → export  
- Meeting + Profile Ask sessions  
- Retention purge  

## Gaps this wave closes

| Gap | Kernel | UI today | Phase |
|---|---|---|---|
| People / products directory CSV | MI.26–MI.30 | Missing | **5.2** |
| Enable live `rules.kb` (KG) | `POST …/kg/enable` | Missing | **5.2** |
| Profile memory inbox confirm/reject | MI.32 | Missing | **5.3** |
| `X-MI-KB-Token` write gate | MI.26/32 | Missing (ingest token only) | **5.2–5.3** |
| `rules.insights.summary` / `.feedback` toggles | MI.33–35 | Only raw JSON if any | **5.3** |
| Meeting Summary + AI Feedback panes | MI.33–34 facet | Missing | **5.4** |
| Insights stale + refresh | MI.35 | Missing | **5.4** |
| Terminology glossary manage | MI.17 APIs | Missing (inbox will cover pending) | **5.5** |
| Client methods for all of the above | facade | `mi/client.js` incomplete | **5.1** |

## Explicitly out of Wave 5

- Go / SQL / OpenAPI changes  
- Embedding this SPA into the Go binary  
- Replacing `:8011/mi` lab (keep as soak lab)  
- `advice_at_approve` Official sidecar  
- Auto-confirm aliases / auto-create people from speech  
- Case A media studio as a primary path  
- Call Center engines/flows/pins on MI screens  

---

## Serial order

```text
5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6
```

Depends: **3.5 Closed** (and preferably **4.1** for shared chrome).  
Do not start 5.2 until 5.1 client methods exist.  
Do not start 5.4 until 5.3 can turn insights flags on.  
**5.6** is human soak only.
