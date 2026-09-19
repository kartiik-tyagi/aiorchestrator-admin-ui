import { useEffect, useState } from 'react'
import { mi } from '../../api/mi/client'
import { Card, TextField, useToast } from '../../components/ui'
import { asList, asMom, unsupportedFields } from '../../lib/miDraft'
import { miErrorSentence } from '../../lib/miErrors'

export default function DraftEditor({ meetingId, onDraft }) {
  const toast = useToast()
  const [draft, setDraft] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loadedVersion, setLoadedVersion] = useState(null)

  const apply = (d) => {
    setDraft(d)
    setLoadedVersion(d.version)
    onDraft?.(d)
  }

  const load = async () => {
    try {
      const d = await mi.getDraft(meetingId)
      apply(d)
      setErr(null)
    } catch (e) {
      setErr(miErrorSentence(e.code, e.message))
      setDraft(null)
      onDraft?.(null)
    }
  }

  useEffect(() => {
    void load()
  }, [meetingId])

  if (err) return <div className="probe err">{err}</div>
  if (!draft) return <p className="desc">Loading draft…</p>

  const mom = asMom(draft.mom)
  const decisions = asList(draft.decisions)
  const actions = asList(draft.actions)
  const bad = unsupportedFields(draft)

  const setMomSection = (i, field, value) => {
    const sections = (mom.sections ?? []).map((s, idx) => (idx === i ? { ...s, [field]: value } : s))
    setDraft({ ...draft, mom: { ...mom, sections } })
  }
  const setClaim = (key, i, field, value) => {
    const next = asList(draft[key]).map((c, idx) => (idx === i ? { ...c, [field]: value } : c))
    setDraft({ ...draft, [key]: next })
  }

  const save = async () => {
    setBusy(true)
    try {
      const latest = await mi.getDraft(meetingId)
      if (latest.version !== loadedVersion) {
        toast.push('err', 'Another tab changed this draft. Reload before saving.')
        apply(latest)
        return
      }
      const got = await mi.patchDraft(meetingId, {
        mom: draft.mom,
        decisions: draft.decisions,
        actions: draft.actions,
      })
      apply(got)
      toast.ok(`Draft saved — version ${got.version}`)
    } catch (e) {
      toast.fail(e, 'Save draft')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Draft minutes" hint={`version ${draft.version} · do not invent section ids`}>
      {bad.length > 0 && (
        <div className="probe warn">
          Unsupported AI fields — correct or remove before official:{' '}
          {bad.map((b) => b.path).join(', ')}
        </div>
      )}
      {(mom.sections ?? []).map((s, i) => (
        <div key={s.id || i} className="card sub">
          <TextField label={`Section ${s.id || i} title`} value={s.title || ''} onChange={(v) => setMomSection(i, 'title', v)} />
          <label>Body</label>
          <textarea rows={5} value={s.body || ''} onChange={(e) => setMomSection(i, 'body', e.target.value)} />
        </div>
      ))}
      {!mom.sections?.length && <p className="desc">This draft has no MoM sections.</p>}

      <h3>Decisions</h3>
      {decisions.map((c, i) => (
        <div key={c.id || i} className={`card sub ${c.origin === 'unsupported_ai' ? 'warn' : ''}`}>
          <TextField
            label={`${c.id || `decisions[${i}]`} (${c.origin || 'origin unknown'})`}
            value={c.text || ''}
            onChange={(v) => setClaim('decisions', i, 'text', v)}
          />
        </div>
      ))}
      {!decisions.length && <p className="desc">No decision claims.</p>}

      <h3>Actions</h3>
      {actions.map((c, i) => (
        <div key={c.id || i} className="card sub">
          <TextField
            label={`${c.id || `actions[${i}]`} (${c.origin || 'origin unknown'})`}
            value={c.text || ''}
            onChange={(v) => setClaim('actions', i, 'text', v)}
          />
        </div>
      ))}
      {!actions.length && <p className="desc">No action claims.</p>}

      <div className="actions tight">
        <button className="btn" disabled={busy} onClick={save}>
          Save draft
        </button>
        <button className="btn secondary" onClick={() => void load()}>
          Reload
        </button>
      </div>
    </Card>
  )
}
