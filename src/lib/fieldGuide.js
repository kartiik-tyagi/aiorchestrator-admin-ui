/**
 * Field-by-field reference for the tutorial page.
 *
 * Every "required" flag and every behaviour note below was checked against the
 * Go source, not assumed:
 *   internal/profile/validate.go   — profile publish gates
 *   internal/flow/validate.go      — flow publish gates
 *   internal/control/*.go          — request validation
 *   internal/runtime/**            — what actually gets read during a call
 *
 * `req` values:
 *   'required'    save or publish fails without it
 *   'conditional' required only in the case described
 *   'optional'    genuinely optional
 *   'unused'      accepted and stored, but no runtime code reads it today.
 *                 Kept honest deliberately — filling these changes nothing yet.
 */

export const REQ_LABEL = {
  required: { text: 'required', cls: 'err' },
  conditional: { text: 'conditional', cls: 'warn' },
  optional: { text: 'optional', cls: '' },
  unused: { text: 'not read yet', cls: '' },
}

export const FIELD_GUIDE = [
  /* ------------------------------------------------------------------ 1 */
  {
    step: 1,
    page: 'Engines & credentials',
    to: '/CC/admin/engines',
    intro:
      'Which vendor software does the hearing, the thinking and the talking. Nothing else works until this is set.',
    groups: [
      {
        title: 'Tenant engines',
        fields: [
          {
            name: 'Listen (STT)',
            req: 'required',
            what: 'The speech-to-text gateway. Written to tenant_engines.listen; the server rejects any id not registered on the listen port.',
            plain:
              'The bot’s ears. It turns what the caller says into text. Pick fake-listen to try things out without a vendor account, or sarvam-stt for real speech.',
          },
          {
            name: 'Think (LLM)',
            req: 'required',
            what: 'The language model gateway. It never invents where the conversation goes — it only picks among the edges leaving the current node.',
            plain:
              'The bot’s understanding. It reads the caller’s words and decides which of the paths you drew fits best. It cannot go anywhere you have not drawn.',
          },
          {
            name: 'Speak (TTS)',
            req: 'required',
            what: 'The text-to-speech gateway. Renders the prompt text for the call’s active language.',
            plain: 'The bot’s voice. It reads your prompts out loud to the caller.',
          },
        ],
      },
      {
        title: 'Gateway credential',
        fields: [
          {
            name: 'Gateway',
            req: 'conditional',
            what: 'Which adapter the key belongs to. The Sarvam lookup tries sarvam, sarvam-stt, sarvam-llm, sarvam-tts in that order and takes the first key it finds.',
            plain:
              'Only needed for real vendors. Save one key under the id "sarvam" and all three Sarvam engines will use it — you do not need to paste it three times.',
          },
          {
            name: 'API key',
            req: 'conditional',
            what: 'Write-only. The API returns api_key_set and a masked preview, never the value. An empty key is rejected with 400.',
            plain:
              'Your vendor password. Once saved you can never read it back from here, so keep a copy somewhere safe. The fake-* engines need no key at all.',
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ 2 */
  {
    step: 2,
    page: 'Profiles',
    to: '/CC/admin/profiles',
    intro:
      'The bot’s identity — its voice, which engines it routes to, and how it renders speech. Publishing creates an immutable version; nothing is ever edited in place.',
    groups: [
      {
        title: 'Identity',
        fields: [
          {
            name: 'Profile id',
            req: 'required',
            what: 'Primary key. Cannot be renamed — versions, sessions and pins all key off it.',
            plain:
              'The permanent name. Choose carefully: to change it you must create a new profile and delete the old one.',
          },
          {
            name: 'Display name',
            req: 'optional',
            what: 'metadata.display_name. Shown in listings only.',
            plain: 'A friendly label for humans. Has no effect on calls.',
          },
          {
            name: 'Family',
            req: 'optional',
            what: 'metadata.family. The only runtime check is a legacy one comparing it to "contact-agent" in tenant_engines.go — irrelevant to a voice desk.',
            plain: 'A grouping tag. Safe to leave blank.',
          },
          {
            name: 'intent_catalog',
            req: 'optional',
            what: 'Ids the agent turn may choose. Empty means the bot can only follow edges you drew.',
            plain:
              'Leave empty on a new desk. Do not paste a production catalog into a demo profile.',
          },
          {
            name: 'timezone / date_order',
            req: 'conditional',
            what: 'IANA timezone and dmy|mdy|ymd for typed Listen date/time. Required when any ListenSlot uses date, time, or datetime.',
            plain: 'Set timezone (e.g. Asia/Kolkata) before collecting dates from callers.',
          },
          {
            name: 'api_integrations',
            req: 'optional',
            what: 'Non-secret Tool(api) definitions: URL, maps, success policy. Secrets live under API secrets, never in this JSON.',
            plain: 'Declare CRM/HTTP lookups here, then set the secret below, then reference the id from a Tool api step on the flow.',
          },
          {
            name: 'API secrets',
            req: 'conditional',
            what: 'Masked PUT/GET on /v1/profiles/{id}/api-secrets. Required when auth_type is not none. Snapshotted on profile publish.',
            plain: 'Write-only tokens. Publish stays blocked until each authed integration has a secret set.',
          },
        ],
      },
      {
        title: 'Modes & audio',
        fields: [
          {
            name: 'listen / speak / think / talk',
            req: 'required',
            what: 'At least one must be on, or publish fails. Turning on talk or speak makes a persona voice mandatory.',
            plain:
              'Which abilities this bot has. For a phone bot turn all four on. "talk" means it holds a two-way conversation rather than just playing audio.',
          },
          {
            name: 'Canonical sample rate (Hz)',
            req: 'optional',
            what: 'Must be 8000–48000 when set. Defaults to 16000. Pins the audio rate for the whole session.',
            plain:
              'Audio quality. 16000 is the normal choice; 8000 is telephone quality. Leave it at 16000 unless someone tells you otherwise.',
          },
          {
            name: 'Frame (ms)',
            req: 'optional',
            what: 'Audio chunk size on the media path. 20 is the standard.',
            plain: 'How finely the audio is sliced as it streams. Leave at 20.',
          },
        ],
      },
      {
        title: 'Persona',
        fields: [
          {
            name: 'Voice per speak gateway',
            req: 'conditional',
            what: 'persona.voice[gateway] — required as soon as talk or speak is on, or publish fails with 422. Takes precedence over voice_id for the bound gateway.',
            plain:
              'Which speaker the bot sounds like. Sarvam options include shubh, aditya, rahul (male) and ritu, priya, neha (female). You must set one, or the profile will not publish.',
          },
          {
            name: 'Default voice id',
            req: 'optional',
            what: 'persona.voice_id — the fallback used when no per-gateway voice matches.',
            plain:
              'A backup voice used if you have not named one for the specific speaking engine.',
          },
          {
            name: 'Name / Instructions',
            req: 'unused',
            what: 'persona.name and persona.instructions are stored but no runtime code reads them.',
            plain:
              'Currently decorative. Writing a personality here does nothing yet — the bot’s words come from your flow prompts.',
          },
        ],
      },
      {
        title: 'Language',
        note: 'Read this one carefully — most of it is not wired up yet.',
        fields: [
          {
            name: 'Behaviour',
            req: 'required',
            what: 'Anything other than "" or "none" forces translate providers to be bound, or publish fails.',
            plain:
              'Leave it as "none". Any other value demands a translation engine you almost certainly do not have.',
          },
          {
            name: 'Primary locale',
            req: 'optional',
            what: 'Only read by PATCH /v1/sessions/{id}/profile-fields for a mid-call switch. Not used to pick the language at answer time.',
            plain:
              'The intended default language. Does not actually decide anything on a normal call.',
          },
          {
            name: 'Allowed locales',
            req: 'unused',
            what: 'session.SetLanguageAllowlist() exists in the runtime but has no caller, so this list is never applied.',
            plain:
              'Documents which languages you intend to support. Today the real control is the ListenLanguage node in your flow — its edges decide which languages a caller can choose.',
          },
          {
            name: 'Auto-detect language',
            req: 'unused',
            what: 'No runtime code reads language.auto_detect.',
            plain: 'Has no effect at present.',
          },
          {
            name: 'Mid-call switch',
            req: 'optional',
            what: 'Gates PATCH /v1/sessions/{id}/profile-fields — without it a live language change is refused.',
            plain:
              'Lets an operator change the language part-way through a call via the API. Callers cannot trigger it themselves (that is EC-24, still unbuilt).',
          },
        ],
      },
      {
        title: 'Routers',
        fields: [
          {
            name: 'listen / think / speak providers',
            req: 'required',
            what: 'Ordered lists. Every id must be registered AND on that exact port, or publish fails with 422 naming the field.',
            plain:
              'Which engine this profile uses for each job. Usually the same three you picked in step 1. The first is used; the rest are backups.',
          },
          {
            name: 'knowledge providers',
            req: 'conditional',
            what: 'Required only when grounding.required is on.',
            plain:
              'Only needed if you switch on "grounding required" below. Otherwise leave empty.',
          },
          {
            name: 'translate providers',
            req: 'conditional',
            what: 'Required when language.behaviour is anything other than "" or "none".',
            plain: 'Only needed for translation. Leave empty and keep behaviour on "none".',
          },
        ],
      },
      {
        title: 'Speak render policy',
        fields: [
          {
            name: 'speak_render',
            req: 'optional',
            what: 'configured | smart. Anything else fails publish. Defaults to configured.',
            plain:
              '"configured" reads your prompt exactly as written — predictable, and what you want on a phone line. "smart" lets the LLM reword it, which sounds more natural but can drift. Tool closing lines are always read exactly, whichever you pick.',
          },
          {
            name: 'Canonical locale',
            req: 'optional',
            what: 'The locale used when the active language has no prompt of its own. Defaults to en-IN.',
            plain: 'The language to fall back on when you have not translated a prompt.',
          },
          {
            name: 'Fallback locales',
            req: 'optional',
            what: 'Ordered list tried before the canonical locale.',
            plain: 'Other languages to try before giving up and using the canonical one.',
          },
          {
            name: 'Locale strict',
            req: 'optional',
            what: 'When on, the desk refuses to speak a locale it has no prompt for rather than leaking another language’s text.',
            plain:
              'Safety switch. On means "say nothing rather than answer a Hindi caller in English". Recommended for a real desk.',
          },
          {
            name: 'Allow canonical fallback',
            req: 'optional',
            what: 'Permits falling back to the canonical locale even under strict mode.',
            plain: 'Softens the switch above — allows one specific fallback rather than silence.',
          },
        ],
      },
      {
        title: 'Advanced sections',
        note: 'All optional. Most desks never touch these.',
        fields: [
          {
            name: 'Grounding required',
            req: 'optional',
            what: 'When on, at least one knowledge provider becomes mandatory or publish fails.',
            plain:
              'Forces the bot to answer only from a knowledge source. Leave off unless you know you need it.',
          },
          {
            name: 'knowledge.http_kb.gateway',
            req: 'optional',
            what: 'Must be a gateway registered on the knowledge port.',
            plain:
              'An external knowledge service. Most desks use an inline FAQ binding instead (step 3).',
          },
          {
            name: 'skills.allowed + definitions',
            req: 'conditional',
            what: 'Every name in allowed must have a matching definition, or publish fails. A definition’s gateway must be on the skill port. Authority is inform | decide | act.',
            plain:
              'Extra actions the bot may take, such as a CRM lookup. If you list a skill name you must also describe it, or publishing is refused.',
          },
          {
            name: 'response.ladder',
            req: 'optional',
            what: 'Ordered tiers, only clip | template | llm accepted. Any other token fails publish.',
            plain:
              'The order the bot tries when composing a reply: a canned clip, a template, then the LLM.',
          },
          {
            name: 'response.clips / templates',
            req: 'optional',
            what: 'Named canned utterances. Clip ids are referenced by the fallback section.',
            plain: 'Pre-written lines you can reuse by name.',
          },
          {
            name: 'fallback.listen/think/speak_down',
            req: 'optional',
            what: 'speak_canned must name a clip defined in response.clips, or publish fails.',
            plain:
              'What to say when part of the pipeline dies mid-call. If you name a clip here it must actually exist above.',
          },
          {
            name: 'rules / playbook',
            req: 'optional',
            what: 'Declarative Think-path policies and an optional FSM. Consumed by the think path.',
            plain: 'Advanced behaviour tuning. Safe to ignore for a first desk.',
          },
          {
            name: 'templates.mom.id',
            req: 'unused',
            what: 'No runtime code reads templates.mom.',
            plain: 'Has no effect at present.',
          },
          {
            name: 'analytics.emit / hot_swap_allowed',
            req: 'optional',
            what: 'analytics.emit selects metrics; hot_swap_allowed lists fields the profile-fields PATCH may change live.',
            plain:
              'Which numbers to record, and which settings an operator may change during a live call.',
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ 3 */
  {
    step: 3,
    page: 'Bindings',
    to: '/CC/admin/bindings',
    intro:
      'A knowledge source an Inform node reads answers from. Skip this entirely if your flow only routes calls.',
    groups: [
      {
        title: 'Binding',
        fields: [
          {
            name: 'Binding id',
            req: 'required',
            what: 'Primary key. The flow references this exact string in binding_refs and on its Inform nodes.',
            plain:
              'The permanent name. Your flow will point at it by this name, so keep it short and stable.',
          },
          {
            name: 'Kind',
            req: 'required',
            what: 'knowledge | crm, from the server catalog.',
            plain: 'Use "knowledge" for a FAQ. "crm" is for customer lookups.',
          },
          {
            name: 'Status',
            req: 'required',
            what: 'active | disabled. inform.go refuses any binding that is not active, immediately and reversibly.',
            plain:
              'A safe on/off switch. Disabling stops the bot using it right away without deleting the content — the reversible alternative to deleting.',
          },
          {
            name: 'Knowledge mode',
            req: 'required',
            what: 'inline_faq | http_retrieve. Anything else is rejected.',
            plain:
              '"inline_faq" keeps the answers right here — simplest, and what the lab desk uses. "http_retrieve" asks an external service instead.',
          },
        ],
      },
      {
        title: 'Inline FAQ entry',
        fields: [
          {
            name: 'Entry id',
            req: 'required',
            what: 'Identifies the entry within the binding.',
            plain: 'A short name for this question-and-answer pair, like "refund-policy".',
          },
          {
            name: 'Questions',
            req: 'required',
            what: 'The phrases matched against the caller utterance.',
            plain:
              'Different ways a caller might ask this. Add several — "opening hours", "when do you open", "what time".',
          },
          {
            name: 'Aliases',
            req: 'optional',
            what: 'Noisy or roman STT variants. Scored with questions when the caller mangles the name.',
            plain:
              'How the words come out of speech-to-text when the caller slurs or code-switches — e.g. "media gate bhege".',
          },
          {
            name: 'Intents',
            req: 'optional',
            what: 'Catalog intent ids this entry answers. Must match an intent id on the profile that will use this binding.',
            plain: 'Ties this answer to a named intent such as product_question or media_gateway.',
          },
          {
            name: 'Department',
            req: 'optional',
            what: 'Room steer (sales / support / billing). Not a hard block.',
            plain: 'Which room this answer belongs with, so the bot can prefer it when the caller is already in that room.',
          },
          {
            name: 'Product',
            req: 'optional',
            what: 'Product steer (IRIS IVDX, Media Gateway, …).',
            plain: 'Which product this answer is about, so a mangled product name still finds this entry.',
          },
          {
            name: 'Answer text per locale',
            req: 'conditional',
            what: 'The default locale is what matters; missing locales produce non-blocking FAQ locale warnings on flow publish.',
            plain:
              'What the bot says back, per language. Fill English at minimum. Missing translations are a warning, not an error — the desk just cannot answer that question in that language.',
          },
        ],
      },
      {
        title: 'Never put this in config',
        fields: [
          {
            name: 'api_key',
            req: 'required',
            what: 'The server explicitly rejects any binding config containing an api_key field.',
            plain: 'Keys belong in step 1, not here. The server will refuse to save it.',
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ 4 */
  {
    step: 4,
    page: 'Flows & the graph builder',
    to: '/CC/admin/flows',
    intro:
      'The conversation itself. The graph is law: the bot may only travel along edges you have drawn, which is what makes it safe on a phone line.',
    groups: [
      {
        title: 'Flow registry',
        fields: [
          {
            name: 'Flow id',
            req: 'required',
            what: 'Primary key; publishing and pinning both key off it. Cannot be renamed.',
            plain:
              'The permanent name of this conversation. To change it you would create a new flow and delete this one.',
          },
          {
            name: 'Name / Direction',
            req: 'optional',
            what: 'Labels only. Direction is inbound or outbound.',
            plain: 'Human labels. "inbound" means callers ring you.',
          },
        ],
      },
      {
        title: 'Document settings',
        fields: [
          {
            name: 'Entry node',
            req: 'required',
            what: 'entry_node_id must name a node whose type is Entry, and exactly one Entry node may exist.',
            plain: 'Where every call begins. There can only be one starting point.',
          },
          {
            name: 'Default locale',
            req: 'required',
            what: 'Every prompt must have text in this locale or publish fails.',
            plain:
              'The main language of this flow. Every single prompt needs words in this language before you can publish — the others are optional.',
          },
          {
            name: 'binding_refs',
            req: 'conditional',
            what: 'Any binding used by an Inform node must also appear in this list, or publish fails.',
            plain:
              'A declaration of which knowledge sources this flow may use. Catches everyone once: pointing an Inform node at a binding is not enough, it has to be listed here too.',
          },
          {
            name: 'globals',
            req: 'optional',
            what: 'Edge ids of kind=global that are armed. Empty while global edges exist means they never fire.',
            plain: 'Global edges exist but are not armed on the flow until you list them here.',
          },
          {
            name: 'Canvas layout',
            req: 'optional',
            what: 'Stored in this browser (localStorage). A non-empty cx on the document is rejected at validate.',
            plain: 'Where boxes sit on the canvas. Never part of the published flow.',
          },
        ],
      },
      {
        title: 'Node fields',
        fields: [
          {
            name: 'Node id',
            req: 'required',
            what: 'Must be unique. Renaming in the builder rewrites every edge, the entry pointer and the saved layout.',
            plain: 'A short name for this step, like "greeting" or "ask_department".',
          },
          {
            name: 'Type',
            req: 'required',
            what: 'One of nine closed types from the catalog. Entry, Speak, ListenChoice, ListenLanguage, ListenSlot, Decide, Inform, Tool, End.',
            plain:
              'What this step does. Speak = the bot talks. ListenChoice = it waits and picks a branch. Tool = transfer, hangup, or HTTP api. End = the conversation stops.',
          },
          {
            name: 'prompt_ref',
            req: 'conditional',
            what: 'Any node with a prompt_ref must have text for the default locale in the prompts table. On Tool(api) this is an optional wait/filler line.',
            plain: 'Which piece of writing this step reads out. Needed on every Speak node. Supports {{slot.*}} and allowlisted {{session.*}} templates.',
          },
          {
            name: 'Tool verb',
            req: 'conditional',
            what: 'Required on Tool nodes: transfer | hangup | api. transfer/hangup are terminal; api is non-terminal and continues via tool_result.',
            plain:
              '"transfer" hands the caller to a human, "hangup" ends the call, "api" calls a profile integration then continues the graph.',
          },
          {
            name: 'api_id',
            req: 'conditional',
            what: 'Required when tool=api. Must exist on the bound profile’s api_integrations. Publish sends profile_id so the server can resolve it.',
            plain: 'Which CRM/API integration to call. Pick the bound profile first so this list fills in.',
          },
          {
            name: 'matrix_intent',
            req: 'conditional',
            what: 'Required on transfer Tools, and must resolve to a routing-matrix row that has a number. The builder falls back to an outgoing edge carrying matrix_intent.',
            plain:
              'Which row of your phone book to dial. You never type a phone number on the node itself — that is what keeps destinations under control.',
          },
          {
            name: 'binding_ref',
            req: 'conditional',
            what: 'Required on Inform nodes, and must also be listed in binding_refs.',
            plain: 'Which FAQ this answering step reads from.',
          },
          {
            name: 'ListenSlot input_type / length_rule',
            req: 'optional',
            what: 'Typed listen (string|number|phone|email|date|time|datetime) plus optional length_rule for phone/number. Legacy validator still required.',
            plain: 'Tell the bot what kind of value to expect. Confirm is suggested on for number/phone/email.',
          },
          {
            name: 'repair max_retries / unclear_prompt_ref',
            req: 'optional',
            what: 'How many times this node re-asks before the repair ladder exhausts, and what it says while doing so.',
            plain:
              'What happens when the caller says something the bot cannot make sense of. Two retries then a polite exit is a good default. Without this the bot has no plan for confusion.',
          },
        ],
      },
      {
        title: 'Edge fields',
        fields: [
          {
            name: 'Edge id / From / To',
            req: 'required',
            what: 'Ids must be unique; both endpoints must be existing nodes.',
            plain: 'The line between two steps, and which way it points.',
          },
          {
            name: 'tool_result + option',
            req: 'conditional',
            what: 'Required for Tool(api): three edges with option success|fail|error. Consumed by the runtime after HTTP settles.',
            plain: 'Where the graph goes after an API call succeeds, fails business rules, or errors.',
          },
          {
            name: 'Kind',
            req: 'required',
            what: 'One of nine closed kinds. In practice: next (unconditional), intent (if the caller means X), repair (they were unclear).',
            plain:
              '"next" always happens. "intent" happens if the caller means that thing. "repair" catches confusion.',
          },
          {
            name: 'intent',
            req: 'conditional',
            what: 'The label the classifier matches against on an intent edge. Several edges may carry synonyms and land on the same node.',
            plain:
              'The meaning that triggers this path — "sales", "support". Add one edge per wording your callers use; they can all point to the same next step.',
          },
        ],
      },
      {
        title: 'Routing matrix',
        note: 'Fill this BEFORE adding any transfer Tool, or the Tool will not validate.',
        fields: [
          {
            name: 'intent',
            req: 'required',
            what: 'Unique per row. Transfer Tools resolve their destination through this key.',
            plain: 'The name a transfer step will look up, like "sales".',
          },
          {
            name: 'owner / target',
            req: 'required',
            what: 'Both must be non-empty.',
            plain: 'Who owns this queue and its internal name. Labels for humans and reporting.',
          },
          {
            name: 'number',
            req: 'required',
            what: 'Required for a transfer row; the Tool fails validation without it.',
            plain: 'The actual extension the call is sent to, like 5005.',
          },
          {
            name: 'action',
            req: 'required',
            what: 'Must be exactly "transfer" in V1. Anything else fails publish.',
            plain: 'Only transfers are supported for now.',
          },
          {
            name: 'disposition_code',
            req: 'optional',
            what: 'Must be one of the server’s allowlisted codes when set.',
            plain:
              'How this call gets labelled in reporting afterwards, such as "transferred_sales".',
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ 5 */
  {
    step: 5,
    page: 'Answer pins',
    to: '/CC/admin/pins',
    intro:
      'The switch that makes a call answerable. Without a pin, every live or chat session is refused with 422 flow_pin_required.',
    groups: [
      {
        title: 'Pin',
        fields: [
          {
            name: 'Profile',
            req: 'required',
            what: 'Must be an existing profile — the pins endpoint validates it and returns 422 otherwise.',
            plain: 'Which bot identity answers.',
          },
          {
            name: 'Flow',
            req: 'required',
            what: 'Must be an existing flow. A flow with no published version cannot answer.',
            plain: 'Which conversation it runs. It must be published, not just drafted.',
          },
          {
            name: 'Flow version',
            req: 'required',
            what: '"latest" or a decimal version number.',
            plain:
              '"latest" means republishing the flow goes live immediately with no re-pinning. Use a fixed number when you want a version frozen.',
          },
          {
            name: 'DID label / Note',
            req: 'optional',
            what: 'Labels only. DID routing itself is FreeSWITCH configuration, outside this console.',
            plain:
              'Notes for your own reference. Typing a phone number here does not route anything.',
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ 6 */
  {
    step: 6,
    page: 'Settings & fallback',
    to: '/CC/admin/settings',
    intro: 'Platform values and the audio played when the AI pipeline cannot serve a call.',
    groups: [
      {
        title: 'System settings',
        fields: [
          {
            name: 'coral.base_url',
            req: 'conditional',
            what: 'Base URL for the transfer and CRM gateways. Read once at boot in main.go.',
            plain:
              'Where the Coral phone platform lives. Needed before a transfer can actually move a call. Changing it requires restarting the orchestrator.',
          },
          {
            name: 'control.auth_token',
            req: 'optional',
            what: 'While empty, the Control API has NO authentication and unauthenticated writes succeed. Read once at boot.',
            plain:
              'A password for this console’s API. Until you set one, anyone who can reach the server can change everything. Set it before the server is reachable beyond your own machine — and restart afterwards.',
          },
          {
            name: 'answer_pins',
            req: 'required',
            what: 'Managed by the Answer pins screen. Hand-editing malformed JSON here breaks call answering.',
            plain: 'Do not touch this by hand. Use step 5.',
          },
        ],
      },
      {
        title: 'Fallback prompts',
        fields: [
          {
            name: 'Scenario',
            req: 'optional',
            what: 'Six fixed names: ai_unavailable, credits_exhausted, timeout, system_busy, internal_error, generic.',
            plain:
              'Which failure this recording covers — the engine being down, credits running out, and so on.',
          },
          {
            name: 'WAV file',
            req: 'optional',
            what: 'Uploaded as audio/wav to the fallback root. Picked up live, no restart needed.',
            plain:
              'A human recording played when the AI cannot cope, so the caller hears something sensible instead of silence.',
          },
        ],
      },
    ],
  },
]
