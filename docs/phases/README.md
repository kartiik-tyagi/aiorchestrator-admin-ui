# Admin UI phase plans

Programme lock: [PROGRAMME.md](./PROGRAMME.md).  
Wave 5 gap inventory: [WAVE_5_GAP.md](./WAVE_5_GAP.md).

These are **UI-only** implementation plans for `aiorchestrator-admin-ui`. Implement one phase at a time. Do not start a later phase until the previous wave’s exit criteria pass (see PROGRAMME serial order).

| Id | Wave | Document | Operator outcome |
|---|---|---|---|
| **0.1** | Shared | [0.1_product_home_shells.md](./0.1_product_home_shells.md) | I choose Call Center or Meeting Intelligence. Bookmarks stay stable. |
| **1.1** | CC safety | [1.1_cc_layout_out_of_document.md](./1.1_cc_layout_out_of_document.md) | I can save and publish a live flow without a `cx` 422. |
| **1.2** | CC safety | [1.2_cc_bindings_retrieve.md](./1.2_cc_bindings_retrieve.md) | I can edit FAQ without stripping retrieve keys. |
| **1.3** | CC safety | [1.3_cc_validator_truth.md](./1.3_cc_validator_truth.md) | The builder does not lie about Decide or globals. |
| **2.1** | CC sync | [2.1_cc_profile_industrial.md](./2.1_cc_profile_industrial.md) | I can edit intents, barge, levels, and TTS pace on a form. |
| **2.2** | CC sync | [2.2_cc_flow_inspector.md](./2.2_cc_flow_inspector.md) | I can edit interrupt, listen policy, globals, Decide, slots. |
| **2.3** | CC sync | [2.3_cc_dashboard_pins.md](./2.3_cc_dashboard_pins.md) | I know why a DID will not answer and can prove a pin. |
| **2.4** | CC sync | [2.4_cc_polish_create_path.md](./2.4_cc_polish_create_path.md) | I can create a tiny inbound desk from the UI only. |
| **3.1** | MI | [3.1_mi_client_home.md](./3.1_mi_client_home.md) | I open MI and know the module is alive. |
| **3.2** | MI | [3.2_mi_profiles_kb.md](./3.2_mi_profiles_kb.md) | I can create an MI profile and paste KB. |
| **3.3** | MI | [3.3_mi_meetings_caseb.md](./3.3_mi_meetings_caseb.md) | I can create a meeting, push Case B, see the transcript. |
| **3.4** | MI | [3.4_mi_draft_approve.md](./3.4_mi_draft_approve.md) | I can edit minutes and lock an official version. |
| **3.5** | MI | [3.5_mi_ask_ledger_purge.md](./3.5_mi_ask_ledger_purge.md) | I can Ask with citations, or abstain; purge is hard to do by accident. |
| **4.1** | Finish | [4.1_shared_polish.md](./4.1_shared_polish.md) | Both products feel like one console family. |
| **4.2** | Finish | [4.2_dual_soak.md](./4.2_dual_soak.md) | Human soak: live CC docs unharmed; MI Case B → Approve → Ask. |
| **5.1** | MI memory | [5.1_mi_client_memory_insights.md](./5.1_mi_client_memory_insights.md) | Client covers inbox, directory, insights, terminology routes. |
| **5.2** | MI memory | [5.2_mi_profile_directory.md](./5.2_mi_profile_directory.md) | I can seed people/products CSV and enable KG. |
| **5.3** | MI memory | [5.3_mi_memory_inbox_flags.md](./5.3_mi_memory_inbox_flags.md) | I can confirm inbox items and toggle Summary/Feedback flags. |
| **5.4** | MI memory | [5.4_mi_meeting_insights.md](./5.4_mi_meeting_insights.md) | I can read Summary/Feedback and refresh when stale. |
| **5.5** | MI memory | [5.5_mi_terminology_home.md](./5.5_mi_terminology_home.md) | I can maintain the speech glossary without confusing it with the directory. |
| **5.6** | MI memory | [5.6_mi_memory_insights_soak.md](./5.6_mi_memory_insights_soak.md) | Human soak proves memory + insights from `/MI/admin`. |

**Cursor:** Waves **0–4 Closed**. Next implementable phase: **5.1**.

Each phase file has the same shape: operator outcome, in/out, backend contract, current baseline, UX, files, do/do-not, exit criteria, verify, risks.
