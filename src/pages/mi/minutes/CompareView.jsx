import { useEffect, useMemo, useState } from 'react'
import { mi } from '../../../api/mi/client'
import { compareContent } from '../../../lib/miCompare'
import { miErrorSentence } from '../../../lib/miErrors'
import { SOURCE_LABEL } from './historyLabels'

const STATUS_LABEL = { added: 'Added', removed: 'Removed', changed: 'Changed', unchanged: 'Unchanged' }

function Diff({ parts }) {
  return (
    <span className="diff">
      {parts.map((p, i) =>
        p.type === 'add' ? (
          <ins key={i}>{p.text}</ins>
        ) : p.type === 'del' ? (
          <del key={i}>{p.text}</del>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  )
}

function Block({ block, children }) {
  return (
    <div className={`cmp-block st-${block.status}`}>
      <span className={`cmp-status st-${block.status}`}>{STATUS_LABEL[block.status]}</span>
      {children}
    </div>
  )
}

/**
 * Compare two versions (wave 7.5): current draft, any draft revision, or any
 * Official. Block diff by section id / claim id; word-level marks inside.
 */
export default function CompareView({ meetingId, ws }) {
  const [options, setOptions] = useState(null)
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('current')
  const [contents, setContents] = useState({})
  const [err, setErr] = useState(null)
  const [showUnchanged, setShowUnchanged] = useState(false)

  useEffect(() => {
    let live = true
    Promise.all([
      mi.listDraftRevisions(meetingId).catch(() => ({ revisions: [] })),
      mi.getOfficialHistory(meetingId).catch(() => ({ officials: [] })),
    ])
      .then(([r, o]) => {
        if (!live) return
        const opts = [{ key: 'current', label: `Current draft (v${ws.draft?.version})` }]
        for (const off of (o.officials ?? []).slice().sort((a, b) => b.official_version - a.official_version)) {
          opts.push({ key: `off:${off.official_version}`, label: `Official v${off.official_version}`, content: off })
        }
        for (const rev of r.revisions ?? []) {
          opts.push({
            key: `rev:${rev.id}`,
            label: `Draft v${rev.version} · ${SOURCE_LABEL[rev.source] || rev.source} · ${new Date(rev.created_at).toLocaleString()}`,
          })
        }
        setOptions(opts)
        // Default: latest Official vs current draft, else previous revision vs current.
        const firstOther = opts.find((x) => x.key.startsWith('off:')) || opts.filter((x) => x.key.startsWith('rev:'))[1]
        setLeft(firstOther?.key || 'current')
      })
      .catch((e) => live && setErr(miErrorSentence(e.code, e.message)))
    return () => {
      live = false
    }
  }, [meetingId, ws.draft?.version])

  // Revisions are fetched on demand; Officials already came with the history list.
  useEffect(() => {
    for (const key of [left, right]) {
      if (!key.startsWith('rev:') || contents[key]) continue
      mi.getDraftRevision(meetingId, key.slice(4))
        .then((r) => setContents((c) => ({ ...c, [key]: r })))
        .catch((e) => setErr(miErrorSentence(e.code, e.message)))
    }
  }, [left, right, contents, meetingId])

  const resolve = (key) => {
    if (key === 'current') return ws.working && { ...ws.working }
    if (key.startsWith('off:')) return options?.find((o) => o.key === key)?.content
    return contents[key]
  }
  const a = resolve(left)
  const b = resolve(right)
  const result = useMemo(() => (a && b ? compareContent(a, b) : null), [a, b])

  if (err) return <div className="probe err">{err}</div>
  if (!options) return <p className="desc">Loading versions…</p>

  const visible = (list) => (showUnchanged ? list : list.filter((x) => x.status !== 'unchanged'))
  const pick = (id, value, set) => (
    <select id={id} value={value} onChange={(e) => set(e.target.value)}>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  )

  return (
    <div className="compare-view">
      <div className="minutes-toolbar">
        <label className="desc" htmlFor="cmp-left">
          From
        </label>
        {pick('cmp-left', left, setLeft)}
        <label className="desc" htmlFor="cmp-right">
          To
        </label>
        {pick('cmp-right', right, setRight)}
        <label className="desc">
          <input type="checkbox" checked={showUnchanged} onChange={(e) => setShowUnchanged(e.target.checked)} /> Show
          unchanged
        </label>
      </div>
      {!result && <p className="desc">Loading…</p>}
      {result && (
        <div className="minutes-paper compare-paper">
          <p className="mp-status">
            {result.changes === 0 ? 'No differences.' : `${result.changes} change${result.changes > 1 ? 's' : ''}.`}
            {result.positional ? ' Some items have no id and were matched by position.' : ''}
          </p>
          {visible(result.sections).map((s) => (
            <Block key={s.key} block={s}>
              <h2>
                <Diff parts={s.title} />
              </h2>
              <p className="cmp-body">
                <Diff parts={s.body} />
              </p>
            </Block>
          ))}
          <section className="mp-section">
            <h2>Decisions</h2>
            {visible(result.decisions).map((d) => (
              <Block key={d.key} block={d}>
                <Diff parts={d.text} />
              </Block>
            ))}
          </section>
          <section className="mp-section">
            <h2>Action items</h2>
            {visible(result.actions).map((x) => (
              <Block key={x.key} block={x}>
                <Diff parts={x.text} />
                {x.fields.map((f) => (
                  <span key={f.name} className="cmp-field">
                    {f.name === 'due' ? 'Due' : 'Owner'}: <del>{f.before || '—'}</del> → <ins>{f.after || '—'}</ins>
                  </span>
                ))}
              </Block>
            ))}
          </section>
        </div>
      )}
    </div>
  )
}
