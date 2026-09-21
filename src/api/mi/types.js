/**
 * Meeting Intelligence shapes (docs/meeting-intelligence/08_API_CONTRACTS.md + Wave 5).
 * Do not import Call Center ProfileDocument or coral.flow.v1 types here.
 */

/**
 * @typedef {Object} MiHealth
 * @property {string} status
 * @property {boolean} [db]
 * @property {string} [product]
 */

/**
 * @typedef {Object} MiProfileSummary
 * @property {string} id
 * @property {string} [title]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} MiInsightsFacet
 * @property {string} [status]
 * @property {boolean} [stale]
 * @property {number} [source_draft_version]
 * @property {number} [draft_version]
 * @property {Object|string} [meeting_summary]
 * @property {MiFeedbackPayload|Object} [ai_feedback]
 * @property {string} [error_code]
 */

/**
 * @typedef {Object} MiMeetingFacet
 * @property {string} id
 * @property {string} [profile_id]
 * @property {string} [title]
 * @property {string} [state]
 * @property {string} [lifecycle]
 * @property {string} [updated_at]
 * @property {MiInsightsFacet} [insights]
 */

/**
 * @typedef {Object} MiMomSection
 * @property {string} id
 * @property {string} [title]
 *
 * @typedef {Object} MiProfile
 * @property {string} id
 * @property {string} name
 * @property {string[]|string} [languages]
 * @property {{sections?: MiMomSection[]}} [mom_template]
 * @property {Object} [rules]
 * @property {Object} [memory_policy]
 * @property {string} [b_authority_policy]
 * @property {{transcript_days?: number}} [retention]
 *
 * @typedef {Object} MiKbDoc
 * @property {string} id
 * @property {string} [title]
 * @property {string} [body]
 * @property {string} [label]
 * @property {number} [revision]
 */

/**
 * Profile memory inbox row (MI.32) — kind kb_alias | term_alias.
 * @typedef {Object} MemoryInboxItem
 * @property {string} item_id
 * @property {string} kind
 * @property {string} [alias_id]
 * @property {string} [alias]
 * @property {string} [alias_norm]
 * @property {string} [status]
 * @property {string} [entity_id]
 * @property {string} [entity_name]
 * @property {string} [terminology_id]
 * @property {string} [canonical_term]
 * @property {string} [provenance]
 * @property {number} [confidence]
 * @property {string} [created_at]
 */

/**
 * @typedef {Object} MiFeedbackBasis
 * @property {string} [type]
 * @property {string} [id]
 * @property {string} [label]
 *
 * @typedef {Object} MiFeedbackItem
 * @property {string} [id]
 * @property {string} [kind]
 * @property {string} [text]
 * @property {MiFeedbackBasis[]} [basis]
 *
 * @typedef {Object} MiFeedbackPayload
 * @property {MiFeedbackItem[]} [items]
 * @property {boolean} [abstained]
 * @property {string} [reason]
 */

/**
 * @typedef {Object} MiKbEntity
 * @property {string} id
 * @property {string} [profile_id]
 * @property {string} [entity_type]
 * @property {string} [name]
 * @property {string} [status]
 */

export {}
