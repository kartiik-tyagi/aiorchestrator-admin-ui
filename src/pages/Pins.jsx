import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../api/catalog'
import { api } from '../api/client'
import { Card, Empty, useAsync, useToast } from '../components/ui'
/**
 * Answer pins tie a profile to a published flow version. Without one, a live or
 * chat session create is refused with 422 flow_pin_required — this is the switch
 * that makes an inbound DID answerable.
 *
 * Note: the pin list is persisted as the `answer_pins` system setting. Editing
 * that key by hand on the Settings page will corrupt it — use this screen.
 */
export default function Pins() {
  const { status, reloadStatus } = useCatalog()
  const toast = useToast()
  const pins = useAsync(() => api.getAnswerPins(), [])
  const profiles = useAsync(() => api.listProfiles(), [])
  const flows = useAsync(() => api.listFlows(), [])
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (pins.data) {
      setRows(pins.data.pins ?? [])
      setDirty(false)
    }
  }, [pins.data])
  const set = (i, p) => {
    setRows((xs) =>
      xs.map((r, n) =>
        n === i
          ? {
              ...r,
              ...p,
            }
          : r,
      ),
    )
    setDirty(true)
  }
  const save = async () => {
    const clean = rows.filter((r) => r.profile_id?.trim() && r.flow_id?.trim())
    setBusy(true)
    try {
      const got = await api.putAnswerPins(clean)
      setRows(got.pins ?? [])
      setDirty(false)
      toast.ok(`Saved ${got.pins?.length ?? 0} pin(s)`)
      void reloadStatus()
    } catch (e) {
      toast.fail(e, 'Save pins')
    } finally {
      setBusy(false)
    }
  }
  const flowIds = (flows.data?.flows ?? []).map((f) => f.id)
  const profileIds = (profiles.data?.profiles ?? []).map((p) => p.id)
  const publishedVersion = (fid) => flows.data?.flows?.find((f) => f.id === fid)?.current_version
  return (
    <div className="content">
      <div className="page-head">
        <h1>Answer pins</h1>
        <p>
          Which profile answers with which published flow version. A pin is required before a live
          or chat session can be created — without one the API returns{' '}
          <code>422 flow_pin_required</code>.
        </p>
      </div>

      {status && !status.ready_for_sessions && (
        <div className="probe warn">
          Platform is not ready for sessions: {status.blockers.join(', ') || 'unknown'}. Pins alone
          are not enough — engines must be bound and a profile published.
        </div>
      )}

      <Card
        title="Pins"
        hint="flow_version accepts a number or the literal 'latest'. Using latest means a new publish takes effect without re-pinning."
        actions={
          <>
            <button className="btn" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save pins'}
            </button>
            <button
              className="btn secondary"
              onClick={() => {
                void pins.reload()
                void flows.reload()
              }}
            >
              Reload
            </button>
            <button
              className="btn secondary"
              onClick={() => {
                setRows((xs) => [
                  ...xs,
                  {
                    profile_id: '',
                    flow_id: '',
                    flow_version: 'latest',
                  },
                ])
                setDirty(true)
              }}
            >
              Add pin
            </button>
            {dirty && <span className="badge warn">unsaved changes</span>}
          </>
        }
      >
        {!rows.length && <Empty>No pins. Add one once a profile and flow are published.</Empty>}

        {rows.map((r, i) => {
          const pub = publishedVersion(r.flow_id)
          return (
            <div className="card sub" key={i}>
              <div className="row tight">
                <div className="field">
                  <label>Profile</label>
                  <select
                    value={r.profile_id}
                    onChange={(e) =>
                      set(i, {
                        profile_id: e.target.value,
                      })
                    }
                  >
                    <option value="">— select —</option>
                    {profileIds.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Flow</label>
                  <select
                    value={r.flow_id}
                    onChange={(e) =>
                      set(i, {
                        flow_id: e.target.value,
                      })
                    }
                  >
                    <option value="">— select —</option>
                    {flowIds.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Flow version</label>
                  <input
                    value={r.flow_version ?? 'latest'}
                    onChange={(e) =>
                      set(i, {
                        flow_version: e.target.value,
                      })
                    }
                  />
                  <p className="desc">
                    {r.flow_id
                      ? pub != null
                        ? `published: v${pub}`
                        : 'this flow has no published version yet'
                      : 'pick a flow'}
                  </p>
                </div>
                <div className="field">
                  <label>DID label</label>
                  <input
                    value={r.did ?? ''}
                    placeholder="optional"
                    onChange={(e) =>
                      set(i, {
                        did: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="row tight">
                <div className="field">
                  <label>Note</label>
                  <input
                    value={r.note ?? ''}
                    onChange={(e) =>
                      set(i, {
                        note: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              {r.flow_id && pub == null && (
                <div className="probe err">
                  <code>{r.flow_id}</code> has no published version — this pin cannot answer a call.{' '}
                  <Link to={`/flows/${encodeURIComponent(r.flow_id)}/builder`}>
                    Open the builder and publish
                  </Link>
                  .
                </div>
              )}
              <div className="actions tight">
                <button
                  className="btn danger sm"
                  onClick={() => {
                    setRows((xs) => xs.filter((_, n) => n !== i))
                    setDirty(true)
                  }}
                >
                  Remove pin
                </button>
              </div>
            </div>
          )
        })}
      </Card>

      <Card
        title="How a call reaches this pin"
        hint="For context — none of this is configured from the console."
      >
        <p className="inline-note">
          FreeSWITCH answers the DID and opens a WebSocket to <code>/edge/fs</code> using the
          <code> edge.base_url</code> in <code>conf/aiorchestrator.properties</code>. The
          orchestrator then resolves the profile, applies this pin to load the published flow, and
          starts the graph at its Entry node. Editing the properties file and the FreeSWITCH
          dialplan is an ops task outside this console.
        </p>
      </Card>
    </div>
  )
}
