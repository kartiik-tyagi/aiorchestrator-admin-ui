import { CheckField, NumberField, SelectField } from '../../components/ui'
import { FLOW_INTERRUPT_MODES } from '../../api/types.js'

function compact(obj) {
  if (obj == null) return undefined
  if (typeof obj !== 'object' || Array.isArray(obj)) return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === '' || v === null) continue
    if (typeof v === 'object' && !Array.isArray(v)) {
      const c = compact(v)
      if (c) out[k] = c
    } else out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

export default function FlowPolicy({ doc, setDoc, interruptModes }) {
  const policy = doc.conversation_policy ?? {}
  const ir = policy.interruption ?? {}
  const listen = policy.listen ?? {}
  const ue = listen.utterance_endpointing ?? {}
  const fail = policy.failure ?? {}
  const modes = interruptModes?.length ? interruptModes : FLOW_INTERRUPT_MODES
  const showGrace = ir.mode === 'after_ms' || ir.welcome_mode === 'after_ms'

  const write = (next) => {
    setDoc((d) => {
      const conversation_policy = compact(next)
      if (!conversation_policy) {
        const copy = { ...d }
        delete copy.conversation_policy
        return copy
      }
      return { ...d, conversation_policy }
    })
  }
  const patchSection = (section, p) =>
    write({
      ...policy,
      [section]: {
        ...(policy[section] ?? {}),
        ...p,
      },
    })
  const patchUe = (p) =>
    patchSection('listen', {
      utterance_endpointing: {
        ...ue,
        ...p,
      },
    })

  return (
    <>
      <p className="desc" style={{ marginTop: 0 }}>
        Empty fields inherit the pinned profile. Pointers stay omitted until you set them.
        Interruption modes may be inherit.
      </p>
      <SelectField
        label="Interrupt mode"
        value={ir.mode ?? ''}
        onChange={(v) => patchSection('interruption', { mode: v || undefined })}
        options={modes}
        emptyLabel="— omit (inherit profile) —"
      />
      <SelectField
        label="Welcome barge"
        value={ir.welcome_mode ?? ''}
        onChange={(v) => patchSection('interruption', { welcome_mode: v || undefined })}
        options={modes}
        emptyLabel="— omit (inherit profile) —"
      />
      {showGrace && (
        <NumberField
          label="Welcome grace (ms)"
          value={ir.welcome_grace_ms}
          onChange={(v) => patchSection('interruption', { welcome_grace_ms: v })}
        />
      )}
      <NumberField
        label="Min barge chars"
        value={ir.min_barge_chars}
        onChange={(v) => patchSection('interruption', { min_barge_chars: v })}
      />
      <NumberField
        label="Min barge ms"
        value={ir.min_barge_ms}
        onChange={(v) => patchSection('interruption', { min_barge_ms: v })}
      />
      <NumberField
        label="Cooldown ms"
        value={ir.cooldown_ms}
        onChange={(v) => patchSection('interruption', { cooldown_ms: v })}
      />
      <NumberField
        label="No-input timeout ms"
        value={listen.no_input_timeout_ms}
        onChange={(v) => patchSection('listen', { no_input_timeout_ms: v })}
      />
      <NumberField
        label="Retry budget"
        value={listen.retry_budget}
        onChange={(v) => patchSection('listen', { retry_budget: v })}
      />
      <CheckField
        label="Feed STT during speak (debug / soak only)"
        checked={!!listen.feed_during_speak}
        onChange={(v) => patchSection('listen', { feed_during_speak: v || undefined })}
      />
      <CheckField
        label="Utterance endpointing"
        checked={!!ue.enabled}
        onChange={(v) => patchUe({ enabled: v || undefined })}
      />
      <NumberField
        label="End silence ms"
        value={ue.end_silence_ms}
        onChange={(v) => patchUe({ end_silence_ms: v })}
      />
      <NumberField
        label="Min speech ms"
        value={ue.min_speech_ms}
        onChange={(v) => patchUe({ min_speech_ms: v })}
      />
      <NumberField
        label="Max hold ms"
        value={ue.max_hold_ms}
        onChange={(v) => patchUe({ max_hold_ms: v })}
      />
      <NumberField
        label="Barge silence ms"
        value={ue.barge_silence_ms}
        onChange={(v) => patchUe({ barge_silence_ms: v })}
      />
      <NumberField
        label="Safe retry max (0–3)"
        value={fail.safe_retry_max}
        onChange={(v) => patchSection('failure', { safe_retry_max: v })}
        desc="Flow-level override. Omit to inherit the profile."
      />
    </>
  )
}
