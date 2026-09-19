import {
  CheckField,
  NumberField,
  SelectField,
  StringList,
  Section,
  TextField,
} from '../../components/ui'
import {
  INTENT_ACTIONS,
  INTENT_SCOPES,
  PROFILE_INTERRUPT_MODES,
} from '../../api/types.js'

function emptyIntent() {
  return {
    id: '',
    scope: 'hub',
    action: 'navigate',
    department: '',
    product: '',
    examples: [],
    description: '',
  }
}

export default function Industrial({ doc, patch, patchIn, catalog }) {
  const policy = doc.conversation_policy ?? {}
  const ir = policy.interruption ?? {}
  const listen = policy.listen ?? {}
  const ue = listen.utterance_endpointing ?? {}
  const fail = policy.failure ?? {}
  const rec = policy.recording ?? {}
  const ch = policy.channel ?? {}
  const md = policy.mandatory_delivery ?? {}
  const clocks = catalog?.clocks ?? ['live', 'chat']
  const showWelcomeGrace = ir.mode === 'after_ms' || ir.welcome_mode === 'after_ms'
  const hasFlatEndSilence = Object.prototype.hasOwnProperty.call(listen, 'end_silence_ms')

  const patchPolicy = (section, p) => {
    patch({
      conversation_policy: {
        ...policy,
        [section]: {
          ...(policy[section] ?? {}),
          ...p,
        },
      },
    })
  }
  const patchUe = (p) => {
    patchPolicy('listen', {
      utterance_endpointing: {
        ...ue,
        ...p,
      },
    })
  }
  const patchTts = (p) => {
    patchIn('persona', {
      tts: {
        ...(doc.persona?.tts ?? {}),
        ...p,
      },
    })
  }
  const catalogRows = doc.intent_catalog ?? []
  const setCatalog = (next) => patch({ intent_catalog: next })
  const setRow = (i, p) =>
    setCatalog(catalogRows.map((row, n) => (n === i ? { ...row, ...p } : row)))

  return (
    <>
      <Section title="Product" open>
        <SelectField
          label="Product"
          value={doc.product ?? ''}
          onChange={(v) => patch({ product: v })}
          options={['call_center']}
          allowEmpty
          desc="Call Center profiles must be call_center. Empty is the old legacy shape."
        />
      </Section>

      <Section title="What the bot may understand" open>
        <p className="hint">
          Intent catalog — ids must match listen edges on the flow. Scope and action are closed lists.
        </p>
        <table className="plain">
          <thead>
            <tr>
              <th>id</th>
              <th>scope</th>
              <th>action</th>
              <th>department</th>
              <th>product</th>
            </tr>
          </thead>
          <tbody>
            {catalogRows.map((row, i) => (
              <tr key={i}>
                <td>
                  <input
                    value={row.id ?? ''}
                    onChange={(e) => setRow(i, { id: e.target.value })}
                    className="mono"
                  />
                </td>
                <td>
                  <select value={row.scope ?? ''} onChange={(e) => setRow(i, { scope: e.target.value })}>
                    {INTENT_SCOPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={row.action ?? ''}
                    onChange={(e) => setRow(i, { action: e.target.value })}
                  >
                    {INTENT_ACTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={row.department ?? ''}
                    onChange={(e) => setRow(i, { department: e.target.value })}
                    placeholder="sales"
                  />
                </td>
                <td>
                  <input
                    value={row.product ?? ''}
                    onChange={(e) => setRow(i, { product: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {catalogRows.map((row, i) => (
          <details className="section" key={`ex-${i}`}>
            <summary>
              {row.id || `intent ${i + 1}`} examples
              <button
                type="button"
                className="btn danger sm"
                style={{ marginLeft: 8 }}
                onClick={() => setCatalog(catalogRows.filter((_, n) => n !== i))}
              >
                Remove
              </button>
            </summary>
            <div className="body">
              <TextField
                label="Description"
                value={row.description ?? ''}
                onChange={(v) => setRow(i, { description: v })}
              />
              <StringList
                label="Examples"
                values={row.examples ?? []}
                onChange={(v) => setRow(i, { examples: v })}
                placeholder="I want to buy"
              />
            </div>
          </details>
        ))}
        <button className="btn secondary sm" onClick={() => setCatalog([...catalogRows, emptyIntent()])}>
          Add intent
        </button>
      </Section>

      <Section title="When the caller may interrupt" open={!!policy.interruption || !!policy.listen}>
        <div className="row">
          <SelectField
            label="Interrupt mode"
            value={ir.mode ?? ''}
            onChange={(v) => patchPolicy('interruption', { mode: v })}
            options={PROFILE_INTERRUPT_MODES}
            allowEmpty
          />
          <SelectField
            label="Welcome barge"
            value={ir.welcome_mode ?? ''}
            onChange={(v) => patchPolicy('interruption', { welcome_mode: v })}
            options={PROFILE_INTERRUPT_MODES}
            allowEmpty
          />
          {showWelcomeGrace && (
            <NumberField
              label="Welcome grace (ms)"
              value={ir.welcome_grace_ms ?? ''}
              onChange={(v) => patchPolicy('interruption', { welcome_grace_ms: v })}
            />
          )}
        </div>
        <div className="row">
          <NumberField
            label="Min barge chars"
            value={ir.min_barge_chars ?? ''}
            onChange={(v) => patchPolicy('interruption', { min_barge_chars: v })}
          />
          <NumberField
            label="Min barge ms"
            value={ir.min_barge_ms ?? ''}
            onChange={(v) => patchPolicy('interruption', { min_barge_ms: v })}
          />
          <NumberField
            label="Partial confidence"
            value={ir.partial_confidence ?? ''}
            onChange={(v) =>
              patchPolicy('interruption', { partial_confidence: v })
            }
          />
          <NumberField
            label="Cooldown ms"
            value={ir.cooldown_ms ?? ''}
            onChange={(v) => patchPolicy('interruption', { cooldown_ms: v })}
          />
        </div>
        <div className="row">
          <NumberField
            label="No-input timeout ms"
            value={listen.no_input_timeout_ms ?? ''}
            onChange={(v) =>
              patchPolicy('listen', { no_input_timeout_ms: v })
            }
          />
          <NumberField
            label="Retry budget"
            value={listen.retry_budget ?? ''}
            onChange={(v) => patchPolicy('listen', { retry_budget: v })}
          />
          <CheckField
            label="Feed STT during speak (debug / soak only)"
            checked={!!listen.feed_during_speak}
            onChange={(v) => patchPolicy('listen', { feed_during_speak: v })}
          />
        </div>
        {hasFlatEndSilence && (
          <NumberField
            label="Listen end-silence ms (legacy flat field on this draft)"
            value={listen.end_silence_ms ?? ''}
            onChange={(v) => patchPolicy('listen', { end_silence_ms: v })}
          />
        )}
        <StringList
          label="Incomplete prefixes"
          values={listen.incomplete_prefixes ?? []}
          onChange={(v) => patchPolicy('listen', { incomplete_prefixes: v })}
          placeholder="i want"
        />
        <div className="row">
          <CheckField
            label="Utterance endpointing"
            checked={!!ue.enabled}
            onChange={(v) => patchUe({ enabled: v })}
          />
          <NumberField
            label="End silence ms"
            value={ue.end_silence_ms ?? ''}
            onChange={(v) => patchUe({ end_silence_ms: v })}
          />
          <NumberField
            label="Min speech ms"
            value={ue.min_speech_ms ?? ''}
            onChange={(v) => patchUe({ min_speech_ms: v })}
          />
          <NumberField
            label="Max hold ms"
            value={ue.max_hold_ms ?? ''}
            onChange={(v) => patchUe({ max_hold_ms: v })}
          />
          <NumberField
            label="Barge silence ms"
            value={ue.barge_silence_ms ?? ''}
            onChange={(v) => patchUe({ barge_silence_ms: v })}
          />
        </div>
      </Section>

      <Section title="Failure, recording, channel">
        <div className="row">
          <NumberField
            label="Safe retry max (0–3)"
            value={fail.safe_retry_max ?? ''}
            onChange={(v) => patchPolicy('failure', { safe_retry_max: v })}
          />
          <StringList
            label="Fallback scenario names"
            values={fail.fallback_scenario_names ?? []}
            onChange={(v) => patchPolicy('failure', { fallback_scenario_names: v })}
          />
        </div>
        <div className="row">
          <CheckField
            label="Recording enabled"
            checked={!!rec.enabled}
            onChange={(v) => patchPolicy('recording', { enabled: v })}
          />
          <TextField
            label="Consent prompt ref"
            value={rec.consent_prompt_ref ?? ''}
            onChange={(v) => patchPolicy('recording', { consent_prompt_ref: v })}
          />
          <TextField
            label="Retention class"
            value={rec.retention_class ?? ''}
            onChange={(v) => patchPolicy('recording', { retention_class: v })}
          />
        </div>
        <div className="row">
          <StringList
            label="Allowed clocks"
            values={ch.allowed_clocks ?? []}
            onChange={(v) => patchPolicy('channel', { allowed_clocks: v })}
            placeholder={clocks[0]}
            desc={`Catalog clocks: ${clocks.join(', ')}`}
          />
          <StringList
            label="Allowed capabilities"
            values={ch.allowed_capabilities ?? []}
            onChange={(v) => patchPolicy('channel', { allowed_capabilities: v })}
          />
          <CheckField
            label="Mandatory delivery"
            checked={!!md.enabled}
            onChange={(v) => patchPolicy('mandatory_delivery', { enabled: v })}
          />
        </div>
      </Section>

      <Section title="How loud we listen and speak" open>
        <div className="row">
          <CheckField
            label="Inbound normalize"
            checked={!!doc.audio?.inbound_normalize}
            onChange={(v) => patchIn('audio', { inbound_normalize: v })}
          />
          <NumberField
            label="Inbound target RMS (0–0.5]"
            value={doc.audio?.inbound_target_rms ?? ''}
            onChange={(v) =>
              patchIn('audio', { inbound_target_rms: v })
            }
          />
          <NumberField
            label="Inbound max gain [1–16]"
            value={doc.audio?.inbound_max_gain ?? ''}
            onChange={(v) => patchIn('audio', { inbound_max_gain: v })}
          />
          <NumberField
            label="Inbound noise floor [0–0.1]"
            value={doc.audio?.inbound_noise_floor_rms ?? ''}
            onChange={(v) =>
              patchIn('audio', { inbound_noise_floor_rms: v })
            }
          />
        </div>
        <div className="row">
          <CheckField
            label="TTS limiter"
            checked={!!doc.audio?.tts_limiter}
            onChange={(v) => patchIn('audio', { tts_limiter: v })}
          />
          <NumberField
            label="TTS peak limit (0–1]"
            value={doc.audio?.tts_peak_limit ?? ''}
            onChange={(v) => patchIn('audio', { tts_peak_limit: v })}
          />
        </div>
      </Section>

      <Section title="Persona TTS" open={!!doc.persona?.tts}>
        <div className="row">
          <NumberField
            label="Pace (must be > 0)"
            value={doc.persona?.tts?.pace ?? ''}
            onChange={(v) => patchTts({ pace: v })}
          />
          <NumberField
            label="Temperature"
            value={doc.persona?.tts?.temperature ?? ''}
            onChange={(v) => patchTts({ temperature: v })}
          />
        </div>
      </Section>
    </>
  )
}
