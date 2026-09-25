import { useId, useState } from 'react'
import BodyEditor from './BodyEditor'
import { blockId } from '../../../lib/miDocument'

const ORIGIN_LABEL = {
  ai_supported: 'AI · grounded',
  reviewer_authored: 'Reviewer',
  carry_forward_ref: 'Carried forward',
  unsupported_ai: 'No evidence',
}

function Provenance({ origin }) {
  if (!origin) return null
  return <span className={`mp-origin o-${origin}`}>{ORIGIN_LABEL[origin] || origin}</span>
}

/** "N quotes ▾" — the transcript snippets a claim was grounded on. */
function Quotes({ claim, onOpenSegment }) {
  const [open, setOpen] = useState(false)
  const n = claim.quotes.length
  if (!n) return null
  const seg = claim.spans[0]?.segment_id
  return (
    <span className="mp-quotes">
      <button type="button" className="mp-quote-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {n} quote{n > 1 ? 's' : ''} {open ? '▴' : '▾'}
      </button>
      {open && (
        <span className="mp-quote-list">
          {claim.quotes.map((q, i) => (
            <span key={i} className="mp-quote">
              “{q}”
            </span>
          ))}
          {seg && onOpenSegment && (
            <button type="button" className="mp-link" onClick={() => onOpenSegment(seg)}>
              Open in Transcript →
            </button>
          )}
        </span>
      )}
    </span>
  )
}

/** Group consecutive bullets into lists; other lines are paragraphs. */
function Blocks({ blocks }) {
  const out = []
  let list = null
  blocks.forEach((b, i) => {
    if (b.bullet) {
      if (!list) {
        list = []
        out.push(<ul key={`l${i}`}>{list}</ul>)
      }
      list.push(<li key={i}>{b.text}</li>)
    } else {
      list = null
      out.push(<p key={i}>{b.text}</p>)
    }
  })
  return out
}

function RowTools({ kind, i, count, editor, label }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <span className="mp-row-tools">
      <button type="button" aria-label={`Move ${label} up`} disabled={i === 0} onClick={() => editor.moveClaim(kind, i, -1)}>
        ↑
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={i === count - 1}
        onClick={() => editor.moveClaim(kind, i, 1)}
      >
        ↓
      </button>
      {confirming ? (
        <>
          <button type="button" className="danger" onClick={() => editor.removeClaim(kind, i)}>
            Delete
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            Keep
          </button>
        </>
      ) : (
        <button type="button" aria-label={`Delete ${label}`} onClick={() => setConfirming(true)}>
          ✕
        </button>
      )}
    </span>
  )
}

function Flag({ claim }) {
  if (claim.flag) return <span className="mp-flag">{claim.flag} — edit or delete before approval</span>
  if (claim.edited) return <span className="mp-edited">Edited · saved as reviewer-authored</span>
  return null
}

function OwnerInput({ id, action, attendees, onChange }) {
  const listId = useId()
  const value = action.ownerDisplayName || action.ownerUserId || ''
  return (
    <>
      <input
        id={id}
        className="mp-cell-input"
        aria-label="Owner"
        placeholder="Owner"
        list={listId}
        value={value}
        onChange={(e) => {
          const v = e.target.value
          const hit = attendees.find((a) => a.name === v || a.userId === v)
          onChange(
            hit
              ? { owner_user_id: hit.userId, owner_display_name: hit.name }
              : { owner_user_id: '', owner_display_name: v },
          )
        }}
      />
      <datalist id={listId}>
        {attendees.map((a) => (
          <option key={a.userId || a.name} value={a.name}>
            {a.userId}
          </option>
        ))}
      </datalist>
    </>
  )
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function DueInput({ id, due, onChange }) {
  // Non-ISO dues from the extractor ("next Friday") stay editable as text.
  const asDate = !due || ISO_DATE.test(due)
  return (
    <input
      id={id}
      className="mp-cell-input"
      aria-label="Due date"
      type={asDate ? 'date' : 'text'}
      value={due}
      onChange={(e) => onChange({ due_date: e.target.value })}
    />
  )
}

/**
 * The minutes as a paper page, laid out like the PDF (doc 16 §5).
 * mode="preview" renders; mode="edit" makes each block editable in place via
 * `editor` (see lib/useDraftWorkspace.js). Section ids are never created or renamed.
 */
export default function MinutesDocument({ doc, mode = 'preview', editor, onOpenSegment }) {
  const edit = mode === 'edit' && editor
  const uid = useId()
  return (
    <article className={`minutes-paper ${edit ? 'editing' : ''}`} data-kind={doc.kind}>
      {doc.watermark && (
        <div className="mp-watermark" aria-hidden="true">
          <span>{doc.watermark}</span>
        </div>
      )}
      <header className="mp-head" id={blockId('details')}>
        <h1>{doc.title}</h1>
        <p className={`mp-status ${doc.watermark ? 'draft' : ''}`}>Minutes of Meeting · {doc.statusLine}</p>
      </header>
      <dl className="mp-meta">
        {doc.meta.map((m) => (
          <div key={m.label}>
            <dt>{m.label}</dt>
            <dd>{m.value}</dd>
          </div>
        ))}
      </dl>

      {doc.sections.map((s, i) => (
        <section key={s.id || i} id={blockId(`sec-${s.id || i}`)} className="mp-section">
          {edit ? (
            <>
              <input
                className="mp-title-input"
                aria-label={`Section ${s.id || i + 1} title`}
                value={s.title}
                onChange={(e) => editor.setSection(i, 'title', e.target.value)}
              />
              <BodyEditor
                id={`${uid}-body-${i}`}
                label={`${s.title || s.id} text`}
                value={s.body}
                onChange={(v) => editor.setSection(i, 'body', v)}
              />
            </>
          ) : (
            <>
              <h2>{s.title}</h2>
              {s.blocks.length ? <Blocks blocks={s.blocks} /> : <p className="mp-none">None recorded.</p>}
            </>
          )}
        </section>
      ))}
      {!doc.sections.length && !edit && <p className="mp-none">This draft has no MoM sections.</p>}

      <section id={blockId('decisions')} className="mp-section">
        <h2>Decisions</h2>
        {!doc.decisions.length && <p className="mp-none">None recorded.</p>}
        <ol className="mp-claims">
          {doc.decisions.map((c, i) => (
            <li key={c.id || `new-${i}`} className={c.flag ? 'flagged' : ''}>
              {edit ? (
                <span className="mp-claim-edit">
                  <textarea
                    className="mp-claim-input"
                    aria-label={`Decision ${i + 1}`}
                    rows={Math.max(1, Math.ceil(c.text.length / 70))}
                    value={c.text}
                    onChange={(e) => editor.setClaim('decisions', i, { text: e.target.value })}
                  />
                  <RowTools kind="decisions" i={i} count={doc.decisions.length} editor={editor} label={`decision ${i + 1}`} />
                </span>
              ) : (
                <span>{c.text}</span>
              )}
              <span className="mp-claim-meta">
                <Provenance origin={c.origin} />
                <Quotes claim={c} onOpenSegment={onOpenSegment} />
              </span>
              <Flag claim={c} />
            </li>
          ))}
        </ol>
        {edit && (
          <button type="button" className="mp-add" onClick={() => editor.addClaim('decisions')}>
            + Add decision
          </button>
        )}
      </section>

      <section id={blockId('actions')} className="mp-section">
        <h2>Action items</h2>
        {!doc.actions.length ? (
          <p className="mp-none">None recorded.</p>
        ) : (
          <div className="mp-table-wrap">
            <table className="mp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Action</th>
                  <th>Owner</th>
                  <th>Due</th>
                  {edit && <th aria-label="Row tools" />}
                </tr>
              </thead>
              <tbody>
                {doc.actions.map((a, i) => (
                  <tr key={a.id || `new-${i}`} className={a.flag ? 'flagged' : ''}>
                    <td>{i + 1}</td>
                    <td>
                      {edit ? (
                        <textarea
                          className="mp-claim-input"
                          aria-label={`Action ${i + 1}`}
                          rows={Math.max(1, Math.ceil(a.text.length / 48))}
                          value={a.text}
                          onChange={(e) => editor.setClaim('actions', i, { text: e.target.value })}
                        />
                      ) : (
                        a.text
                      )}
                      <span className="mp-claim-meta">
                        <Provenance origin={a.origin} />
                        <Quotes claim={a} onOpenSegment={onOpenSegment} />
                      </span>
                      <Flag claim={a} />
                    </td>
                    <td>
                      {edit ? (
                        <OwnerInput
                          id={`${uid}-owner-${i}`}
                          action={a}
                          attendees={editor.attendees}
                          onChange={(p) => editor.setClaim('actions', i, p)}
                        />
                      ) : (
                        a.owner
                      )}
                    </td>
                    <td>
                      {edit ? (
                        <DueInput id={`${uid}-due-${i}`} due={a.due} onChange={(p) => editor.setClaim('actions', i, p)} />
                      ) : (
                        a.due || '—'
                      )}
                    </td>
                    {edit && (
                      <td>
                        <RowTools kind="actions" i={i} count={doc.actions.length} editor={editor} label={`action ${i + 1}`} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {edit && (
          <button type="button" className="mp-add" onClick={() => editor.addClaim('actions')}>
            + Add action
          </button>
        )}
      </section>

      <footer className="mp-foot">
        {doc.versionLabel} · meeting {doc.meetingId}
      </footer>
    </article>
  )
}
