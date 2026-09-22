/**
 * The configuration order, defined once.
 *
 * Both the sidebar and the dashboard read this, so the numbering can never drift
 * between them. The order follows the repo's own acceptance checklist,
 * docs/phases/A.6_admin_soak_checklist.md: engines → profile → binding → flow → pin.
 *
 * Why this order:
 *   1 Engines    nothing runs without listen/think/speak bound to a gateway
 *   2 Profile    references those gateways; publish fails if they are not registered
 *   3 Bindings   must exist before a flow's Inform node can reference one
 *   3b API       optional CRM: profile api_integrations + secrets, then Tool api on the flow
 *   4 Flow       references bindings / Tool api_ids, and publish enforces the whole graph
 *   5 Pin        needs a published profile AND a published flow to point at
 *   6 Settings   ops values and failure prompts; not needed for a first call
 */

export const SETUP_STEPS = [
  {
    n: 1,
    to: '/CC/admin/engines',
    label: 'Engines & credentials',
    short: 'Engines',
    why: 'Bind listen / think / speak to a registered gateway, and store the vendor API key.',
  },
  {
    n: 2,
    to: '/CC/admin/profiles',
    label: 'Profiles',
    short: 'Profile',
    why: 'Create the bot identity and publish version 1 — voice, locales, routers. Add api_integrations + API secrets here for CRM Tool(api).',
  },
  {
    n: 3,
    to: '/CC/admin/bindings',
    label: 'Bindings',
    short: 'Binding',
    why: 'Optional. Only needed if the flow answers FAQs from an Inform node.',
    optional: true,
  },
  {
    n: 4,
    to: '/CC/admin/flows',
    label: 'Flows',
    short: 'Flow',
    why: 'Draw the conversation graph and publish it. For CRM: Tool verb api + api_id + three tool_result edges; bind the profile before publish.',
  },
  {
    n: 5,
    to: '/CC/admin/pins',
    label: 'Answer pins',
    short: 'Pin',
    why: 'Tie the profile to the published flow version. Without this every call is refused.',
  },
  {
    n: 6,
    to: '/CC/admin/settings',
    label: 'Settings & fallback',
    short: 'Settings',
    why: 'coral.base_url for transfers, and WAV prompts for when the AI pipeline fails.',
    optional: true,
  },
]

/**
 * True readiness, which is stricter than the server's.
 *
 * GET /v1/platform/status reports ready_for_sessions from db + engines + gateway
 * registry + "at least one profile ROW exists". It does not check that the
 * profile has a published version, that any flow exists or is published, or that
 * an answer pin points at them (internal/control/ui.go handlePlatformStatus).
 *
 * So the server can say "ready" while every call still fails with
 * 422 flow_pin_required. This computes what actually has to be true.
 *
 * @returns {{n: number, label: string, to: string, done: boolean, optional?: boolean,
 *   detail: string}[]}
 */
export function readinessChecklist({ status, profiles, flows, bindings, pins, publishedProfiles }) {
  const enginesOk = !!status?.engines_configured
  const engineIds = status?.engines ?? {}

  const profileCount = profiles?.length ?? 0
  const publishedCount = publishedProfiles?.size ?? 0

  const flowList = flows ?? []
  // current_version is 0 (status "draft") until the first publish — not null.
  const publishedFlows = flowList.filter((f) => (f.current_version ?? 0) > 0)

  const pinList = pins ?? []
  // A pin only counts if it names a flow that actually has a published version.
  const livePins = pinList.filter(
    (p) =>
      p.profile_id &&
      p.flow_id &&
      publishedFlows.some((f) => f.id === p.flow_id) &&
      publishedProfiles?.has(p.profile_id),
  )

  return [
    {
      n: 1,
      label: 'Engines bound',
      to: '/CC/admin/engines',
      done: enginesOk,
      detail: enginesOk
        ? `${engineIds.listen} / ${engineIds.think} / ${engineIds.speak}`
        : 'No listen / think / speak binding yet',
    },
    {
      n: 2,
      label: 'Profile published',
      to: '/CC/admin/profiles',
      done: publishedCount > 0,
      detail:
        publishedCount > 0
          ? `${publishedCount} of ${profileCount} profile(s) have a published version`
          : profileCount > 0
            ? `${profileCount} profile(s) exist but none is published — the server still calls this "ready"`
            : 'No profiles',
    },
    {
      n: 3,
      label: 'Binding created',
      to: '/CC/admin/bindings',
      optional: true,
      done: (bindings?.length ?? 0) > 0,
      detail: bindings?.length
        ? `${bindings.length} binding(s)`
        : 'None — only needed for Inform / FAQ nodes',
    },
    {
      n: 4,
      label: 'Flow published',
      to: '/CC/admin/flows',
      done: publishedFlows.length > 0,
      detail: publishedFlows.length
        ? publishedFlows.map((f) => `${f.id}@v${f.current_version}`).join(', ')
        : flowList.length
          ? `${flowList.length} flow(s) exist but none is published`
          : 'No flows',
    },
    {
      n: 5,
      label: 'Answer pin live',
      to: '/CC/admin/pins',
      done: livePins.length > 0,
      detail: livePins.length
        ? `${livePins.length} pin(s) resolve to a published flow and profile`
        : pinList.length
          ? 'Pins exist but none resolves to a published flow + profile'
          : 'No pins — every live or chat session will be refused',
    },
  ]
}
