import { CheckField, NumberField, SelectField, StringList, TextField } from '../../components/ui'
import {
  LENGTH_RULE_OPS,
  LISTEN_INPUT_TYPES,
  SLOT_CLASSES,
  SLOT_VALIDATORS,
} from '../../api/types.js'

export default function SlotEditor({ slot, onChange, catalog }) {
  const s = slot && typeof slot === 'object' ? slot : {}
  const inputTypes = catalog?.listen_input_types?.length
    ? catalog.listen_input_types
    : LISTEN_INPUT_TYPES
  const patch = (p) => {
    const next = { ...s, ...p }
    if (next.validator !== 'enum') delete next.enum
    if (next.validator !== 'regex') delete next.pattern
    const it = next.input_type ?? ''
    if (it !== 'phone' && it !== 'number') delete next.length_rule
    onChange(next)
  }
  const setInputType = (v) => {
    const p = {
      input_type: v || undefined,
    }
    if (['number', 'phone', 'email'].includes(v) && s.confirm == null) p.confirm = true
    if (v !== 'phone' && v !== 'number') p.length_rule = undefined
    patch(p)
  }
  const lr = s.length_rule && typeof s.length_rule === 'object' ? s.length_rule : {}
  const showLength = (s.input_type ?? '') === 'phone' || (s.input_type ?? '') === 'number'
  const dateLike = ['date', 'time', 'datetime'].includes(s.input_type ?? '')

  return (
    <>
      <TextField
        label="slot.key"
        value={s.key ?? ''}
        onChange={(v) => patch({ key: v })}
        mono
        desc="Lowercase identifier. Decide rules can branch on this key. Speak may use {{slot.<key>}}."
      />
      <SelectField
        label="slot.input_type"
        value={s.input_type ?? ''}
        onChange={setInputType}
        options={inputTypes}
        emptyLabel="— string (legacy) —"
        desc="Typed listen (doc 23). date/time/datetime need profile timezone."
      />
      {dateLike && (
        <p className="desc">
          Publish requires a non-empty profile timezone when this input_type is used.
        </p>
      )}
      <SelectField
        label="slot.validator"
        value={s.validator ?? ''}
        onChange={(v) => patch({ validator: v })}
        options={SLOT_VALIDATORS}
        allowEmpty={false}
        desc="Legacy validator still required alongside input_type."
      />
      {s.validator === 'enum' && (
        <StringList
          label="slot.enum"
          values={s.enum ?? []}
          onChange={(v) => patch({ enum: v })}
          placeholder="sales"
        />
      )}
      {s.validator === 'regex' && (
        <TextField
          label="slot.pattern"
          value={s.pattern ?? ''}
          onChange={(v) => patch({ pattern: v })}
          mono
          desc="JavaScript / RE2-compatible pattern, max 256 characters."
        />
      )}
      {showLength && (
        <div className="row tight">
          <SelectField
            label="length_rule.op"
            value={lr.op ?? ''}
            onChange={(v) =>
              patch({
                length_rule: v
                  ? {
                      ...lr,
                      op: v,
                    }
                  : undefined,
              })
            }
            options={LENGTH_RULE_OPS}
            emptyLabel="— none —"
          />
          {(lr.op === 'eq' || lr.op === 'min' || lr.op === 'max') && (
            <NumberField
              label="length_rule.n"
              value={lr.n ?? ''}
              onChange={(v) =>
                patch({
                  length_rule: {
                    ...lr,
                    n: v,
                  },
                })
              }
            />
          )}
          {lr.op === 'between' && (
            <>
              <NumberField
                label="min"
                value={lr.min ?? ''}
                onChange={(v) =>
                  patch({
                    length_rule: {
                      ...lr,
                      min: v,
                    },
                  })
                }
              />
              <NumberField
                label="max"
                value={lr.max ?? ''}
                onChange={(v) =>
                  patch({
                    length_rule: {
                      ...lr,
                      max: v,
                    },
                  })
                }
              />
            </>
          )}
        </div>
      )}
      <CheckField
        label="Confirm the value before using it"
        checked={!!s.confirm}
        onChange={(v) => patch({ confirm: v || undefined })}
      />
      <CheckField
        label="Redact in evidence"
        checked={!!s.redact}
        onChange={(v) => patch({ redact: v || undefined })}
      />
      <SelectField
        label="slot.class"
        value={s.class ?? ''}
        onChange={(v) => patch({ class: v || undefined })}
        options={SLOT_CLASSES}
        emptyLabel="— none —"
        desc="confidential values are masked even if redact is off."
      />
    </>
  )
}
