import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { mi } from '../../api/mi/client'
import { Card, Empty, NumberField, SelectField, StringList, TextField, useToast } from '../../components/ui'
import AskPane from './AskPane'
import DeleteProfileDialog from './DeleteProfileDialog'
import DirectoryPane from './DirectoryPane'
import ExportBrandingCard from './ExportBrandingCard'
import GroundingFlags from './GroundingFlags'
import InsightsFlags from './InsightsFlags'
import MemoryInbox from './MemoryInbox'
import TerminologyPane from './TerminologyPane'
import { miErrorSentence } from '../../lib/miErrors'
import { randomUUID } from '../../lib/randomId'
import { setDirtyGuard } from '../../lib/dirtyGuard'

/**
 * Configure one Minutes desk.
 *
 * The desk has far more settings than fit on one readable page, and they are
 * not equally urgent: the name and the Minutes sections get edited, the rules
 * JSON almost never does, and the directory is a working queue of its own. So
 * they are split across tabs rather than stacked into a single scroll where the
 * Save button lives 2000px above the field being typed into.
 *
 * Save only ever writes the desk fields, the template and rules. The panes that
 * own their own endpoints — directory, inbox, terminology, branding, grounding
 * switches — write themselves the moment they are used, which is why they are
 * safe to sit behind a tab the operator may never open.
 */

const TABS = [
  { key: 'desk', label: 'Desk' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'grounding', label: 'Grounding' },
  { key: 'directory', label: 'Directory' },
  { key: 'library', label: 'Library' },
  { key: 'ask', label: 'Ask' },
  { key: 'danger', label: 'Delete', danger: true },
]

const B_AUTHORITY = [
  'prefer_b_when_gates_pass',
  'prefer_a',
  'prefer_b',
]

function parseLangs(raw) {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw)
      return Array.isArray(v) ? v : raw ? [raw] : []
    } catch {
      return raw ? [raw] : []
    }
  }
  return []
}

function asObj(raw, fallback = {}) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw)
      return v && typeof v === 'object' ? v : fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

/** Is this JSON textarea currently parseable? Drives inline validity, so an
 *  invalid blob is visible while typing instead of only on a refused save. */
function jsonError(text) {
  if (!text.trim()) return null
  try {
    JSON.parse(text)
    return null
  } catch (e) {
    return e.message
  }
}

export default function MiProfileDetail() {
  const { id = '' } = useParams()
  const toast = useToast()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'desk'
  const setTab = (next) => setParams({ tab: next }, { replace: true })

  const [doc, setDoc] = useState(null)
  const [rulesRest, setRulesRest] = useState('{}')
  const [memoryText, setMemoryText] = useState('{}')
  const [kb, setKb] = useState([])
  const [kbId, setKbId] = useState('')
  const [kbTitle, setKbTitle] = useState('')
  const [kbBody, setKbBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [insightsSummary, setInsightsSummary] = useState(false)
  const [insightsFeedback, setInsightsFeedback] = useState(false)
  const [kbFlags, setKbFlags] = useState({ enabled: false, resolve: false, extract: false })
  const [normFlags, setNormFlags] = useState({ enabled: false, tier2: false, tier3_llm: false })
  const [inboxCount, setInboxCount] = useState(null)
  const [meetingCount, setMeetingCount] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const p = await mi.getProfile(id)
      setDoc(p)
      const rules = asObj(p.rules)
      const insights = asObj(rules.insights)
      setInsightsSummary(insights.summary === true || insights.summary === 'true')
      setInsightsFeedback(insights.feedback === true || insights.feedback === 'true')
      const kbr = asObj(rules.kb)
      setKbFlags({
        enabled: kbr.enabled === true || kbr.enabled === 'true',
        resolve: kbr.resolve === true || kbr.resolve === 'true',
        extract: kbr.extract === true || kbr.extract === 'true',
      })
      const nr = asObj(rules.normalize)
      setNormFlags({
        enabled: nr.enabled === true || nr.enabled === 'true',
        tier2: nr.tier2 === true || nr.tier2 === 'true',
        tier3_llm: nr.tier3_llm === true || nr.tier3_llm === 'true',
      })
      const rest = { ...rules }
      if (rest.case_b) {
        const { min_segments: _ms, ...cb } = rest.case_b
        rest.case_b = Object.keys(cb).length ? cb : undefined
        if (!rest.case_b) delete rest.case_b
      }
      if (rest.kb) {
        const { enabled: _ke, resolve: _kr, extract: _kx, ...kbRest } = asObj(rest.kb)
        if (Object.keys(kbRest).length) rest.kb = kbRest
        else delete rest.kb
      }
      if (rest.normalize) {
        const { enabled: _ne, tier2: _n2, tier3_llm: _n3, ...normRest } = asObj(rest.normalize)
        if (Object.keys(normRest).length) rest.normalize = normRest
        else delete rest.normalize
      }
      if (rest.insights) {
        const { summary: _s, feedback: _f, ...insRest } = asObj(rest.insights)
        if (Object.keys(insRest).length) rest.insights = insRest
        else delete rest.insights
      }
      setRulesRest(JSON.stringify(rest, null, 2))
      setMemoryText(JSON.stringify(asObj(p.memory_policy), null, 2))
      const list = await mi.listKb(id)
      setKb(list.docs ?? list.kb ?? list.items ?? (Array.isArray(list) ? list : []))
      setDirty(false)
      setErr(null)
    } catch (e) {
      setErr(miErrorSentence(e.code, e.message))
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  // Tab badges. Both are read-only counts; a failure just leaves the badge off
  // rather than blocking the editor.
  const loadBadges = useCallback(() => {
    mi.listMemoryInbox(id)
      .then((res) => {
        const items = res?.items ?? res?.inbox ?? (Array.isArray(res) ? res : [])
        setInboxCount(items.filter((i) => !i.status || i.status === 'pending').length)
      })
      .catch(() => setInboxCount(null))
    mi.listMeetings(id)
      .then((d) => setMeetingCount((d.meetings ?? []).length))
      .catch(() => setMeetingCount(null))
  }, [id])

  useEffect(() => {
    loadBadges()
  }, [loadBadges])

  useEffect(() => {
    setDirtyGuard(dirty, 'Minutes desk')
    return () => setDirtyGuard(false)
  }, [dirty])

  const patch = (p) => {
    setDirty(true)
    setDoc((d) => ({ ...d, ...p }))
  }

  const [groundingBusy, setGroundingBusy] = useState(false)

  /**
   * Persist one rules.kb / rules.normalize flag on the spot.
   *
   * The write is built from a fresh read of the profile rather than from this
   * page's state, so switching a flag cannot also commit a half-typed name or an
   * in-progress edit to the Advanced rules JSON. The only field that changes is
   * the one the switch names.
   */
  const toggleGroundingRule = async (group, key, value) => {
    const prevKb = kbFlags
    const prevNorm = normFlags
    if (group === 'kb') setKbFlags((f) => ({ ...f, [key]: value }))
    else setNormFlags((f) => ({ ...f, [key]: value }))
    setGroundingBusy(true)
    try {
      const p = await mi.getProfile(id)
      const rules = asObj(p.rules)
      rules[group] = { ...asObj(rules[group]), [key]: value }
      await mi.putProfile(id, {
        id,
        name: p.name,
        languages: parseLangs(p.languages),
        mom_template: { sections: asObj(p.mom_template).sections ?? [] },
        rules,
        memory_policy: asObj(p.memory_policy),
        b_authority_policy: p.b_authority_policy ?? '',
        retention: asObj(p.retention),
      })
      toast.ok(`rules.${group}.${key} is now ${value}`)
    } catch (e) {
      setKbFlags(prevKb)
      setNormFlags(prevNorm)
      toast.fail(e, `Set rules.${group}.${key}`)
    } finally {
      setGroundingBusy(false)
    }
  }

  const rulesErr = jsonError(rulesRest)
  const memoryErr = jsonError(memoryText)

  const save = async () => {
    if (!doc) return
    let rest
    try {
      rest = JSON.parse(rulesRest || '{}')
    } catch {
      toast.push('err', 'Advanced rules JSON is invalid — not saved')
      setTab('grounding')
      return
    }
    let memory
    try {
      memory = JSON.parse(memoryText || '{}')
    } catch {
      toast.push('err', 'Memory policy JSON is invalid — not saved')
      setTab('grounding')
      return
    }
    if (!String(doc.name ?? '').trim()) {
      toast.push('err', 'Name is required — not saved')
      setTab('desk')
      return
    }
    const min = doc._min_segments
    const rules = { ...rest }
    if (min != null && min !== '') {
      rules.case_b = { ...(rules.case_b ?? {}), min_segments: Number(min) }
    }
    rules.kb = { ...asObj(rest.kb), ...kbFlags }
    rules.normalize = { ...asObj(rest.normalize), ...normFlags }
    const priorInsights = asObj(asObj(rest).insights)
    rules.insights = {
      ...priorInsights,
      summary: !!insightsSummary,
      feedback: !!insightsFeedback,
    }
    setBusy(true)
    try {
      await mi.putProfile(id, {
        id,
        name: doc.name,
        languages: parseLangs(doc.languages),
        mom_template: {
          sections: asObj(doc.mom_template).sections ?? [],
        },
        rules,
        memory_policy: memory,
        b_authority_policy: doc.b_authority_policy ?? '',
        retention: { transcript_days: doc._transcript_days },
      })
      setDirty(false)
      await load()
      toast.ok('Saved — new meetings will use this. Existing meetings keep their snapshot.')
    } catch (e) {
      toast.fail(e, 'Save profile')
    } finally {
      setBusy(false)
    }
  }

  const saveKb = async () => {
    if (!kbId.trim()) {
      toast.push('err', 'KB doc id required')
      return
    }
    setBusy(true)
    try {
      await mi.putKbDoc(id, kbId.trim(), { title: kbTitle, body: kbBody })
      await load()
      toast.ok(`KB ${kbId} saved`)
    } catch (e) {
      toast.fail(e, 'Save KB')
    } finally {
      setBusy(false)
    }
  }

  const removeKb = async (docId) => {
    if (!window.confirm(`Delete standing doc ${docId}? Ask will stop citing it.`)) return
    setBusy(true)
    try {
      await mi.deleteKbDoc(id, docId)
      if (kbId === docId) {
        setKbId('')
        setKbTitle('')
        setKbBody('')
      }
      await load()
      toast.ok(`Deleted ${docId}`)
    } catch (e) {
      toast.fail(e, 'Delete Other doc')
    } finally {
      setBusy(false)
    }
  }

  const sections = useMemo(() => asObj(doc?.mom_template).sections ?? [], [doc])

  const badges = {
    minutes: sections.length || null,
    directory: inboxCount || null,
    library: kb.length || null,
  }

  if (err) {
    return (
      <div className="content">
        <div className="probe err">{err}</div>
        <Link to="/MI/admin/profiles">← Profiles</Link>
      </div>
    )
  }
  if (!doc) return <div className="content">Loading…</div>

  const minSeg = doc._min_segments ?? asObj(doc.rules).case_b?.min_segments ?? ''
  const days = doc._transcript_days ?? asObj(doc.retention).transcript_days ?? ''

  const setSections = (next) =>
    patch({
      mom_template: { ...asObj(doc.mom_template), sections: next },
    })

  const moveSection = (i, delta) => {
    const j = i + delta
    if (j < 0 || j >= sections.length) return
    const next = [...sections]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSections(next)
  }

  return (
    <div className="content">
      <div className="page-head has-actions">
        <div className="head-text">
          <Link to="/MI/admin/profiles">← Profiles</Link>
          <h1>{doc.name || id}</h1>
          <p>
            Updates apply to <strong>new</strong> meetings. Meetings already created keep the
            snapshot they were born with.
          </p>
        </div>
        <div className="page-actions">
          <Link
            className="btn secondary"
            to={`/MI/admin/meetings?profile_id=${encodeURIComponent(id)}`}
          >
            Meetings{meetingCount != null ? ` (${meetingCount})` : ''}
          </Link>
        </div>
      </div>

      <div className="mi-tabbar" role="tablist" aria-label="Profile settings">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`mi-tab ${tab === t.key ? 'active' : ''} ${t.danger ? 'danger' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {badges[t.key] ? <span className="mi-tab-n">{badges[t.key]}</span> : null}
          </button>
        ))}
        <span className="mi-tabbar-end">
          {dirty && (
            <span className="mi-dirty">
              <span className="dot" /> Unsaved
            </span>
          )}
          <button className="btn" onClick={save} disabled={busy || !dirty}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </span>
      </div>

      {tab === 'desk' && (
        <>
          <Card title="Desk" hint="Who this desk is and what it listens to.">
            <TextField
              label="Name"
              value={doc.name ?? ''}
              onChange={(v) => patch({ name: v })}
              desc="Shown on the profile list and printed on exported Minutes."
            />
            <StringList
              label="Languages"
              values={parseLangs(doc.languages)}
              onChange={(v) => patch({ languages: v })}
              placeholder="en-IN"
              desc="Spoken languages this desk transcribes and writes Minutes in."
            />
            <SelectField
              label="b_authority_policy"
              value={doc.b_authority_policy ?? ''}
              onChange={(v) => patch({ b_authority_policy: v })}
              options={B_AUTHORITY}
              allowEmpty
              emptyLabel="— server default —"
              desc="Which transcript wins when both a Case A and a Case B generation exist."
            />
          </Card>

          <Card title="Capture and retention">
            <NumberField
              label="rules.case_b.min_segments"
              value={minSeg}
              onChange={(v) => patch({ _min_segments: v })}
              desc="Fewest pushed segments a Case B meeting needs before it will draft Minutes."
            />
            <NumberField
              label="retention.transcript_days"
              value={days}
              onChange={(v) => patch({ _transcript_days: v })}
              desc="Days a raw transcript is kept before the retention purge can drop it. Official Minutes are never purged by this."
            />
          </Card>

          <Card title="Identity" hint="Read-only — the archive owns these.">
            <dl className="kv">
              <dt>id</dt>
              <dd>{doc.id ?? id}</dd>
              <dt>created</dt>
              <dd>{doc.created_at ?? '—'}</dd>
              <dt>updated</dt>
              <dd>{doc.updated_at ?? '—'}</dd>
              <dt>meetings</dt>
              <dd>{meetingCount == null ? '—' : meetingCount}</dd>
            </dl>
          </Card>
        </>
      )}

      {tab === 'minutes' && (
        <>
          <Card
            title="Minutes sections"
            hint="The headings every new meeting drafts into, in this order. Existing meetings keep the template they were born with."
          >
            {!sections.length && (
              <Empty>
                No sections. The draft will render whatever the pipeline produces, with no fixed
                shape.
              </Empty>
            )}
            {sections.map((s, i) => (
              <div className="mi-section-row" key={i}>
                <span className="mi-section-ord">{i + 1}</span>
                <TextField
                  label="id"
                  value={s.id ?? ''}
                  onChange={(v) => setSections(sections.map((x, n) => (n === i ? { ...x, id: v } : x)))}
                  mono
                />
                <TextField
                  label="title"
                  value={s.title ?? ''}
                  onChange={(v) =>
                    setSections(sections.map((x, n) => (n === i ? { ...x, title: v } : x)))
                  }
                />
                <button
                  type="button"
                  className="btn secondary sm"
                  onClick={() => moveSection(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${s.title || s.id} up`}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn secondary sm"
                  onClick={() => moveSection(i, 1)}
                  disabled={i === sections.length - 1}
                  aria-label={`Move ${s.title || s.id} down`}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn danger sm"
                  onClick={() => setSections(sections.filter((_, n) => n !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn secondary sm"
              onClick={() =>
                setSections([...sections, { id: `s${sections.length + 1}`, title: '' }])
              }
            >
              Add section
            </button>
          </Card>

          <ExportBrandingCard profileId={id} />
        </>
      )}

      {tab === 'grounding' && (
        <>
          <GroundingFlags
            kb={kbFlags}
            normalize={normFlags}
            onToggle={toggleGroundingRule}
            busy={groundingBusy}
          />

          <InsightsFlags
            summary={insightsSummary}
            feedback={insightsFeedback}
            onChange={({ summary, feedback }) => {
              setDirty(true)
              setInsightsSummary(summary)
              setInsightsFeedback(feedback)
            }}
          />

          <Card
            title="Advanced rules JSON"
            hint="Everything in rules that the switches above do not own. Merged with min_segments and the switches on save; invalid JSON blocks save."
          >
            <textarea
              rows={10}
              value={rulesRest}
              onChange={(e) => {
                setDirty(true)
                setRulesRest(e.target.value)
              }}
              spellCheck={false}
            />
            {rulesErr && <div className="probe err">Invalid JSON — {rulesErr}</div>}
          </Card>

          <Card
            title="Memory policy JSON"
            hint="How confirmed identity and terminology memory is allowed to accumulate on this desk."
          >
            <textarea
              rows={8}
              value={memoryText}
              onChange={(e) => {
                setDirty(true)
                setMemoryText(e.target.value)
              }}
              spellCheck={false}
            />
            {memoryErr && <div className="probe err">Invalid JSON — {memoryErr}</div>}
          </Card>
        </>
      )}

      {tab === 'directory' && (
        <>
          <DirectoryPane
            profileId={id}
            rulesKb={asObj(asObj(doc.rules).kb)}
            onProfileReload={load}
          />
          <MemoryInbox profileId={id} />
          <TerminologyPane profileId={id} />
        </>
      )}

      {tab === 'library' && (
        <Card
          title="Other docs (standing library)"
          hint="Paste library for Ask / background — not the people/products identity directory."
        >
          {!kb.length && <Empty>No Other docs yet.</Empty>}
          {!!kb.length && (
            <div className="mi-rows">
              {kb.map((d) => (
                <div className="mi-row" key={d.id}>
                  <div className="mi-row-main">
                    <div className="mi-row-title">{d.title || '(untitled)'}</div>
                    <div className="mi-row-sub">
                      {d.id}
                      {d.revision ? ` · rev ${d.revision}` : ''}
                    </div>
                  </div>
                  <div className="mi-row-badges">
                    <button
                      type="button"
                      className="btn secondary sm"
                      onClick={() => {
                        setKbId(d.id)
                        setKbTitle(d.title ?? '')
                        setKbBody(d.body ?? '')
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn danger sm"
                      onClick={() => removeKb(d.id)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ marginBottom: 0 }}>{kbId ? 'Edit doc' : 'New doc'}</h3>
          <div className="mi-inline-field">
            <TextField
              label="doc_id"
              value={kbId}
              onChange={setKbId}
              mono
              desc="UUID, set once. The archive stores it as a UUID."
            />
            <button type="button" className="btn secondary sm" onClick={() => setKbId(randomUUID())}>
              Generate id
            </button>
          </div>
          <TextField label="title" value={kbTitle} onChange={setKbTitle} />
          <label>body</label>
          <textarea rows={8} value={kbBody} onChange={(e) => setKbBody(e.target.value)} />
          <div className="actions">
            <button className="btn" onClick={saveKb} disabled={busy}>
              Save Other doc
            </button>
            {kbId && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setKbId('')
                  setKbTitle('')
                  setKbBody('')
                }}
              >
                Clear form
              </button>
            )}
          </div>
        </Card>
      )}

      {tab === 'ask' && <AskPane scope="profile" targetId={id} />}

      {tab === 'danger' && (
        <Card
          title="Delete this profile"
          hint="Removes the desk and everything it owns. There is no undo in this console."
        >
          <div className="card mi-danger">
            <p className="desc" style={{ marginTop: 0 }}>
              Deleting <strong>{doc.name || id}</strong> also removes its Minutes template, standing
              docs, people and product directory, terminology, export branding and Ask history.
              Audit events are kept.
            </p>
            {meetingCount == null && <p className="desc">Checking for meetings…</p>}
            {meetingCount != null && meetingCount > 0 && (
              <div className="probe err">
                This profile has {meetingCount} meeting{meetingCount === 1 ? '' : 's'}. Every
                meeting pins the profile it was born with, so it cannot be deleted while any of them
                exist.{' '}
                <Link to={`/MI/admin/meetings?profile_id=${encodeURIComponent(id)}`}>
                  Review those meetings
                </Link>
                .
              </div>
            )}
            {meetingCount === 0 && (
              <div className="probe">No meetings reference this profile — it can be deleted.</div>
            )}
            <div className="actions">
              <button
                type="button"
                className="btn danger"
                onClick={() => setDeleting(true)}
                disabled={meetingCount == null || meetingCount > 0}
              >
                Delete profile…
              </button>
            </div>
          </div>
        </Card>
      )}

      <DeleteProfileDialog
        open={deleting}
        profile={doc}
        onClose={() => setDeleting(false)}
        onDeleted={() => {
          // The page being edited no longer exists, so drop the unsaved-work
          // guard before routing or it will prompt on the way out.
          setDirty(false)
          setDirtyGuard(false)
          nav('/MI/admin/profiles', { replace: true })
        }}
      />
    </div>
  )
}
