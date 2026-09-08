import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Background, Controls, MarkerType, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCatalog } from '../api/catalog'
import { api } from '../api/client'
import { useToast } from '../components/ui'
import { localeGaps, validateFlow } from '../lib/flowValidate'
import { resolveLayout, withLayout } from '../lib/layout'
import GraphNode, { NODE_COLOR } from './builder/GraphNode'
import Inspector from './builder/Inspector'
import { FLOW_SCHEMA_ID } from '../api/types'
const nodeTypes = {
  graph: GraphNode,
}
const emptyDoc = () => ({
  schema_id: FLOW_SCHEMA_ID,
  entry_node_id: '',
  default_locale: 'en-IN',
  nodes: [],
  edges: [],
  prompts: {},
  matrix: [],
  binding_refs: [],
})
function BuilderInner() {
  const { flowId = '' } = useParams()
  const { catalog } = useCatalog()
  const toast = useToast()
  const [doc, setDocState] = useState(emptyDoc())
  const [loaded, setLoaded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selNodeId, setSelNodeId] = useState(null)
  const [selEdgeId, setSelEdgeId] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [bindingIds, setBindingIds] = useState([])
  const [publishedVersion, setPublishedVersion] = useState(null)
  const [showJson, setShowJson] = useState(false)
  const [jsonText, setJsonText] = useState('')

  /** Node positions live outside the document until save, so dragging is cheap. */
  const [layout, setLayout] = useState({})
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const setDoc = useCallback((fn) => {
    setDocState((d) => fn(d))
    setDirty(true)
  }, [])

  /* ------------------------------------------------------------------ load */

  const load = useCallback(async () => {
    try {
      const [draft, binds, meta] = await Promise.all([
        api.getFlowDraft(flowId).catch((e) => {
          if (e.status === 404) return null
          throw e
        }),
        api.listBindings().catch(() => ({
          bindings: [],
        })),
        api.getFlow(flowId).catch(() => null),
      ])
      const d = draft?.doc ?? emptyDoc()
      setDocState(d)
      setLayout(resolveLayout(d))
      setBindingIds((binds.bindings ?? []).map((b) => b.id))
      setPublishedVersion(meta?.current_version ?? null)
      setLoaded(true)
      setDirty(false)
    } catch (e) {
      toast.fail(e, 'Load draft')
    }
  }, [flowId, toast])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (showJson) setJsonText(JSON.stringify(doc, null, 2))
  }, [showJson, doc])

  /* ------------------------------------------------------------ validation */

  const issues = useMemo(() => validateFlow(doc, catalog ?? undefined), [doc, catalog])
  const errors = issues.filter((i) => i.level === 'error')
  const badRefs = useMemo(() => new Set(errors.map((i) => i.ref).filter(Boolean)), [errors])
  const gaps = useMemo(() => localeGaps(doc, catalog?.tts_locales_v1 ?? []), [doc, catalog])

  /* ---------------------------------------------------------- canvas model */

  const rfNodes = useMemo(
    () =>
      doc.nodes.map((n) => ({
        id: n.id,
        type: 'graph',
        position: layout[n.id] ?? {
          x: 0,
          y: 0,
        },
        selected: n.id === selNodeId,
        data: {
          node: n,
          isEntry: doc.entry_node_id === n.id,
          invalid: badRefs.has(n.id),
        },
      })),
    [doc.nodes, doc.entry_node_id, layout, selNodeId, badRefs],
  )
  const rfEdges = useMemo(
    () =>
      doc.edges.map((e) => {
        const label = [e.kind, e.intent || e.option || e.matrix_intent].filter(Boolean).join(' · ')
        // Repair/retry/back edges are the noisy ones; dash them so the spine stays readable.
        const secondary = ['retry', 'repair', 'back', 'global'].includes(e.kind)
        return {
          id: e.id,
          source: e.from,
          target: e.to,
          label,
          selected: e.id === selEdgeId,
          animated: e.kind === 'global',
          style: {
            stroke: badRefs.has(e.id) ? 'var(--err)' : secondary ? 'var(--dim)' : 'var(--border-2)',
            strokeDasharray: secondary ? '4 3' : undefined,
            strokeWidth: e.id === selEdgeId ? 2.5 : 1.5,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: 'var(--border-2)',
          },
        }
      }),
    [doc.edges, selEdgeId, badRefs],
  )
  const onNodesChange = useCallback((changes) => {
    for (const c of changes) {
      if (c.type === 'position' && c.position) {
        setLayout((l) => ({
          ...l,
          [c.id]: c.position,
        }))
      }
    }
  }, [])
  const onConnect = useCallback(
    (c) => {
      if (!c.source || !c.target) return
      let i = doc.edges.length + 1
      let id = `e_${c.source}_${c.target}`
      while (doc.edges.some((e) => e.id === id)) {
        id = `e_${c.source}_${c.target}_${i}`
        i++
      }
      setDoc((d) => ({
        ...d,
        edges: [
          ...d.edges,
          {
            id,
            from: c.source,
            to: c.target,
            kind: 'next',
          },
        ],
      }))
      setSelEdgeId(id)
      setSelNodeId(null)
    },
    [doc.edges, setDoc],
  )

  /* ------------------------------------------------------------- mutations */

  const addNode = (type) => {
    let i = doc.nodes.length + 1
    let id = `${type.toLowerCase()}_${i}`
    while (doc.nodes.some((n) => n.id === id)) {
      i++
      id = `${type.toLowerCase()}_${i}`
    }
    const node = {
      id,
      type,
    }
    setDoc((d) => ({
      ...d,
      nodes: [...d.nodes, node],
      // First Entry added also becomes the entry pointer — one less rule to trip over.
      entry_node_id: type === 'Entry' && !d.entry_node_id ? id : d.entry_node_id,
    }))
    // Drop it somewhere visible rather than at the origin.
    setLayout((l) => ({
      ...l,
      [id]: {
        x: 80 + (doc.nodes.length % 5) * 210,
        y: 420,
      },
    }))
    setSelNodeId(id)
    setSelEdgeId(null)
  }
  const deleteNode = (id) => {
    setDoc((d) => ({
      ...d,
      nodes: d.nodes.filter((n) => n.id !== id),
      edges: d.edges.filter((e) => e.from !== id && e.to !== id),
      entry_node_id: d.entry_node_id === id ? '' : d.entry_node_id,
    }))
    setSelNodeId(null)
  }
  const deleteEdge = (id) => {
    setDoc((d) => ({
      ...d,
      edges: d.edges.filter((e) => e.id !== id),
    }))
    setSelEdgeId(null)
  }
  const relayout = () => {
    const fresh = resolveLayout({
      ...doc,
      cx: undefined,
    })
    setLayout(fresh)
    setDirty(true)
    toast.ok('Re-laid out from the Entry node')
  }

  /* -------------------------------------------------------- save / publish */

  const docForWire = () => withLayout(doc, layoutRef.current)
  const saveDraft = async () => {
    setBusy(true)
    try {
      await api.putFlowDraft(flowId, docForWire())
      setDirty(false)
      toast.ok('Draft saved')
    } catch (e) {
      toast.fail(e, 'Save draft')
    } finally {
      setBusy(false)
    }
  }
  const publish = async () => {
    if (errors.length) {
      toast.push('err', `Fix ${errors.length} error(s) before publishing`)
      return
    }
    setBusy(true)
    try {
      const wire = docForWire()
      await api.putFlowDraft(flowId, wire)
      const got = await api.publishFlow(flowId, wire)
      setDirty(false)
      setPublishedVersion(got.version)
      setWarnings(got.warnings ?? [])
      toast.ok(
        `Published version ${got.version}` +
          (got.content_hash ? ` (${got.content_hash.slice(0, 12)})` : '') +
          (got.warnings?.length ? ` — ${got.warnings.length} locale warning(s)` : ''),
      )
    } catch (e) {
      toast.fail(e, 'Publish')
    } finally {
      setBusy(false)
    }
  }
  const loadVersion = async (v) => {
    try {
      const fv = await api.getFlowVersion(flowId, v)
      setDocState(fv.doc)
      setLayout(resolveLayout(fv.doc))
      setDirty(true)
      toast.ok(`Loaded version ${v} into the builder — save as draft or publish to keep it`)
    } catch (e) {
      toast.fail(e, 'Load version')
    }
  }
  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText)
      setDocState(parsed)
      setLayout(resolveLayout(parsed))
      setDirty(true)
      setShowJson(false)
      toast.ok('Applied JSON')
    } catch (e) {
      toast.push('err', e.message)
    }
  }
  const selNode = doc.nodes.find((n) => n.id === selNodeId) ?? null
  const selEdge = doc.edges.find((e) => e.id === selEdgeId) ?? null
  const focusIssue = (i) => {
    if (!i.ref) return
    if (doc.nodes.some((n) => n.id === i.ref)) {
      setSelNodeId(i.ref)
      setSelEdgeId(null)
    } else if (doc.edges.some((e) => e.id === i.ref)) {
      setSelEdgeId(i.ref)
      setSelNodeId(null)
    }
  }
  return (
    <>
      <div
        className="topbar"
        style={{
          borderTop: '1px solid var(--border)',
        }}
      >
        <Link to="/flows" className="btn secondary sm">
          ← Flows
        </Link>
        <strong
          className="mono"
          style={{
            fontSize: 13,
          }}
        >
          {flowId}
        </strong>
        {publishedVersion != null ? (
          <span className="badge ok">published v{publishedVersion}</span>
        ) : (
          <span className="badge warn">never published</span>
        )}
        {dirty && <span className="badge warn">unsaved</span>}
        {errors.length > 0 ? (
          <span className="badge err">
            {errors.length} error{errors.length > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="badge ok">valid</span>
        )}

        <div className="spacer" />

        {publishedVersion != null && (
          <button className="btn secondary sm" onClick={() => void loadVersion(publishedVersion)}>
            Load v{publishedVersion}
          </button>
        )}
        <button className="btn secondary sm" onClick={() => setShowJson((v) => !v)}>
          {showJson ? 'Canvas' : 'JSON'}
        </button>
        <button className="btn secondary sm" onClick={relayout}>
          Auto-layout
        </button>
        <button className="btn secondary sm" onClick={saveDraft} disabled={busy}>
          Save draft
        </button>
        <button className="btn sm" onClick={publish} disabled={busy || errors.length > 0}>
          {busy ? 'Working…' : 'Publish'}
        </button>
      </div>

      {showJson ? (
        <div className="content wide">
          <div className="card">
            <h2>Raw document</h2>
            <p className="hint">
              The full <code>coral.flow.v1</code> document. Canvas positions live under
              <code> cx.layout</code> — a field the Go struct declares but the runtime never reads,
              so it round-trips safely through draft and publish.
            </p>
            <textarea
              rows={30}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
            />
            <div className="actions">
              <button className="btn" onClick={applyJson}>
                Apply
              </button>
              <button
                className="btn secondary"
                onClick={() => setJsonText(JSON.stringify(doc, null, 2))}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="builder">
          <div className="canvas-wrap">
            <div className="canvas-toolbar">
              {(catalog?.node_types ?? []).map((t) => (
                <button
                  key={t}
                  className="btn secondary sm"
                  onClick={() => addNode(t)}
                  style={{
                    borderLeft: `3px solid ${NODE_COLOR[t] ?? 'var(--border-2)'}`,
                  }}
                  title={`Add a ${t} node`}
                >
                  {t}
                </button>
              ))}
            </div>

            {loaded && (
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onConnect={onConnect}
                onNodeClick={(_, n) => {
                  setSelNodeId(n.id)
                  setSelEdgeId(null)
                }}
                onEdgeClick={(_, e) => {
                  setSelEdgeId(e.id)
                  setSelNodeId(null)
                }}
                onPaneClick={() => {
                  setSelNodeId(null)
                  setSelEdgeId(null)
                }}
                fitView
                fitViewOptions={{
                  padding: 0.18,
                  maxZoom: 1,
                }}
                minZoom={0.15}
                proOptions={{
                  hideAttribution: true,
                }}
                defaultEdgeOptions={{
                  type: 'smoothstep',
                }}
              >
                <Background color="#2b3543" gap={18} />
                <Controls showInteractive={false} />
              </ReactFlow>
            )}
          </div>

          <div className="inspector">
            {(errors.length > 0 || issues.length > 0) && (
              <div
                style={{
                  marginBottom: '1rem',
                }}
              >
                <div className="label">Validation ({issues.length})</div>
                <div className="issues">
                  {issues.map((i, n) => (
                    <div key={n} className={`issue ${i.level}`} onClick={() => focusIssue(i)}>
                      <span>{i.level === 'error' ? '✕' : '!'}</span>
                      <span>{i.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!issues.length && (
              <div
                className="probe ok"
                style={{
                  marginTop: 0,
                }}
              >
                Graph is valid.
              </div>
            )}

            {!!gaps.length && (
              <details className="section">
                <summary>
                  Locale coverage
                  <span className="tag">{gaps.length} prompt(s) incomplete</span>
                </summary>
                <div className="body">
                  <p className="desc">
                    Non-blocking. Publish succeeds, and the server returns the same list.
                  </p>
                  {gaps.map((g) => (
                    <div
                      key={g.prompt_ref}
                      style={{
                        fontSize: 12,
                        marginBottom: '0.3rem',
                      }}
                    >
                      <code>{g.prompt_ref}</code>
                      <div
                        style={{
                          color: 'var(--dim)',
                        }}
                      >
                        missing: {g.missing.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {!!warnings.length && (
              <div className="probe warn">
                Server warnings from the last publish:
                {warnings.map((w, i) => (
                  <div key={i}>
                    • {w.prompt_ref ?? w.code}: {w.missing_locales?.join(', ') ?? w.message}
                  </div>
                ))}
              </div>
            )}

            <hr
              style={{
                border: 'none',
                borderTop: '1px solid var(--border)',
                margin: '1rem 0',
              }}
            />

            <Inspector
              doc={doc}
              setDoc={setDoc}
              selNode={selNode}
              selEdge={selEdge}
              onDeleteNode={deleteNode}
              onDeleteEdge={deleteEdge}
              bindingIds={bindingIds}
            />
          </div>
        </div>
      )}
    </>
  )
}
export default function FlowBuilder() {
  return (
    <ReactFlowProvider>
      <BuilderInner />
    </ReactFlowProvider>
  )
}
