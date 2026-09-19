import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, getTenant } from '../api/client'
import { Card, Empty, Modal, SelectField, TextField, useAsync, useToast } from '../components/ui'
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
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState('')
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [direction, setDirection] = useState('inbound')
  const [busy, setBusy] = useState(false)

  const openCreate = () => {
    setId('')
    setName('')
    setDirection('inbound')
    setCreating(true)
  }

  const all = list.data?.flows ?? []
  const needle = q.trim().toLowerCase()
  const shown = needle
    ? all.filter(
        (f) => f.id.toLowerCase().includes(needle) || (f.name ?? '').toLowerCase().includes(needle),
      )
    : all
  const removeFlow = async (f) => {
    const published = (f.current_version ?? 0) > 0
    if (
      !confirm(
        `Delete flow "${f.id}"?

` +
          (published
            ? `This removes its draft and all ${f.current_version} published version(s). `
            : 'This removes its draft. ') +
          `Sessions that ran it are kept. The server refuses if an answer pin points at it.`,
      )
    )
      return
    setBusy(true)
    try {
      await api.deleteFlow(f.id)
      toast.ok(`Deleted ${f.id}`)
      await list.reload()
    } catch (e) {
      toast.fail(e, 'Delete flow')
    } finally {
      setBusy(false)
    }
  }

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
      setCreating(false)
      setId('')
      setName('')
      await list.reload()
      nav(`/CC/admin/flows/${encodeURIComponent(fid)}/builder`)
    } catch (e) {
      toast.fail(e, 'Create flow')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="content">
      <div className="page-head has-actions">
        <div className="head-text">
          <h1>Flows</h1>
          <p>
            A flow is the conversation graph — the law the bot follows. Drafts are mutable;
            published versions are immutable and content-hashed, and only a published version can be
            pinned to answer calls.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn secondary" onClick={() => void list.reload()}>
            Reload
          </button>
          <button className="btn" onClick={openCreate}>
            New flow
          </button>
        </div>
      </div>

      {/* No card title — the page heading already says Flows. */}
      <Card>
        {all.length > 3 && (
          <div className="card-toolbar">
            <input
              type="search"
              value={q}
              placeholder="Filter by id or name…"
              onChange={(e) => setQ(e.target.value)}
              aria-label="Filter flows"
            />
            <span className="list-count">
              {shown.length === all.length
                ? `${all.length} flows`
                : `${shown.length} of ${all.length}`}
            </span>
          </div>
        )}
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Direction</th>
                <th>Status</th>
                <th>Version</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((f) => (
                <tr key={f.id}>
                  <td className="cell-id">{f.id}</td>
                  <td>{f.name || <span className="cell-dim">—</span>}</td>
                  <td className="cell-dim">{f.direction || '—'}</td>
                  <td>
                    {f.status === 'published' ? (
                      <span className="badge ok">published</span>
                    ) : (
                      <span className="badge warn">{f.status || 'draft'}</span>
                    )}
                  </td>
                  <td>
                    {f.current_version ? (
                      <span className="mono">v{f.current_version}</span>
                    ) : (
                      <span className="cell-dim">never published</span>
                    )}
                  </td>
                  <td className="row-actions">
                    <Link
                      className="btn sm secondary"
                      to={`/CC/admin/flows/${encodeURIComponent(f.id)}/builder`}
                    >
                      Open builder
                    </Link>{' '}
                    <button
                      className="btn danger sm"
                      onClick={() => void removeFlow(f)}
                      disabled={busy}
                      title="Delete this flow, its draft and all published versions"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!all.length && <Empty>No flows yet — use “New flow” to create one.</Empty>}
        {!!all.length && !shown.length && <Empty>No flow matches “{q}”.</Empty>}
      </Card>

      <Modal
        open={creating}
        title="New flow"
        hint="Starts from a minimal valid graph (Entry → Speak → End) so you can publish immediately and edit from there."
        onClose={() => setCreating(false)}
        onSubmit={create}
        submitLabel="Create & open builder"
        busy={busy}
      >
        <TextField
          label="Flow id"
          value={id}
          onChange={setId}
          placeholder="coral-inbound-triage"
          mono
          desc="Permanent. Sessions and answer pins reference the flow by this id."
        />
        <TextField
          label="Name"
          value={name}
          onChange={setName}
          placeholder="Coral inbound triage"
          desc="Shown in listings. Defaults to the id."
        />
        <SelectField
          label="Direction"
          value={direction}
          onChange={setDirection}
          options={['inbound', 'outbound']}
          allowEmpty={false}
        />
        <p className="inline-note">
          <strong>Created one wrongly?</strong> Delete it from the table. Its draft and every
          published version go with it. The server refuses while an answer pin still points at the
          flow, so unpin it first.
        </p>
      </Modal>
    </div>
  )
}
