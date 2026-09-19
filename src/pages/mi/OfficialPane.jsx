import { useEffect, useState } from 'react'
import { mi } from '../../api/mi/client'
import { Card, useToast } from '../../components/ui'
import { asMom } from '../../lib/miDraft'
import { miErrorSentence } from '../../lib/miErrors'

function downloadJson(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function OfficialPane({ meetingId }) {
  const toast = useToast()
  const [official, setOfficial] = useState(null)
  const [history, setHistory] = useState([])
  const [err, setErr] = useState(null)

  const load = () => {
    mi.getOfficial(meetingId)
      .then((o) => {
        setOfficial(o)
        setErr(null)
      })
      .catch((e) => {
        setOfficial(null)
        setErr(e.code === 'no_official' ? null : miErrorSentence(e.code, e.message))
      })
    mi.getOfficialHistory(meetingId)
      .then((d) => setHistory(d.officials ?? []))
      .catch(() => setHistory([]))
  }

  useEffect(() => {
    load()
  }, [meetingId])

  const exportJson = async () => {
    try {
      const data = await mi.exportMeeting(meetingId, { format: 'json' })
      downloadJson(`meeting-${meetingId}-official.json`, data)
      toast.ok('Export downloaded')
    } catch (e) {
      toast.fail(e, 'Export')
    }
  }

  const tryMarkdown = async () => {
    try {
      await mi.exportMeeting(meetingId, { format: 'markdown' })
      toast.ok('Markdown export is available on this lab')
    } catch (e) {
      toast.push('err', miErrorSentence(e.code, 'This lab only exports JSON (format=json).'))
    }
  }

  const mom = official ? asMom(official.mom) : { sections: [] }

  return (
    <>
      <Card
        title="Official"
        hint="Official is immutable. Ask prefers official over draft."
      >
        {err && <div className="probe err">{err}</div>}
        {!official && !err && <p className="desc">No official version yet.</p>}
        {official && (
          <>
            <p className="desc">
              official v{official.official_version} · draft {official.draft_id} v{official.draft_version}
              {official.approver_label ? ` · ${official.approver_label}` : ''}
            </p>
            {(mom.sections ?? []).map((s) => (
              <div key={s.id} className="card sub">
                <strong>{s.title || s.id}</strong>
                <p className="desc">{s.body}</p>
              </div>
            ))}
          </>
        )}
        <div className="actions tight">
          <button className="btn" onClick={exportJson}>
            Export JSON
          </button>
          <button className="btn secondary" onClick={tryMarkdown}>
            Export markdown
          </button>
          <button className="btn secondary" onClick={load}>
            Reload
          </button>
        </div>
      </Card>
      <Card title="Official history">
        {!history.length && <p className="desc">No official rows yet.</p>}
        {history.map((o) => (
          <div key={o.id} className="desc">
            v{o.official_version} · {o.id} · draft v{o.draft_version}
          </div>
        ))}
      </Card>
    </>
  )
}
