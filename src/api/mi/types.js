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

export {}
