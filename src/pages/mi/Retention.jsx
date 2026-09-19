import { useState } from 'react'
import { mi } from '../../api/mi/client'
import { Card, TextField, useToast } from '../../components/ui'

export default function MiRetention() {
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [typed, setTyped] = useState('')
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const ready = typed === 'PURGE'

  const run = async () => {
    if (!ready) return
    setBusy(true)
    try {
      const r = await mi.retentionPurge()
      setReport(r)
      toast.ok('Retention run finished')
    } catch (e) {
      toast.fail(e, 'Purge')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <h1>Retention</h1>
        <p>Deletes expired transcripts per each desk’s retention days. Official minutes stay.</p>
      </div>
      <Card title="Purge expired transcripts" hint="Not a dashboard action. Two steps. Type PURGE exactly.">
        {step === 1 && (
          <>
            <p className="desc">
              This deletes old transcripts whose sealed time is older than the profile’s
              transcript_days. A desk with retention unset or 0 days is a no-op. Official packages
              are kept.
            </p>
            <button className="btn secondary" onClick={() => setStep(2)}>
              I understand — continue
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <TextField
              label="Type PURGE to enable"
              value={typed}
              onChange={setTyped}
              desc="Wrong case stays disabled. There is no keyboard shortcut."
            />
            <button className="btn danger" disabled={!ready || busy} onClick={run}>
              Confirm purge
            </button>
          </>
        )}
        {report && (
          <div className="probe">
            purged_generations={report.purged_generations ?? 0} deleted_segments=
            {report.deleted_segments ?? 0}
          </div>
        )}
      </Card>
    </div>
  )
}
