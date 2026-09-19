import { SelectField, StringList, TextField } from '../../components/ui'
import { WELL_KNOWN_SLOTS } from '../../api/types.js'

function whenOp(w) {
  if (w?.eq != null) return 'eq'
  if (Array.isArray(w?.in)) return 'in'
  if (typeof w?.exists === 'boolean') return 'exists'
  return 'eq'
}

function whenForOp(w, op) {
  const slot = w?.slot ?? ''
  if (op === 'in') return { slot, in: w?.in ?? [] }
  if (op === 'exists') return { slot, exists: typeof w?.exists === 'boolean' ? w.exists : true }
  return { slot, eq: w?.eq ?? '' }
}

export default function DecideEditor({ node, doc, onChange }) {
  const spec = node.decide && typeof node.decide === 'object' ? node.decide : { rules: [], else_edge_id: '' }
  const rules = spec.rules ?? []
  const out = doc.edges.filter((e) => e.from === node.id)
  const edgeIds = out.map((e) => e.id)
  const declared = doc.nodes
    .filter((n) => n.type === 'ListenSlot' && n.slot?.key)
    .map((n) => n.slot.key)
  const slots = [...new Set([...WELL_KNOWN_SLOTS, ...declared])]

  const setSpec = (p) => onChange({ ...spec, ...p })
  const setRule = (i, p) =>
    setSpec({
      rules: rules.map((r, n) => (n === i ? { ...r, ...p } : r)),
    })
  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= rules.length) return
    const next = rules.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    setSpec({ rules: next })
  }

  return (
    <>
      <p className="desc" style={{ marginTop: 0 }}>
        Draw outgoing edges first, then name them in the rules. The first matching rule wins;
        otherwise the else path fires.
      </p>
      {!edgeIds.length && (
        <p className="desc">This Decide has no outgoing edges yet — add them on the canvas.</p>
      )}
      {rules.map((r, i) => {
        const op = whenOp(r.when)
        return (
          <div className="card sub" key={i}>
            <SelectField
              label={`Rule ${i + 1} slot`}
              value={r.when?.slot ?? ''}
              onChange={(v) => setRule(i, { when: { ...r.when, slot: v } })}
              options={slots}
              desc="ListenSlot keys plus well-known slots."
            />
            <SelectField
              label="When"
              value={op}
              onChange={(v) => setRule(i, { when: whenForOp(r.when, v) })}
              options={['eq', 'in', 'exists']}
              allowEmpty={false}
            />
            {op === 'eq' && (
              <TextField
                label="equals"
                value={r.when?.eq ?? ''}
                onChange={(v) => setRule(i, { when: { slot: r.when?.slot ?? '', eq: v } })}
                mono
              />
            )}
            {op === 'in' && (
              <StringList
                label="in"
                values={r.when?.in ?? []}
                onChange={(v) => setRule(i, { when: { slot: r.when?.slot ?? '', in: v } })}
              />
            )}
            {op === 'exists' && (
              <SelectField
                label="exists"
                value={String(r.when?.exists ?? true)}
                onChange={(v) =>
                  setRule(i, { when: { slot: r.when?.slot ?? '', exists: v === 'true' } })
                }
                options={['true', 'false']}
                allowEmpty={false}
              />
            )}
            <SelectField
              label="Outgoing edge"
              value={r.edge_id ?? ''}
              onChange={(v) => setRule(i, { edge_id: v })}
              options={edgeIds}
              desc="Must already leave this node."
            />
            <div className="actions tight">
              <button type="button" className="btn ghost sm" onClick={() => move(i, -1)} disabled={i === 0}>
                Up
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => move(i, 1)}
                disabled={i === rules.length - 1}
              >
                Down
              </button>
              <button
                type="button"
                className="btn danger sm"
                onClick={() => setSpec({ rules: rules.filter((_, n) => n !== i) })}
              >
                Remove rule
              </button>
            </div>
          </div>
        )
      })}
      <div className="actions tight">
        <button
          type="button"
          className="btn secondary sm"
          onClick={() =>
            setSpec({
              rules: [
                ...rules,
                { when: { slot: slots[0] ?? 'department', eq: '' }, edge_id: edgeIds[0] ?? '' },
              ],
            })
          }
        >
          Add rule
        </button>
      </div>
      <SelectField
        label="else_edge_id"
        value={spec.else_edge_id ?? ''}
        onChange={(v) => setSpec({ else_edge_id: v })}
        options={edgeIds}
        allowEmpty={false}
        desc="Taken when no rule matches."
      />
    </>
  )
}
