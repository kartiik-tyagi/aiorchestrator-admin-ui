/**
 * Meeting Intelligence shapes (docs/meeting-intelligence/08_API_CONTRACTS.md).
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
 * @typedef {Object} MiMeetingFacet
 * @property {string} id
 * @property {string} [profile_id]
 * @property {string} [title]
 * @property {string} [state]
 * @property {string} [updated_at]
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
 * @property {number} [revision]
 */

export {}
