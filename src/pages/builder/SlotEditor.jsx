import { CheckField, SelectField, StringList, TextField } from '../../components/ui'
import { SLOT_CLASSES, SLOT_VALIDATORS } from '../../api/types.js'

export default function SlotEditor({ slot, onChange }) {
  const s = slot && typeof slot === 'object' ? slot : {}
  const patch = (p) => {
    const next = { ...s, ...p }
    if (next.validator !== 'enum') delete next.enum
    if (next.validator !== 'regex') delete next.pattern
    onChange(next)
  }
  return (
    <>
      <TextField
        label="slot.key"
        value={s.key ?? ''}
        onChange={(v) => patch({ key: v })}
        mono
        desc="Lowercase identifier. Decide rules can branch on this key."
      />
      <SelectField
        label="slot.validator"
        value={s.validator ?? ''}
        onChange={(v) => patch({ validator: v })}
        options={SLOT_VALIDATORS}
        allowEmpty={false}
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
