import { useState } from 'react'
import { mi } from '../../api/mi/client'
import { Card, TextField, useToast } from '../../components/ui'
import { miErrorSentence } from '../../lib/miErrors'

function Citations({ items }) {
  const list = items ?? []
  if (!list.length) return null
  return (
    <ul>
      {list.map((c, i) => (
        <li key={i} className="desc">
          {c.kind}
          {c.snippet ? ` — ${c.snippet}` : ''}
        </li>
      ))}
    </ul>
  )
}

function Result({ res }) {
  if (!res) return null
  if (res.abstained) {
    return (
      <div className="probe warn">
        Not in the official archive.
        {res.answer && res.answer !== 'not found in available evidence' ? ` (${res.answer})` : ''}
        <Citations items={res.citations} />
      </div>
    )
  }
  return (
    <div className="probe ok">
      {res.answer}
      <Citations items={res.citations} />
    </div>
  )
}

export default function AskPane({ scope, targetId, disabledReason }) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [one, setOne] = useState(null)
  const [session, setSession] = useState(null)
  const [turns, setTurns] = useState([])
  const [busy, setBusy] = useState(false)
  const blocked = Boolean(disabledReason)

  const askOnce = async () => {
    if (!q.trim() || blocked) return
    setBusy(true)
    try {
      const res =
        scope === 'profile'
          ? await mi.profileAsk(targetId, { question: q.trim() })
          : await mi.meetingAsk(targetId, { question: q.trim() })
      setOne(res)
    } catch (e) {
      toast.fail(e, 'Ask')
    } finally {
      setBusy(false)
    }
  }

  const newSession = async () => {
    if (blocked) return
    setBusy(true)
    try {
      const s =
        scope === 'profile'
          ? await mi.createProfileAskSession(targetId)
          : await mi.createMeetingAskSession(targetId)
      setSession(s)
      setTurns([])
      toast.ok('New Ask session — each turn re-reads the archive')
    } catch (e) {
      toast.fail(e, 'New session')
    } finally {
      setBusy(false)
    }
  }

  const sendTurn = async () => {
    if (!session?.id || !q.trim() || blocked) return
    setBusy(true)
    try {
      const t = await mi.postAskTurn(session.id, { question: q.trim() })
      const got = await mi.getAskSession(session.id)
      setTurns(got.turns ?? [])
      setOne({ answer: t.answer, abstained: t.abstained, citations: t.citations })
    } catch (e) {
      toast.fail(e, 'Ask turn')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title={scope === 'profile' ? 'Ask this desk' : 'Ask this meeting'}
      hint="Each turn re-reads the archive. The model has no chat memory of its own."
    >
      {blocked && <div className="probe warn">{disabledReason}</div>}
      <TextField label="Question" value={q} onChange={setQ} />
      <div className="actions tight">
        <button className="btn" disabled={busy || blocked || !q.trim()} onClick={askOnce}>
          Ask once
        </button>
        <button className="btn secondary" disabled={busy || blocked} onClick={newSession}>
          New session
        </button>
        <button className="btn secondary" disabled={busy || blocked || !session || !q.trim()} onClick={sendTurn}>
          Send in session
        </button>
      </div>
      {session && <p className="desc">Session {session.id}</p>}
      <Result res={one} />
      {turns.length > 0 && (
        <div className="card sub">
          {turns.map((t) => (
            <div key={t.id || t.seq} className="desc">
              <strong>Q{t.seq}.</strong> {t.question}
              <div>{t.abstained ? 'Not in the official archive.' : t.answer}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
