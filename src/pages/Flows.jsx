import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, getTenant } from '../api/client'
import { Card, Empty, SelectField, TextField, useAsync, useToast } from '../components/ui'
import { FLOW_SCHEMA_ID } from '../api/types'

/** A minimal but *valid* starting graph, so a new flow can be published immediately. */
function scaffold() {
  return {
    schema_id: FLOW_SCHEMA_ID,
    entry_node_id: 'entry',
    default_locale: 'en-IN',
    nodes: [
      {
        id: 'entry',
        type: 'Entry',
      },
      {
        id: 'greeting',
        type: 'Speak',
        prompt_ref: 'p_greeting',
      },
      {
        id: 'done',
        type: 'End',
      },
    ],
    edges: [
      {
        id: 'e_entry_greeting',
        from: 'entry',
        to: 'greeting',
        kind: 'next',
      },
      {
        id: 'e_greeting_done',
        from: 'greeting',
        to: 'done',
        kind: 'next',
      },
    ],
    prompts: {
      p_greeting: {
        'en-IN': 'Hello, thank you for calling.',
      },
    },
    matrix: [],
    binding_refs: [],
  }
}
export default function Flows() {
  const toast = useToast()
  const nav = useNavigate()
  const list = useAsync(() => api.listFlows(), [])
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [direction, setDirection] = useState('inbound')
  const [busy, setBusy] = useState(false)
  const create = async () => {
    const fid = id.trim()
    if (!fid) {
      toast.push('err', 'Flow id required')
      return
    }
    setBusy(true)
    try {
      await api.createFlow({
        id: fid,
        tenant_id: getTenant(),
        name: name.trim() || fid,
        direction,
        doc: scaffold(),
      })
      toast.ok(`Created ${fid} with a valid starter graph`)
      setId('')
      setName('')
      await list.reload()
      nav(`/flows/${encodeURIComponent(fid)}/builder`)
    } catch (e) {
      toast.fail(e, 'Create flow')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="content">
      <div className="page-head">
        <h1>Flows</h1>
        <p>
          A flow is the conversation graph — the law the bot follows. Drafts are mutable; published
          versions are immutable and content-hashed, and only a published version can be pinned to
          answer calls.
        </p>
      </div>

      <Card
        title="Flows"
        actions={
          <button className="btn secondary" onClick={() => void list.reload()}>
            Reload
          </button>
        }
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Direction</th>
                <th>Status</th>
                <th>Published version</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(list.data?.flows ?? []).map((f) => (
                <tr key={f.id}>
                  <td>
                    <code>{f.id}</code>
                  </td>
                  <td>{f.name || '—'}</td>
                  <td>{f.direction || '—'}</td>
                  <td>
                    {f.status === 'published' ? (
                      <span className="badge ok">published</span>
                    ) : (
                      <span className="badge warn">{f.status || 'draft'}</span>
                    )}
                  </td>
                  <td>{f.current_version ?? '—'}</td>
                  <td
                    style={{
                      textAlign: 'right',
                    }}
                  >
                    <Link
                      className="btn sm secondary"
                      to={`/flows/${encodeURIComponent(f.id)}/builder`}
                    >
                      Open builder
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.data?.flows?.length && <Empty>No flows yet — create one below.</Empty>}
      </Card>

      <Card
        title="Create flow"
        hint="New flows start from a minimal valid graph (Entry → Speak → End) so you can publish immediately and edit from there."
        actions={
          <button className="btn" onClick={create} disabled={busy}>
            Create &amp; open builder
          </button>
        }
      >
        <div className="row">
          <TextField
            label="Flow id"
            value={id}
            onChange={setId}
            placeholder="coral-inbound-triage"
            mono
          />
          <TextField
            label="Name"
            value={name}
            onChange={setName}
            placeholder="Coral inbound triage"
          />
          <SelectField
            label="Direction"
            value={direction}
            onChange={setDirection}
            options={['inbound', 'outbound']}
            allowEmpty={false}
          />
        </div>
      </Card>
    </div>
  )
}
