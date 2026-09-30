import { Card } from '../../components/ui'

/**
 * rules.kb and rules.normalize — the switches that decide how much of the
 * profile directory reaches minutes drafting.
 *
 * These were previously reachable only by hand-editing the Advanced rules JSON,
 * which is a poor place for the settings that turn grounding on and off.
 *
 * The two groups do not behave the same way once a meeting exists, and the card
 * says so: rules.kb is read live on every run, while rules.normalize is read
 * from the snapshot each meeting froze when it was created.
 */
export default function GroundingFlags({ kb, normalize, onChange }) {
  const setKb = (patch) => onChange({ kb: { ...kb, ...patch }, normalize })
  const setNorm = (patch) => onChange({ kb, normalize: { ...normalize, ...patch } })

  // Laid out here rather than with .row, which is a form-row grid and pushes the
  // label away from its own checkbox.
  const check = (checked, onToggle, label, desc) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onToggle(e.target.checked)}
          style={{ flex: '0 0 auto', marginTop: 4 }}
        />
        <span>{label}</span>
      </label>
      <p className="desc" style={{ margin: '3px 0 0 24px' }}>
        {desc}
      </p>
    </div>
  )

  return (
    <>
      <Card
        title="Knowledge directory"
        hint="Applies to every run, including when you regenerate a meeting that already exists."
      >
        {check(
          kb.enabled,
          (v) => setKb({ enabled: v }),
          'rules.kb.enabled — build the directory index for each meeting',
          'Off means no people, products or clients reach any stage.',
        )}
        {check(
          kb.resolve,
          (v) => setKb({ resolve: v }),
          'rules.kb.resolve — resolve transcript names against the directory',
          'Produces the resolved mentions that become the drafting cast list, and binds speakers to their directory identity.',
        )}
        {check(
          kb.extract,
          (v) => setKb({ extract: v }),
          'rules.kb.extract — draft chapter by chapter instead of in one pass',
          'Richer grounding, but it calls the model once per chapter, so a long meeting costs several times more. Leave off unless you are comparing the two.',
        )}
      </Card>

      <Card
        title="Transcript correction"
        hint="Read from the snapshot each meeting froze when it was created, so a change here reaches NEW meetings only. Regenerating an older meeting still uses the settings it was born with."
      >
        {check(
          normalize.enabled,
          (v) => setNorm({ enabled: v }),
          'rules.normalize.enabled — correct known terms in the transcript',
          'Corrections are stored separately and the raw transcript is never modified.',
        )}
        {check(
          normalize.tier2,
          (v) => setNorm({ tier2: v }),
          'rules.normalize.tier2 — propose near-miss corrections',
          'Finds mis-heard forms of registered terminology and of directory names.',
        )}
        {check(
          normalize.tier3_llm,
          (v) => setNorm({ tier3_llm: v }),
          'rules.normalize.tier3_llm — let the model confirm each proposal',
          'Required before any proposal is applied, including directory spellings such as a mis-heard product name. With this off, corrections are proposed and then always discarded.',
        )}
      </Card>
    </>
  )
}
