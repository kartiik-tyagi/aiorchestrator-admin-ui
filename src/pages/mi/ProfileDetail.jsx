import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { mi } from '../../api/mi/client'
import { Card, NumberField, StringList, TextField, useToast } from '../../components/ui'
import AskPane from './AskPane'
import DirectoryPane from './DirectoryPane'
import InsightsFlags from './InsightsFlags'
import MemoryInbox from './MemoryInbox'
import { miErrorSentence } from '../../lib/miErrors'
import { setDirtyGuard } from '../../lib/dirtyGuard'

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

export default function MiProfileDetail() {
  const { id = '' } = useParams()
  const toast = useToast()
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

  const load = useCallback(async () => {
    try {
      const p = await mi.getProfile(id)
      setDoc(p)
      const rules = asObj(p.rules)
      const insights = asObj(rules.insights)
      setInsightsSummary(insights.summary === true || insights.summary === 'true')
      setInsightsFeedback(insights.feedback === true || insights.feedback === 'true')
      const rest = { ...rules }
      if (rest.case_b) {
        const { min_segments: _ms, ...cb } = rest.case_b
        rest.case_b = Object.keys(cb).length ? cb : undefined
        if (!rest.case_b) delete rest.case_b
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

  useEffect(() => {
    setDirtyGuard(dirty, 'Minutes desk')
    return () => setDirtyGuard(false)
  }, [dirty])

  const patch = (p) => {
    setDirty(true)
    setDoc((d) => ({ ...d, ...p }))
  }

  const save = async () => {
    if (!doc) return
    let rest
    try {
      rest = JSON.parse(rulesRest || '{}')
    } catch {
      toast.push('err', 'Advanced rules JSON is invalid — not saved')
      return
    }
    let memory
    try {
      memory = JSON.parse(memoryText || '{}')
    } catch {
      toast.push('err', 'Memory policy JSON is invalid — not saved')
      return
    }
    const min = doc._min_segments
    const rules = { ...rest }
    if (min != null && min !== '') {
      rules.case_b = { ...(rules.case_b ?? {}), min_segments: Number(min) }
    }
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

  if (err) {
    return (
      <div className="content">
        <div className="probe err">{err}</div>
        <Link to="/MI/admin/profiles">← Profiles</Link>
      </div>
    )
  }
  if (!doc) return <div className="content">Loading…</div>

  const sections = asObj(doc.mom_template).sections ?? []
  const minSeg = doc._min_segments ?? asObj(doc.rules).case_b?.min_segments ?? ''
  const days = doc._transcript_days ?? asObj(doc.retention).transcript_days ?? ''

  const setSections = (next) =>
    patch({
      mom_template: { ...asObj(doc.mom_template), sections: next },
    })

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
          <Link className="btn secondary" to={`/MI/admin/meetings?profile_id=${encodeURIComponent(id)}`}>
            Meetings for this profile
          </Link>
          <button className="btn" onClick={save} disabled={busy}>
            Save
          </button>
        </div>
      </div>

      <Card title="Desk">
        <TextField label="Name" value={doc.name ?? ''} onChange={(v) => patch({ name: v })} />
        <StringList
          label="Languages"
          values={parseLangs(doc.languages)}
          onChange={(v) => patch({ languages: v })}
          placeholder="en-IN"
        />
        <NumberField
          label="rules.case_b.min_segments"
          value={minSeg}
          onChange={(v) => patch({ _min_segments: v })}
        />
        <NumberField
          label="retention.transcript_days"
          value={days}
          onChange={(v) => patch({ _transcript_days: v })}
        />
        <TextField
          label="b_authority_policy"
          value={doc.b_authority_policy ?? ''}
          onChange={(v) => patch({ b_authority_policy: v })}
        />
      </Card>

      <Card title="Minutes sections">
        {sections.map((s, i) => (
          <div className="row tight" key={i}>
            <TextField
              label="id"
              value={s.id ?? ''}
              onChange={(v) =>
                setSections(sections.map((x, n) => (n === i ? { ...x, id: v } : x)))
              }
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
          onClick={() => setSections([...sections, { id: `s${sections.length + 1}`, title: '' }])}
        >
          Add section
        </button>
      </Card>

      <Card title="Advanced rules JSON" hint="Merged with min_segments on save. Invalid JSON blocks save.">
        <textarea
          rows={8}
          value={rulesRest}
          onChange={(e) => {
            setDirty(true)
            setRulesRest(e.target.value)
          }}
          spellCheck={false}
        />
      </Card>
      <Card title="Memory policy JSON">
        <textarea
          rows={6}
          value={memoryText}
          onChange={(e) => {
            setDirty(true)
            setMemoryText(e.target.value)
          }}
          spellCheck={false}
        />
      </Card>

      <DirectoryPane
        profileId={id}
        rulesKb={asObj(asObj(doc.rules).kb)}
        onProfileReload={load}
      />

      <MemoryInbox profileId={id} />

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
        title="Other docs (standing library)"
        hint="Paste library for Ask / background — not the people/products identity directory."
      >
        {kb.map((d) => (
          <button
            type="button"
            className="btn secondary sm"
            key={d.id}
            style={{ marginRight: 8 }}
            onClick={() => {
              setKbId(d.id)
              setKbTitle(d.title ?? '')
              setKbBody(d.body ?? '')
            }}
          >
            {d.id}
          </button>
        ))}
        {!kb.length && <p className="desc">No Other docs yet.</p>}
        <TextField
          label="doc_id"
          value={kbId}
          onChange={setKbId}
          mono
          desc="UUID, set once. The archive stores it as a UUID."
        />
        <button type="button" className="btn secondary sm" onClick={() => setKbId(crypto.randomUUID())}>
          Generate id
        </button>
        <TextField label="title" value={kbTitle} onChange={setKbTitle} />
        <label>body</label>
        <textarea rows={8} value={kbBody} onChange={(e) => setKbBody(e.target.value)} />
        <button className="btn" onClick={saveKb} disabled={busy}>
          Save Other doc
        </button>
      </Card>
      <AskPane scope="profile" targetId={id} />
    </div>
  )
}
