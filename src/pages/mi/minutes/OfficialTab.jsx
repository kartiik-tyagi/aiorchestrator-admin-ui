import { useEffect, useMemo, useState } from 'react'
import { mi } from '../../../api/mi/client'
import { officialToDocument } from '../../../lib/miDocument'
import { miErrorSentence } from '../../../lib/miErrors'
import DownloadMenu from './DownloadMenu'
import MinutesDocument from './MinutesDocument'
import OutlineRail from './OutlineRail'

/**
 * Official tab (wave 7.4): an approved version as a locked document, a version
 * picker (URL `v`), and Download of the selected version. Officials are
 * immutable, so there is no edit control here.
 */
export default function OfficialTab({ meetingId, facet, segments, version, setVersion, draftVersion, onOpenSegment, onGoToMom }) {
  const [history, setHistory] = useState(null)
  const [err, setErr] = useState(null)
  const currentOfficial = facet?.official?.official_version

  useEffect(() => {
    let live = true
    mi.getOfficialHistory(meetingId)
      .then((d) => {
        if (!live) return
        setHistory((d.officials ?? []).slice().sort((a, b) => b.official_version - a.official_version))
        setErr(null)
      })
      .catch((e) => {
        if (!live) return
        setHistory([])
        setErr(miErrorSentence(e.code, e.message))
      })
    return () => {
      live = false
    }
  }, [meetingId, currentOfficial])

  const selected = useMemo(() => {
    if (!history?.length) return null
    return history.find((o) => o.official_version === version) || history[0]
  }, [history, version])

  const doc = useMemo(() => (selected ? officialToDocument(facet, selected, segments) : null), [facet, selected, segments])

  if (err) return <div className="probe err">{err}</div>
  if (!history) return <p className="desc">Loading approved minutes…</p>
  if (!selected) {
    return (
      <div className="card">
        <p className="desc">No approved version yet. Review the draft in the MoM tab, then approve.</p>
        <button type="button" className="btn secondary sm" onClick={onGoToMom}>
          Open the draft
        </button>
      </div>
    )
  }

  const unknownVersion = version != null && !history.some((o) => o.official_version === version)
  const draftAhead = draftVersion != null && draftVersion > selected.draft_version && selected.official_version === history[0].official_version

  return (
    <div>
      <div className="minutes-toolbar">
        <span className="status-chip official">Official v{selected.official_version}</span>
        <label className="desc" htmlFor="official-version">
          Version
        </label>
        <select
          id="official-version"
          value={selected.official_version}
          onChange={(e) => setVersion(Number(e.target.value))}
        >
          {history.map((o) => (
            <option key={o.id} value={o.official_version}>
              v{o.official_version}
              {o.official_version === history[0].official_version ? ' (current)' : ''} · {new Date(o.approved_at).toLocaleDateString()}
              {o.approver_label ? ` · ${o.approver_label}` : ''}
            </option>
          ))}
        </select>
        <span className="desc">from draft v{selected.draft_version}</span>
        <span className="spacer" />
        <DownloadMenu meetingId={meetingId} officialVersion={selected.official_version} />
      </div>
      {unknownVersion && (
        <div className="probe warn">Version v{version} does not exist; showing v{selected.official_version}.</div>
      )}
      {draftAhead && (
        <div className="probe warn">
          The draft has changes after Official v{selected.official_version} (draft v{draftVersion}).{' '}
          <button type="button" className="btn secondary sm" onClick={onGoToMom}>
            Open the draft
          </button>
        </div>
      )}
      <div className="minutes-layout">
        <OutlineRail doc={doc} />
        <MinutesDocument doc={doc} mode="preview" onOpenSegment={onOpenSegment} />
      </div>
    </div>
  )
}
