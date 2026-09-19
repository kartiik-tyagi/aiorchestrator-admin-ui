/**
 * Shapes of the orchestrator's Control API, as JSDoc typedefs.
 *
 * Plain JS carries no compile-time types, but these typedefs still give editors
 * autocomplete and hover docs, and they are the written record of what the
 * backend actually accepts. Keep them in step with the Go source.
 *
 * Source of truth is the Go code, NOT api/openapi.yaml — that file is a stale
 * Phase B stub (no flows/bindings/engines/credentials/settings/pins, missing
 * clock=chat, still documents the dropped /v1/kb/* endpoints).
 *
 * References:
 *   internal/profile/validate.go   — profile Document
 *   internal/flow/doc.go           — coral.flow.v1 Document
 *   internal/control/*.go          — request/response envelopes
 */

/** The only flow schema the kernel accepts. */
export const FLOW_SCHEMA_ID = 'coral.flow.v1'

/** Node types, closed set (internal/flow/doc.go). Always read them from the catalog at runtime. */
export const NODE_TYPES = [
  'Entry',
  'Speak',
  'ListenChoice',
  'ListenLanguage',
  'ListenSlot',
  'Decide',
  'Inform',
  'Tool',
  'End',
]

/** Edge kinds, closed set. */
export const EDGE_KINDS = [
  'next',
  'option',
  'intent',
  'retry',
  'back',
  'skip',
  'repair',
  'tool_result',
  'global',
]

/** Tool verbs allowed on a Tool node. */
export const TOOL_VERBS = ['transfer', 'hangup']

/** ListenSlot validators — copy of internal/flow/slot.go until the catalog exposes them. */
export const SLOT_VALIDATORS = ['nonempty', 'enum', 'regex']

/** Decide when.slot keys always allowed, plus any ListenSlot-declared key. */
export const WELL_KNOWN_SLOTS = [
  'active_language',
  'preferred_language',
  'department',
  'ani',
  'transfer_target',
  'transfer_number',
]

/** Node interrupt modes — copy of Go; unused in 1.3 UI, catalog later. */
export const INTERRUPT_MODES = ['inherit', 'barge_in', 'hotword', 'none']

/** Ports a gateway can be registered on. */
export const PORTS = ['listen', 'speak', 'think', 'translate', 'knowledge', 'skill']

/* ------------------------------------------------------------------ errors */

/**
 * @typedef {'unauthorized'|'forbidden'|'not_found'|'conflict'|'profile_invalid'
 *   |'flow_invalid'|'gateway_unavailable'|'rate_limited'|'bad_request'|'internal'} ErrorCode
 *
 * @typedef {Object} ErrorEnvelope
 * @property {{ code: ErrorCode, message: string, details?: Object }} error
 */

/* ----------------------------------------------------------------- catalog */

/**
 * GET /v1/meta/catalog — every dropdown in this app binds to this payload.
 *
 * @typedef {Object} MetaCatalog
 * @property {string}   schema_id
 * @property {string[]} node_types
 * @property {string[]} edge_kinds
 * @property {string[]} tools
 * @property {string[]} matrix_actions
 * @property {string[]} binding_kinds
 * @property {string[]} binding_statuses
 * @property {string[]} knowledge_modes
 * @property {string[]} clocks                 live | playback | chat
 * @property {string[]} disposition_final
 * @property {string[]} disposition_sources
 * @property {string[]} transcript_event_kinds
 * @property {string[]} audit_event_types
 * @property {string[]} speak_render_modes     configured | smart
 * @property {string[]} tts_locales_v1         the 11 locales bulbul:v3 supports
 */

/* ---------------------------------------------------------------- gateways */

/**
 * @typedef {'listen'|'speak'|'think'|'translate'|'knowledge'|'skill'} PortKind
 *
 * @typedef {Object} GatewayCapabilities
 * @property {boolean} Streaming
 * @property {boolean} Batch
 * @property {boolean} Partials
 * @property {boolean} Cancel
 * @property {boolean} SSML
 * @property {number[]|null} SampleRates
 *
 * @typedef {Object} Gateway
 * @property {string} id
 * @property {PortKind} port
 * @property {GatewayCapabilities} capabilities
 *
 * @typedef {Object} GatewaysResponse
 * @property {Record<PortKind, Gateway[]>} gateways
 *
 * @typedef {Object} PlatformStatus
 * @property {string}   status
 * @property {boolean}  db
 * @property {string}   store_backend
 * @property {string}   http_addr
 * @property {boolean}  ready_for_sessions
 * @property {string[]} blockers            e.g. tenant_engines_missing, no_profiles
 * @property {string[]} warnings
 * @property {boolean}  engines_configured
 * @property {{configured: boolean, listen?: string, think?: string, speak?: string, source?: string}} engines
 * @property {Record<string, number>} gateways
 * @property {{count: number}} profiles
 * @property {{count: number}} credentials
 *
 * @typedef {Object} Health
 * @property {string}  status
 * @property {boolean} db
 * @property {string}  store_backend
 */

/* ------------------------------------------------------- engines & tenant */

/**
 * @typedef {Object} TenantEngines
 * @property {string} tenant_id
 * @property {string} listen
 * @property {string} think
 * @property {string} speak
 * @property {string} [source]
 *
 * @typedef {Object} GatewayCredential
 * @property {string}  tenant_id
 * @property {string}  gateway_id
 * @property {boolean} api_key_set
 * @property {string}  [api_key_preview]  masked — the API never returns the key
 * @property {string}  updated_at
 *
 * @typedef {Object} SystemSetting
 * @property {string} tenant_id
 * @property {string} key
 * @property {string} value
 * @property {string} updated_at
 *
 * @typedef {Object} FallbackPrompt
 * @property {string} scenario
 * @property {string} [path]
 * @property {number} [bytes]
 *
 * @typedef {Object} FallbackList
 * @property {string} tenant_id
 * @property {string} root
 * @property {FallbackPrompt[]} prompts
 * @property {string[]} valid_scenarios  fixed server-side: ai_unavailable,
 *   credits_exhausted, timeout, system_busy, internal_error, generic
 */

/* ---------------------------------------------------------------- profiles */

/**
 * The full profile document (internal/profile/validate.go Document).
 *
 * Publish gates worth remembering:
 *  - at least one mode must be on
 *  - talk or speak requires persona.voice or persona.voice_id
 *  - audio.canonical_sample_rate_hz, when set, must be 8000–48000
 *  - grounding.required needs a knowledge provider
 *  - language.behaviour other than "" / "none" needs translate providers
 *  - every skills.allowed entry needs a skills.definitions entry
 *  - response.ladder tokens must be clip | template | llm
 *  - fallback *.speak_canned must name a clip defined in response.clips
 *  - every gateway id must be registered AND on the expected port
 *
 * @typedef {Object} RouterProviders
 * @property {string[]} [providers]
 *
 * @typedef {Object} SkillDefinition
 * @property {string}  [gateway]
 * @property {string}  [authority]  inform | decide | act
 * @property {boolean} [confirm]
 *
 * @typedef {Object} Rule
 * @property {string} [id]
 * @property {string} [phase]
 * @property {Object} [when]
 * @property {string} [action]
 * @property {string} [skill]
 * @property {string} [message]
 * @property {string} [text]
 *
 * @typedef {Object} PlaybookState
 * @property {string}   [on_intent]
 * @property {string}   [fallback]
 * @property {string[]} [slots]
 * @property {string}   [on_complete]
 *
 * @typedef {Object} Playbook
 * @property {string} [entry]
 * @property {Record<string, PlaybookState>} [states]
 *
 * @typedef {Object} CannedUtterance
 * @property {string} [text]
 * @property {Object} [when]
 *
 * @typedef {Object} ResponseConfig
 * @property {string[]} [ladder]  ordered tiers: clip | template | llm
 * @property {Record<string, CannedUtterance>} [clips]
 * @property {Record<string, CannedUtterance>} [templates]
 *
 * @typedef {Object} FallbackAction
 * @property {string}  [speak_canned]
 * @property {string}  [skill]
 * @property {boolean} [text_sink]
 *
 * @typedef {Object} FallbackConfig
 * @property {FallbackAction|null} [listen_down]
 * @property {FallbackAction|null} [think_down]
 * @property {FallbackAction|null} [speak_down]
 *
 * @typedef {Object} ProfileDocument
 * @property {string} [id]
 * @property {string} [tenant_id]
 * @property {{display_name?: string, family?: string}} [metadata]
 * @property {{canonical_sample_rate_hz?: number, frame_ms?: number}} [audio]
 * @property {{listen?: boolean, speak?: boolean, think?: boolean, talk?: boolean}} [modes]
 * @property {{name?: string, instructions?: string, voice_id?: string,
 *   voice?: Record<string, string>}} [persona]
 * @property {{behaviour?: string, primary?: string, allowed?: string[],
 *   auto_detect?: boolean, mid_call_switch?: boolean}} [language]
 * @property {string[]} [hot_swap_allowed]
 * @property {{required?: boolean}} [grounding]
 * @property {{listen?: RouterProviders, think?: RouterProviders, speak?: RouterProviders,
 *   knowledge?: RouterProviders, translate?: RouterProviders}} [routers]
 * @property {{allowed?: string[], definitions?: Record<string, SkillDefinition>}} [skills]
 * @property {{http_kb?: {gateway?: string}|null}} [knowledge]
 * @property {Rule[]} [rules]
 * @property {Playbook|null} [playbook]
 * @property {ResponseConfig|null} [response]
 * @property {FallbackConfig|null} [fallback]
 * @property {string}   [speak_render]            configured | smart
 * @property {string}   [speak_canonical_locale]
 * @property {string[]} [speak_fallback_locales]
 * @property {boolean}  [speak_locale_strict]
 * @property {boolean}  [speak_allow_canonical_fallback]
 * @property {{disposition?: {id?: string}|null, mom?: {id?: string}|null}} [templates]
 * @property {{emit?: string[]}} [analytics]
 *
 * @typedef {Object} ProfileSummary
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} [display_name]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 *
 * @typedef {Object} ProfileVersion
 * @property {string} [profile_id]
 * @property {number} version
 * @property {ProfileDocument} [document]
 * @property {ProfileDocument} [doc]
 */

/* ------------------------------------------------------------------- flows */

/**
 * coral.flow.v1 (internal/flow/doc.go Document).
 *
 * Publish gates worth remembering:
 *  - exactly one Entry node, and entry_node_id must point at it
 *  - Tool nodes need tool = transfer | hangup
 *  - Inform nodes need a binding_ref that also appears in binding_refs
 *  - every prompt_ref needs text in default_locale
 *  - matrix intents unique, action must be "transfer", number required
 *  - a transfer Tool must resolve to a matrix row (node.matrix_intent, else the
 *    first outgoing edge carrying matrix_intent)
 *  - disposition_code must be in the server allowlist
 *
 * @typedef {Object} FlowNodeRepair
 * @property {number} [max_retries]
 * @property {string} [unclear_prompt_ref]
 *
 * @typedef {Object} FlowNode
 * @property {string} id
 * @property {string} type          one of NODE_TYPES
 * @property {string} [prompt_ref]
 * @property {string} [binding_ref] required on Inform
 * @property {string} [tool]        required on Tool: transfer | hangup
 * @property {FlowNodeRepair} [repair]
 * @property {*}      [slot]
 * @property {*}      [decide]
 * @property {string[]} [global_intents]
 * @property {string[]} [allowed_intents]
 * @property {string} [matrix_intent]
 *
 * @typedef {Object} FlowEdge
 * @property {string} id
 * @property {string} from
 * @property {string} to
 * @property {string} kind          one of EDGE_KINDS
 * @property {string} [intent]
 * @property {string} [option]
 * @property {string} [matrix_intent]
 *
 * @typedef {Object} MatrixRow
 * @property {string} intent
 * @property {string} owner
 * @property {string} target
 * @property {string} number
 * @property {string} action            must be "transfer" in V1
 * @property {string} [disposition_code]
 *
 * @typedef {Object} FlowCX
 * @property {Record<string, {x: number, y: number}>} [layout]
 *
 * @typedef {Object} FlowDocument
 * @property {string} schema_id
 * @property {string} entry_node_id
 * @property {string} default_locale
 * @property {FlowNode[]} nodes
 * @property {FlowEdge[]} edges
 * @property {Record<string, Record<string, string>>} prompts  prompt_ref → locale → text
 * @property {MatrixRow[]} matrix
 * @property {string[]} binding_refs
 * @property {string[]} [globals]
 * @property {FlowCX} [cx]  rejected by the kernel when non-empty — do not send; layout is localStorage only
 *
 * @typedef {Object} FlowSummary
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} [name]
 * @property {string} [direction]
 * @property {string} [status]
 * @property {number} [current_version]
 *
 * @typedef {Object} FlowDraft
 * @property {string} [flow_id]
 * @property {FlowDocument} doc
 * @property {string} [updated_at]
 *
 * @typedef {Object} FlowVersionResponse
 * @property {string} [flow_id]
 * @property {number} version
 * @property {FlowDocument} doc
 * @property {string} [content_hash]
 * @property {string} [published_at]
 *
 * @typedef {Object} PromptLocaleWarning
 * @property {string} code
 * @property {string} message
 * @property {string} [prompt_ref]
 * @property {string[]} [missing_locales]
 *
 * @typedef {Object} PublishFlowResponse
 * @property {string} flow_id
 * @property {number} version
 * @property {string} [content_hash]
 * @property {string} [published_by]
 * @property {string} [published_at]
 * @property {PromptLocaleWarning[]} [warnings]  non-blocking locale gaps
 */

/* ---------------------------------------------------------------- bindings */

/**
 * @typedef {Object} InlineFaqEntry
 * @property {string} id
 * @property {string[]} [questions]
 * @property {string[]} [aliases]   noisy / roman STT variants
 * @property {string[]} [intents]   catalog intent ids this entry answers
 * @property {string} [department]  room steer — not a hard block
 * @property {string} [product]     product steer
 * @property {Record<string, string>} [text]  locale → answer
 *
 * @typedef {Object} BindingConfig
 * @property {string} [mode]  inline_faq | http_retrieve
 * @property {InlineFaqEntry[]} [entries]
 * @property {string} [gateway_id]
 * @property {string} [path]
 *
 * @typedef {Object} Binding
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} kind    knowledge | crm
 * @property {string} name
 * @property {BindingConfig} config  must never contain api_key — server rejects it
 * @property {string} status  active | disabled
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/* -------------------------------------------------------------------- pins */

/**
 * @typedef {Object} AnswerPin
 * @property {string} profile_id
 * @property {string} flow_id
 * @property {string} flow_version  "latest" or a decimal version string
 * @property {string} [did]
 * @property {string} [note]
 *
 * @typedef {Object} AnswerPinsResponse
 * @property {string} tenant_id
 * @property {AnswerPin[]} pins
 */

export {}
