import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCatalog } from '../api/catalog'
import { api } from '../api/client'
import { Modal, useToast } from '../components/ui'
import { setDirtyGuard } from '../lib/dirtyGuard'
import { localeGaps, validateFlow } from '../lib/flowValidate'
import { SECONDARY_KINDS, defaultEdgeKind, edgeLabel, nextEdgeId } from '../lib/flowGraph'
import {
  autoLayout,
  remapLocalLayout,
  resolveLayout,
  withoutCx,
  writeLocalLayout,
} from '../lib/layout'
import FlowEdge from './builder/FlowEdge'
import GraphNode, { NODE_COLOR } from './builder/GraphNode'
import Inspector from './builder/Inspector'
import { PanelSection, SectionProvider, useSectionStore } from './builder/PanelSection'
import {
  IconAlert,
  IconCheck,
  IconFold,
  IconGear,
  IconLinesAll,
  IconLinesClean,
  IconLink,
  IconMessage,
  IconPanelClose,
  IconPanelOpen,
  IconSliders,
  IconUnfold,
} from './builder/icons'
import { FLOW_SCHEMA_ID } from '../api/types'
const nodeTypes = {
  graph: GraphNode,
}
const edgeTypes = {
  flow: FlowEdge,
}

/** Hover help in the palette — what each node type is for, in one line. */
const NODE_HELP = {
  Entry: 'Where the call starts. Exactly one per flow.',
  Speak: 'The bot says something. Needs a prompt.',
  ListenChoice: 'Wait for the caller and pick an intent edge.',
  ListenLanguage: 'Ask which language, and lock it for the call.',
  ListenSlot: 'Collect a value from the caller.',
  Decide: 'Branch without speaking.',
  Inform: 'Answer from a knowledge binding (FAQ).',
  Tool: 'Transfer or hang up. Irreversible once armed.',
  End: 'Terminal node.',
}

// Canvas geometry of a node card (see .gnode), used to place new nodes clear of others.
const NODE_W = 200
const NODE_H = 60
const ROW_GAP = 150
const DND_TYPE = 'application/x-coral-node'

// Undo history. Edits closer together than COALESCE_MS fold into one step, so
// undo takes back a typed sentence rather than one character — but never a
// burst longer than BURST_MS, or a long editing session becomes one step.
const HISTORY_MAX = 50
const COALESCE_MS = 600
const BURST_MS = 3000

// Remembered per browser: whether the right panel is open, and how lines draw.
const PANEL_KEY = 'orch_builder_panel'
const PANEL_W_KEY = 'orch_builder_panel_width'
const LINES_KEY = 'orch_builder_lines'
const PANEL_W = { min: 300, max: 680, fallback: 360 }
const clampPanel = (w) =>
  Math.round(Math.min(PANEL_W.max, window.innerWidth * 0.55, Math.max(PANEL_W.min, w)))
const readPref = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
const writePref = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode — the choice just will not persist */
  }
}
// Every collapsible section in the panel, for "collapse all".
const SECTION_IDS = [
  'validation',
  'locales',
  'connections',
  'properties',
  'prompt',
  'repair',
  'interrupt',
  'listen-policy',
  'intents',
  'slot',
  'decide',
  'edge',
  'flow-settings',
  'globals',
  'flow-policy',
  'matrix',
  'unused-prompts',
]
const SECTION_DEFAULT_CLOSED = ['locales']

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
  const { screenToFlowPosition, fitView, getZoom, setCenter } = useReactFlow()
  const [doc, setDocState] = useState(emptyDoc())
  const [loaded, setLoaded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selNodeId, setSelNodeId] = useState(null)
  const [selEdgeId, setSelEdgeId] = useState(null)
  // The edge just drawn, so the inspector can put the cursor in its intent box.
  const [freshEdgeId, setFreshEdgeId] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [bindingIds, setBindingIds] = useState([])
  const [publishedVersion, setPublishedVersion] = useState(null)
  const [showJson, setShowJson] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [serverIssues, setServerIssues] = useState([])
  const [versions, setVersions] = useState([])
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [inspectVer, setInspectVer] = useState(null)
  const [catalogProfileId, setCatalogProfileId] = useState('')
  const [profileIds, setProfileIds] = useState([])
  const [intentCatalog, setIntentCatalog] = useState([])
  const wrapRef = useRef(null)
  const panelRef = useRef(null)

  // Hover only ever lights edges up; it never changes the selection. One comes
  // from the canvas (a node under the cursor), one from the panel (a row in
  // Connections), so you can see which line a row means before touching it.
  const [hoverNodeId, setHoverNodeId] = useState(null)
  const [hoverEdgeId, setHoverEdgeId] = useState(null)
  // "clean": lines stay faint until a node is hovered or selected, and only
  // that node's connections are drawn in full. "detailed": everything, always.
  const [lineMode, setLineModeState] = useState(() =>
    readPref(LINES_KEY, 'clean') === 'detailed' ? 'detailed' : 'clean',
  )
  const setLineMode = (mode) => {
    setLineModeState(mode)
    writePref(LINES_KEY, mode)
  }
  const [panelOpen, setPanelOpenState] = useState(() => readPref(PANEL_KEY, 'open') !== 'closed')
  const panelOpenRef = useRef(panelOpen)
  panelOpenRef.current = panelOpen
  const setPanelOpen = useCallback((open) => {
    setPanelOpenState(open)
    writePref(PANEL_KEY, open ? 'open' : 'closed')
  }, [])
  const sections = useSectionStore()

  // Panel width is draggable from its left edge (and arrow keys on the handle);
  // a 19-connection node reads far better at 460px than at 360px.
  const [panelWidth, setPanelWidth] = useState(() => {
    const stored = Number(readPref(PANEL_W_KEY, ''))
    return stored ? clampPanel(stored) : PANEL_W.fallback
  })
  const [resizing, setResizing] = useState(false)
  const startResize = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startW = panelWidth
    let last = startW
    setResizing(true)
    const move = (ev) => {
      last = clampPanel(startW + (startX - ev.clientX))
      setPanelWidth(last)
    }
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      setResizing(false)
      writePref(PANEL_W_KEY, String(last))
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }
  const nudgePanel = (delta) => {
    const next = clampPanel(panelWidth + delta)
    setPanelWidth(next)
    writePref(PANEL_W_KEY, String(next))
  }

  /** Node positions live outside the document until save, so dragging is cheap. */
  const [layout, setLayout] = useState({})
  // React Flow measures each node and reports it through onNodesChange. Nodes
  // handed back without `measured` count as uninitialised — dragging warns on
  // every frame, and the minimap and fit-view have no size to work with.
  const [measured, setMeasured] = useState({})
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const docRef = useRef(doc)
  docRef.current = doc
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  /* --------------------------------------------------------------- history */

  // Kept in a ref and snapshotting doc *and* layout together. The previous
  // version queued history updates from inside a state updater, which React's
  // StrictMode runs twice — every edit was recorded twice, so every other
  // Ctrl+Z did nothing. Positions were not recorded at all, so undoing a
  // rename or a delete put nodes back at the canvas origin.
  const history = useRef({ past: [], future: [], at: 0, burst: 0 })
  const [, setHistoryTick] = useState(0)

  const record = useCallback((coalesce) => {
    const h = history.current
    const now = Date.now()
    if (coalesce && h.past.length && now - h.at < COALESCE_MS && now - h.burst < BURST_MS) {
      h.at = now
      return
    }
    h.past = [
      ...h.past.slice(-(HISTORY_MAX - 1)),
      { doc: docRef.current, layout: layoutRef.current },
    ]
    h.future = []
    h.at = now
    h.burst = now
    setHistoryTick((t) => t + 1)
  }, [])

  const setDoc = useCallback(
    (fn) => {
      record(true)
      setDocState(fn)
      setDirty(true)
    },
    [record],
  )

  const travel = useCallback((back) => {
    const h = history.current
    const snap = back ? h.past.at(-1) : h.future[0]
    if (!snap) return
    const here = { doc: docRef.current, layout: layoutRef.current }
    if (back) {
      h.past = h.past.slice(0, -1)
      h.future = [here, ...h.future].slice(0, HISTORY_MAX)
    } else {
      h.future = h.future.slice(1)
      h.past = [...h.past, here].slice(-HISTORY_MAX)
    }
    h.at = 0
    setDocState(snap.doc)
    setLayout(snap.layout)
    setDirty(true)
    setHistoryTick((t) => t + 1)
  }, [])
  const undo = useCallback(() => travel(true), [travel])
  const redo = useCallback(() => travel(false), [travel])

  /* ------------------------------------------------------------------ load */

  const load = useCallback(async () => {
    try {
      const [draft, binds, meta, pins, profiles, vers] = await Promise.all([
        api.getFlowDraft(flowId).catch((e) => {
          if (e.status === 404) return null
          throw e
        }),
        api.listBindings().catch(() => ({
          bindings: [],
        })),
        api.getFlow(flowId).catch(() => null),
        api.getAnswerPins().catch(() => ({ pins: [] })),
        api.listProfiles().catch(() => ({ profiles: [] })),
        api.listFlowVersions(flowId).catch(() => ({ versions: [] })),
      ])
      const d = draft?.doc ?? emptyDoc()
      setLayout(resolveLayout(d, flowId))
      setDocState(withoutCx(d))
      setBindingIds((binds.bindings ?? []).map((b) => b.id))
      // An unpublished flow reports current_version 0, not null.
      setPublishedVersion(meta?.current_version > 0 ? meta.current_version : null)
      setVersions(vers.versions ?? [])
      const ids = (profiles.profiles ?? []).map((p) => p.id)
      setProfileIds(ids)
      const pinned = (pins.pins ?? []).find((p) => p.flow_id === flowId)
      setCatalogProfileId(pinned?.profile_id || ids[0] || '')
      setServerIssues([])
      history.current = { past: [], future: [], at: 0, burst: 0 }
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
    setDirtyGuard(dirty, 'flow')
    return () => setDirtyGuard(false)
  }, [dirty])
  useEffect(() => {
    if (showJson) setJsonText(JSON.stringify(doc, null, 2))
  }, [showJson, doc])
  useEffect(() => {
    if (!catalogProfileId) {
      setIntentCatalog([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const draft = await api.getProfileDraft(catalogProfileId)
        const got = draft.document ?? draft.doc
        if (!cancelled && got) {
          setIntentCatalog(got.intent_catalog ?? [])
          return
        }
      } catch {
        /* no draft — try latest published */
      }
      try {
        const v = await api.getProfileVersion(catalogProfileId, 'latest')
        const got = v.document ?? v.doc
        if (!cancelled) setIntentCatalog(got?.intent_catalog ?? [])
      } catch {
        if (!cancelled) setIntentCatalog([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [catalogProfileId])

  // Leaving with unsaved work: a 30-node flow is an hour of clicking. The app
  // uses a plain BrowserRouter (no data router, so no useBlocker), so in-app
  // links are intercepted in the capture phase, before React Router sees them.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    const onClick = (e) => {
      if (!dirtyRef.current || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null
      if (!a || a.target === '_blank') return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      if (!window.confirm('This flow has unsaved changes. Leave without saving?')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [])

  /* ------------------------------------------------------------ validation */

  const issues = useMemo(() => validateFlow(doc, catalog ?? undefined), [doc, catalog])
  const errors = issues.filter((i) => i.level === 'error')
  const allowedIntentIds = useMemo(
    () =>
      (intentCatalog ?? [])
        .filter((row) => (row.scope ?? '') !== 'global' && (row.id ?? '').trim())
        .map((row) => row.id.trim()),
    [intentCatalog],
  )
  const badRefs = useMemo(() => new Set(errors.map((i) => i.ref).filter(Boolean)), [errors])
  const gaps = useMemo(() => localeGaps(doc, catalog?.tts_locales_v1 ?? []), [doc, catalog])

  /* ---------------------------------------------------------- canvas model */

  const selEdgeFrom = doc.edges.find((e) => e.id === selEdgeId)?.from ?? null

  const rfNodes = useMemo(
    () =>
      doc.nodes.map((n) => ({
        id: n.id,
        type: 'graph',
        position: layout[n.id] ?? {
          x: 0,
          y: 0,
        },
        measured: measured[n.id],
        selected: n.id === selNodeId,
        data: {
          node: n,
          isEntry: doc.entry_node_id === n.id,
          invalid: badRefs.has(n.id),
        },
      })),
    [doc.nodes, doc.entry_node_id, layout, measured, selNodeId, badRefs],
  )

  const selectEdge = useCallback((id) => {
    setSelEdgeId(id)
    setSelNodeId(null)
    setFreshEdgeId(null)
  }, [])

  const rfEdges = useMemo(() => {
    // Parallel edges (same from → to) fan apart; see FlowEdge.
    const pairs = new Map()
    const outCount = new Map()
    const inCount = new Map()
    for (const e of doc.edges) {
      const key = JSON.stringify([e.from, e.to])
      if (!pairs.has(key)) pairs.set(key, [])
      pairs.get(key).push(e.id)
      outCount.set(e.from, (outCount.get(e.from) ?? 0) + 1)
      inCount.set(e.to, (inCount.get(e.to) ?? 0) + 1)
    }
    const clean = lineMode === 'clean'
    // Whose wiring to bring forward: the selected node, or — in clean mode with
    // nothing selected — the node under the cursor, as a preview.
    const focus = selNodeId ?? (clean && !selEdgeId ? hoverNodeId : null)
    const spotlight = !!focus || !!selEdgeId
    return doc.edges.map((e) => {
      const { text, missing } = edgeLabel(e)
      const secondary = SECONDARY_KINDS.includes(e.kind)
      const selected = e.id === selEdgeId
      const hot = e.id === hoverEdgeId
      const out = !!focus && e.from === focus
      const into = !!focus && e.to === focus
      const lit = selected || hot || out || into
      // Tiers: lit edges always draw in full. With something in the spotlight
      // the rest recede (detailed) or all but vanish (clean); with nothing in
      // it, clean mode keeps every line quiet so the canvas reads as structure.
      const tier = lit ? 'lit' : spotlight ? (clean ? 'faint' : 'dim') : clean ? 'quiet' : 'plain'
      const group = pairs.get(JSON.stringify([e.from, e.to]))
      const n = group.length
      const idx = group.indexOf(e.id)
      let labelT = 0.5
      // Parallel edges stack their labels one above the other at the midpoint;
      // spreading along the curve alone still overlapped on short edges.
      const stack = n > 1 ? (idx - (n - 1) / 2) * 20 : 0
      if (n === 1) {
        // Put the label towards the less crowded end.
        const fanOut = outCount.get(e.from) ?? 0
        const fanIn = inCount.get(e.to) ?? 0
        if (fanOut > fanIn) labelT = 0.72
        else if (fanIn > fanOut) labelT = 0.28
      }
      // Out of the focused node is blue, into it green — direction at a glance.
      const color = badRefs.has(e.id)
        ? 'var(--err)'
        : selected || hot || out
          ? 'var(--accent)'
          : into
            ? 'var(--ok)'
            : secondary
              ? 'var(--dim)'
              : 'var(--border-3)'
      return {
        id: e.id,
        type: 'flow',
        source: e.from,
        target: e.to,
        label: text,
        selected,
        className: `tier-${tier}${hot ? ' hot' : ''}`,
        zIndex: lit ? 1 : 0,
        style: {
          stroke: color,
          strokeDasharray: secondary ? '5 4' : undefined,
          strokeWidth: selected || hot ? 2.75 : lit ? 2 : 1.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 18,
          height: 18,
        },
        data: {
          bow: (idx - (n - 1) / 2) * 44,
          labelT,
          stack,
          missing,
          secondary,
          lit,
          // Lit edges always label; plain ones (detailed mode) label when zoomed in.
          labels: lit ? 'always' : tier === 'plain' ? 'zoomed' : 'never',
          onSelect: selectEdge,
          title: `${e.kind} edge ${e.from} → ${e.to} — click to edit`,
        },
      }
    })
  }, [doc.edges, selEdgeId, selNodeId, hoverNodeId, hoverEdgeId, lineMode, badRefs, selectEdge])

  const onNodesChange = useCallback((changes) => {
    const moved = {}
    const sized = {}
    for (const c of changes) {
      if (c.type === 'position' && c.position) moved[c.id] = c.position
      else if (c.type === 'dimensions' && c.dimensions) sized[c.id] = c.dimensions
    }
    if (Object.keys(moved).length) {
      setLayout((l) => {
        const next = { ...l, ...moved }
        writeLocalLayout(
          flowId,
          next,
          docRef.current.nodes.map((n) => n.id),
        )
        return next
      })
    }
    if (Object.keys(sized).length) {
      setMeasured((m) => {
        const same = Object.entries(sized).every(
          ([id, d]) => m[id]?.width === d.width && m[id]?.height === d.height,
        )
        return same ? m : { ...m, ...sized }
      })
    }
  }, [flowId])

  const dragFrom = useRef(null)
  const onNodeDragStart = useCallback(
    (_, n) => {
      record(false)
      dragFrom.current = { ...n.position }
    },
    [record],
  )
  const onNodeDragStop = useCallback((_, n) => {
    const p = dragFrom.current
    // Moving a node is an edit: it changes local layout, and was being lost on
    // navigation because nothing marked the flow unsaved.
    if (
      p &&
      (Math.round(p.x) !== Math.round(n.position.x) || Math.round(p.y) !== Math.round(n.position.y))
    )
      setDirty(true)
    dragFrom.current = null
  }, [])

  /**
   * Adds an edge and returns its id. From the canvas the new edge is selected
   * so its intent can be typed; from the Connections panel (`select: false`)
   * the node stays selected and the panel opens the row instead.
   */
  const createEdge = useCallback(
    (from, to, kindOverride, { select = true } = {}) => {
      const d = docRef.current
      if (!d.nodes.some((n) => n.id === from) || !d.nodes.some((n) => n.id === to)) return null
      const id = nextEdgeId(d.edges, from, to)
      const kind = kindOverride || defaultEdgeKind(d, from, catalog?.edge_kinds ?? [])
      setDoc((cur) => ({
        ...cur,
        edges: [
          ...cur.edges,
          {
            id,
            from,
            to,
            kind,
          },
        ],
      }))
      if (select) {
        setSelEdgeId(id)
        setSelNodeId(null)
        setFreshEdgeId(kind === 'intent' || kind === 'option' ? id : null)
      }
      return id
    },
    [catalog, setDoc],
  )

  /** Select a node and bring it into view — used by every "go to node" link in the panel. */
  const focusNode = useCallback(
    (id) => {
      setSelNodeId(id)
      setSelEdgeId(null)
      setHoverEdgeId(null)
      const p = layoutRef.current[id]
      if (p)
        void setCenter(p.x + NODE_W / 2, p.y + NODE_H / 2, {
          zoom: Math.max(getZoom(), 0.7),
          duration: 300,
        })
    },
    [setCenter, getZoom],
  )

  /** From the collapsed rail: open the panel on a section and scroll to it. */
  const openSection = (id) => {
    const wasOpen = panelOpenRef.current
    setPanelOpen(true)
    sections.setOpen(id, true)
    window.setTimeout(
      () =>
        panelRef.current
          ?.querySelector(`[data-section="${id}"]`)
          ?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
      wasOpen ? 0 : 240,
    )
  }

  const onConnect = useCallback(
    (c) => {
      if (c.source && c.target) createEdge(c.source, c.target)
    },
    [createEdge],
  )

  /* ------------------------------------------------------------- mutations */

  /** Visible canvas area in flow coordinates. */
  const visibleRect = () => {
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return null
    const a = screenToFlowPosition({ x: r.left, y: r.top })
    const b = screenToFlowPosition({ x: r.right, y: r.bottom })
    return { x0: a.x, y0: a.y, x1: b.x, y1: b.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }
  }

  /** First spot at or after `want`, walking by `stride`, that no live node covers. */
  const freeSpot = (want, stride) => {
    const live = docRef.current.nodes.map((n) => layoutRef.current[n.id]).filter(Boolean)
    let p = { ...want }
    for (let i = 0; i < 60; i++) {
      const hit = live.some(
        (q) => Math.abs(q.x - p.x) < NODE_W + 20 && Math.abs(q.y - p.y) < NODE_H + 30,
      )
      if (!hit) break
      p = { x: p.x + stride.x, y: p.y + stride.y }
    }
    return p
  }

  /**
   * Adds a node. Dropped from the palette it lands under the cursor; clicked,
   * it goes below the selected node (the usual next step when building top
   * down) or in the middle of the view — never at a fixed canvas coordinate,
   * which used to put new nodes behind the inspector or off screen entirely.
   */
  const addNode = (type, dropAt) => {
    const d = docRef.current
    let i = d.nodes.length + 1
    let id = `${type.toLowerCase()}_${i}`
    while (d.nodes.some((n) => n.id === id)) {
      i++
      id = `${type.toLowerCase()}_${i}`
    }
    const anchor = selNodeId ? layoutRef.current[selNodeId] : null
    const view = visibleRect()
    let pos
    if (dropAt) {
      pos = freeSpot(
        { x: dropAt.x - NODE_W / 2, y: dropAt.y - NODE_H / 2 },
        { x: 0, y: NODE_H + 30 },
      )
    } else if (anchor) {
      pos = freeSpot({ x: anchor.x, y: anchor.y + ROW_GAP }, { x: NODE_W + 40, y: 0 })
    } else {
      pos = freeSpot(
        { x: (view?.cx ?? 300) - NODE_W / 2, y: (view?.cy ?? 300) - NODE_H / 2 },
        { x: NODE_W + 40, y: 0 },
      )
    }
    record(false)
    setDocState((cur) => ({
      ...cur,
      nodes: [...cur.nodes, { id, type }],
      // First Entry added also becomes the entry pointer — one less rule to trip over.
      entry_node_id: type === 'Entry' && !cur.entry_node_id ? id : cur.entry_node_id,
    }))
    setDirty(true)
    setLayout((l) => {
      const next = { ...l, [id]: pos }
      writeLocalLayout(flowId, next, [...docRef.current.nodes.map((n) => n.id), id])
      return next
    })
    setSelNodeId(id)
    setSelEdgeId(null)
    // Bring it into view if it landed outside.
    if (
      view &&
      (pos.x < view.x0 || pos.x + NODE_W > view.x1 || pos.y < view.y0 || pos.y + NODE_H > view.y1)
    )
      void setCenter(pos.x + NODE_W / 2, pos.y + NODE_H / 2, { zoom: getZoom(), duration: 250 })
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
    if (selEdgeId === id) setSelEdgeId(null)
    setHoverEdgeId(null)
  }
  /** A rename changes the node's key, so its canvas position has to move with it. */
  const onNodeRenamed = (oldId, newId) => {
    setLayout((l) => {
      if (!l[oldId]) return l
      const { [oldId]: p, ...rest } = l
      return { ...rest, [newId]: p }
    })
    remapLocalLayout(flowId, oldId, newId)
    setMeasured((m) => {
      if (!m[oldId]) return m
      const { [oldId]: s, ...rest } = m
      return { ...rest, [newId]: s }
    })
    setSelNodeId(newId)
  }
  const relayout = () => {
    record(false)
    const fresh = autoLayout(withoutCx(doc))
    setLayout(fresh)
    writeLocalLayout(
      flowId,
      fresh,
      doc.nodes.map((n) => n.id),
    )
    setDirty(true)
    window.requestAnimationFrame(() => void fitView({ padding: 0.2, maxZoom: 1, duration: 250 }))
    toast.ok('Re-laid out from the Entry node')
  }

  /* -------------------------------------------------------- save / publish */

  const persistLayout = (layout) =>
    writeLocalLayout(
      flowId,
      layout,
      (docRef.current.nodes ?? []).map((n) => n.id),
    )

  const docForWire = () => withoutCx(doc)
  const saveDraft = async () => {
    setBusy(true)
    try {
      persistLayout(layoutRef.current)
      await api.putFlowDraft(flowId, docForWire())
      setDirty(false)
      toast.ok('Draft saved')
    } catch (e) {
      toast.fail(e, 'Save draft')
    } finally {
      setBusy(false)
    }
  }
  const checkServer = async () => {
    setBusy(true)
    try {
      await api.validateFlow(flowId, docForWire())
      setServerIssues([])
      toast.ok('Server validate: ok')
    } catch (e) {
      setServerIssues([
        {
          level: 'error',
          message: e.detailText ? `${e.message} (${e.detailText})` : e.message || 'Server validate failed',
        },
      ])
      toast.fail(e, 'Server validate')
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
      persistLayout(layoutRef.current)
      const wire = docForWire()
      await api.validateFlow(flowId, wire)
      setServerIssues([])
      await api.putFlowDraft(flowId, wire)
      const got = await api.publishFlow(flowId, wire)
      setDirty(false)
      setPublishedVersion(got.version)
      setWarnings(got.warnings ?? [])
      const listed = await api.listFlowVersions(flowId).catch(() => ({ versions: [] }))
      setVersions(listed.versions ?? [])
      toast.ok(
        `Published version ${got.version}` +
          (got.content_hash ? ` (${got.content_hash.slice(0, 12)})` : '') +
          (got.warnings?.length ? ` — ${got.warnings.length} locale warning(s)` : ''),
      )
    } catch (e) {
      if (e.code === 'flow_invalid' || e.status === 422) {
        setServerIssues([
          {
            level: 'error',
            message: e.detailText ? `${e.message} (${e.detailText})` : e.message,
          },
        ])
      }
      toast.fail(e, 'Publish')
    } finally {
      setBusy(false)
    }
  }
  const inspectVersion = async (v) => {
    try {
      const fv = await api.getFlowVersion(flowId, v)
      setInspectVer({
        version: fv.version ?? v,
        doc: withoutCx(fv.doc ?? {}),
        published_at: fv.published_at,
        content_hash: fv.content_hash,
      })
      setVersionsOpen(true)
    } catch (e) {
      toast.fail(e, 'Inspect version')
    }
  }
  const replaceDoc = (next) => {
    record(false)
    setLayout(resolveLayout(next, flowId))
    setDocState(withoutCx(next))
    setSelNodeId(null)
    setSelEdgeId(null)
    setDirty(true)
  }
  const loadVersion = async (v) => {
    if (dirtyRef.current && !window.confirm(`Replace your unsaved changes with version ${v}?`))
      return
    try {
      const fv = await api.getFlowVersion(flowId, v)
      replaceDoc(fv.doc)
      toast.ok(`Loaded version ${v} into the builder — save as draft or publish to keep it`)
    } catch (e) {
      toast.fail(e, 'Load version')
    }
  }
  const applyJson = () => {
    try {
      replaceDoc(JSON.parse(jsonText))
      setShowJson(false)
      toast.ok('Applied JSON')
    } catch (e) {
      toast.push('err', e.message)
    }
  }
  // Keyboard control. Everything a mouse can do on the canvas should have a key.
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey
      // Ctrl+Alt+B hides the right panel, as Ctrl+B does the left sidebar.
      // e.code, because Option+B on a Mac types "∫".
      if (mod && e.altKey && e.code === 'KeyB') {
        e.preventDefault()
        setPanelOpen(!panelOpenRef.current)
        return
      }
      // Save works from anywhere, including mid-sentence in a prompt.
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!busy) void saveDraft()
        return
      }
      const t = e.target
      const inField =
        t instanceof HTMLElement &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      if (inField) {
        // Esc leaves the field, so the next Esc or Del acts on the canvas again.
        // (A focused dropdown used to pass Backspace through and delete the edge.)
        if (e.key === 'Escape' && t.closest('.inspector')) t.blur()
        return
      }

      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (
        mod &&
        (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault()
        redo()
      } else if (e.key === 'Escape') {
        setSelNodeId(null)
        setSelEdgeId(null)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selNodeId) {
          e.preventDefault()
          deleteNode(selNodeId)
        } else if (selEdgeId) {
          e.preventDefault()
          deleteEdge(selEdgeId)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const selNode = doc.nodes.find((n) => n.id === selNodeId) ?? null
  const selEdge = doc.edges.find((e) => e.id === selEdgeId) ?? null
  const focusIssue = (i) => {
    if (!i.ref) return
    if (doc.nodes.some((n) => n.id === i.ref)) {
      setSelNodeId(i.ref)
      setSelEdgeId(null)
      void fitView({ nodes: [{ id: i.ref }], maxZoom: 1, duration: 300 })
    } else if (doc.edges.some((e) => e.id === i.ref)) {
      selectEdge(i.ref)
    }
  }
  // Shift+click connects from the selected node — or from the selected edge's
  // source, so after wiring hub → A you can Shift+click B, C, D in a row.
  const connectFrom = selNodeId ?? selEdgeFrom
  const h = history.current
  const warningCount = issues.length - errors.length
  const anySectionOpen = SECTION_IDS.some((id) =>
    sections.isOpen(id, !SECTION_DEFAULT_CLOSED.includes(id)),
  )
  const createPanelEdge = (from, to, kind) => createEdge(from, to, kind, { select: false })
  return (
    <>
      <div
        className="topbar"
        style={{
          borderTop: '1px solid var(--border)',
        }}
      >
        <Link to="/CC/admin/flows" className="btn secondary sm">
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
        <button
          className="btn secondary sm"
          onClick={() => setVersionsOpen(true)}
          disabled={!versions.length && publishedVersion == null}
        >
          Versions{versions.length ? ` (${versions.length})` : ''}
        </button>
        <button className="btn secondary sm" onClick={() => void checkServer()} disabled={busy}>
          Check
        </button>
        <button className="btn secondary sm" onClick={() => setShowJson((v) => !v)}>
          {showJson ? 'Canvas' : 'JSON'}
        </button>
        <button
          className="btn ghost sm"
          onClick={undo}
          disabled={!h.past.length}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          ↶
        </button>
        <button
          className="btn ghost sm"
          onClick={redo}
          disabled={!h.future.length}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          ↷
        </button>
        <button
          className="btn secondary sm"
          onClick={relayout}
          title="Re-arrange from the Entry node"
        >
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
              The full <code>coral.flow.v1</code> document. Canvas positions are not part of the
              flow — they stay in this browser only. The kernel rejects a non-empty <code>cx</code>;
              Save and Publish strip it even if it is pasted here.
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
        <div
          className={`builder ${panelOpen ? '' : 'panel-collapsed'} ${resizing ? 'resizing' : ''}`}
          style={{ '--panel-w': `${panelWidth}px` }}
        >
          <div className={`canvas-wrap lines-${lineMode}`} ref={wrapRef}>
            <div className="canvas-tools" role="group" aria-label="How connection lines are drawn">
              <button
                type="button"
                className={`seg ${lineMode === 'clean' ? 'on' : ''}`}
                aria-pressed={lineMode === 'clean'}
                onClick={() => setLineMode('clean')}
                title="Clean — lines stay faint; hover or select a node to see its connections"
              >
                <IconLinesClean size={14} />
                Clean
              </button>
              <button
                type="button"
                className={`seg ${lineMode === 'detailed' ? 'on' : ''}`}
                aria-pressed={lineMode === 'detailed'}
                onClick={() => setLineMode('detailed')}
                title="Detailed — every line and label, always"
              >
                <IconLinesAll size={14} />
                Detailed
              </button>
            </div>

            <div className="palette" role="toolbar" aria-label="Add a node">
              <span className="palette-label">Add</span>
              {(catalog?.node_types ?? []).map((t) => (
                <button
                  key={t}
                  className="pal-btn"
                  onClick={() => addNode(t)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DND_TYPE, t)
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  title={`${NODE_HELP[t] ?? `Add a ${t} node`}\nClick to add below the selected node, or drag onto the canvas.`}
                  aria-label={`Add a ${t} node`}
                >
                  <span
                    className="pal-swatch"
                    style={{ background: NODE_COLOR[t] ?? 'var(--border-2)' }}
                  />
                  {t}
                </button>
              ))}
            </div>

            <div className="canvas-hint">
              <span>
                <span className="kbd">drag</span> a dot onto a node to connect
              </span>
              <span>
                <span className="kbd">Shift</span>+click another node to connect from the selected
                one
              </span>
              <span>
                <span className="kbd">Del</span> remove
              </span>
              <span>
                <span className="kbd">Esc</span> deselect
              </span>
              <span>
                <span className="kbd">Ctrl</span>+<span className="kbd">Z</span> undo
              </span>
              <span>
                <span className="kbd">Ctrl</span>+<span className="kbd">S</span> save
              </span>
            </div>

            {loaded && (
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onConnect={onConnect}
                onNodeDragStart={onNodeDragStart}
                onNodeDragStop={onNodeDragStop}
                onNodeMouseEnter={(_, n) => setHoverNodeId(n.id)}
                onNodeMouseLeave={() => setHoverNodeId(null)}
                onNodeClick={(e, n) => {
                  if (e.shiftKey && connectFrom && connectFrom !== n.id) {
                    createEdge(connectFrom, n.id)
                    return
                  }
                  setSelNodeId(n.id)
                  setSelEdgeId(null)
                }}
                onEdgeClick={(_, e) => selectEdge(e.id)}
                onPaneClick={() => {
                  setSelNodeId(null)
                  setSelEdgeId(null)
                }}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes(DND_TYPE)) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                }}
                onDrop={(e) => {
                  const type = e.dataTransfer.getData(DND_TYPE)
                  if (!type) return
                  e.preventDefault()
                  addNode(type, screenToFlowPosition({ x: e.clientX, y: e.clientY }))
                }}
                // Deletion goes through our own handler so it lands in undo history.
                deleteKeyCode={null}
                // Shift is ours (connect-from-selected), not a box selection.
                selectionKeyCode={null}
                connectionRadius={36}
                connectionLineStyle={{ stroke: 'var(--accent)', strokeWidth: 2 }}
                elevateEdgesOnSelect
                fitView
                fitViewOptions={{
                  // Extra room so the floating palette and hint bar never sit on the graph.
                  padding: 0.26,
                  maxZoom: 1,
                }}
                minZoom={0.15}
                proOptions={{
                  hideAttribution: true,
                }}
              >
                <Background color="#2b3543" gap={18} />
                <Controls showInteractive={false} />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={(n) => NODE_COLOR[n.data?.node?.type] ?? 'var(--border-3)'}
                  nodeBorderRadius={3}
                  maskColor="rgba(8, 11, 16, 0.72)"
                />
              </ReactFlow>
            )}
          </div>

          <aside
            className={`inspector ${panelOpen ? '' : 'collapsed'}`}
            aria-label="Properties panel"
          >
            {panelOpen && (
              <div
                className="insp-resize"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize panel"
                aria-valuemin={PANEL_W.min}
                aria-valuemax={PANEL_W.max}
                aria-valuenow={panelWidth}
                tabIndex={0}
                title="Drag to resize · double-click to reset"
                onPointerDown={startResize}
                onDoubleClick={() => nudgePanel(PANEL_W.fallback - panelWidth)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') nudgePanel(24)
                  else if (e.key === 'ArrowRight') nudgePanel(-24)
                }}
              />
            )}
            {panelOpen ? (
              <SectionProvider store={sections}>
                <div className="insp-head">
                  <span className="insp-head-title">
                    {selNode ? 'Node' : selEdge ? 'Connection' : 'Flow'}
                  </span>
                  <div className="insp-head-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => sections.setMany(SECTION_IDS, !anySectionOpen)}
                      title={anySectionOpen ? 'Collapse all sections' : 'Expand all sections'}
                      aria-label={anySectionOpen ? 'Collapse all sections' : 'Expand all sections'}
                    >
                      {anySectionOpen ? <IconFold size={14} /> : <IconUnfold size={14} />}
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setPanelOpen(false)}
                      title="Hide panel (Ctrl+Alt+B)"
                      aria-label="Hide panel"
                    >
                      <IconPanelClose size={15} />
                    </button>
                  </div>
                </div>

                <div className="insp-scroll" ref={panelRef}>
                  <PanelSection
                    id="validation"
                    title="Validation"
                    icon={errors.length ? <IconAlert size={14} /> : <IconCheck size={14} />}
                    tone={errors.length ? 'err' : issues.length ? 'warn' : 'ok'}
                    meta={
                      issues.length
                        ? [
                            errors.length &&
                              `${errors.length} error${errors.length > 1 ? 's' : ''}`,
                            warningCount && `${warningCount} warning${warningCount > 1 ? 's' : ''}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : 'valid'
                    }
                  >
                    {issues.length ? (
                      <div className="issues" style={{ marginTop: 0 }}>
                        {issues.map((i, n) => (
                          <button
                            key={n}
                            type="button"
                            className={`issue ${i.level}`}
                            onClick={() => focusIssue(i)}
                          >
                            <span aria-hidden="true">{i.level === 'error' ? '✕' : '!'}</span>
                            <span>{i.message}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="valid-note">
                        <IconCheck size={14} /> Graph is valid — ready to publish.
                      </p>
                    )}
                  </PanelSection>

                  {!!gaps.length && (
                    <PanelSection
                      id="locales"
                      title="Locale coverage"
                      icon={<IconMessage size={14} />}
                      meta={`${gaps.length} incomplete`}
                      defaultOpen={false}
                    >
                      <p className="desc" style={{ marginTop: 0 }}>
                        Non-blocking. Publish succeeds, and the server returns the same list.
                      </p>
                      {gaps.map((g) => (
                        <div className="gap-row" key={g.prompt_ref}>
                          <code>{g.prompt_ref}</code>
                          <span>missing: {g.missing.join(', ')}</span>
                        </div>
                      ))}
                    </PanelSection>
                  )}

                  {!!warnings.length && (
                    <div className="probe warn" style={{ marginTop: 0, marginBottom: '0.6rem' }}>
                      Server warnings from the last publish:
                      {warnings.map((w, i) => (
                        <div key={i}>
                          • {w.prompt_ref ?? w.code}: {w.missing_locales?.join(', ') ?? w.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {!!serverIssues.length && (
                    <div className="probe err" style={{ marginTop: 0, marginBottom: '0.6rem' }}>
                      Server validate:
                      {serverIssues.map((w, i) => (
                        <div key={i}>• {w.message}</div>
                      ))}
                    </div>
                  )}

                  <Inspector
                    doc={doc}
                    setDoc={setDoc}
                    selNode={selNode}
                    selEdge={selEdge}
                    onDeleteNode={deleteNode}
                    onDeleteEdge={deleteEdge}
                    // The canvas tracks selection and position by id, so a rename has to move both.
                    onNodeRenamed={onNodeRenamed}
                    onEdgeRenamed={setSelEdgeId}
                    focusIntent={!!selEdge && selEdge.id === freshEdgeId}
                    bindingIds={bindingIds}
                    layout={layout}
                    issues={issues}
                    onCreateEdge={createPanelEdge}
                    onFocusNode={focusNode}
                    onHoverEdge={setHoverEdgeId}
                    allowedIntentIds={allowedIntentIds}
                    catalogProfileId={catalogProfileId}
                    onCatalogProfileId={setCatalogProfileId}
                    profileIds={profileIds}
                  />
                </div>
              </SectionProvider>
            ) : (
              // Collapsed: a slim rail that still says whether anything is wrong,
              // and jumps straight back to a section.
              <div className="insp-rail">
                <button
                  type="button"
                  className="rail-btn"
                  onClick={() => setPanelOpen(true)}
                  title="Show panel (Ctrl+Alt+B)"
                  aria-label="Show panel"
                >
                  <IconPanelOpen size={16} />
                </button>
                <span className="rail-sep" />
                <button
                  type="button"
                  className={`rail-btn tone-${errors.length ? 'err' : issues.length ? 'warn' : 'ok'}`}
                  onClick={() => openSection('validation')}
                  title={
                    issues.length
                      ? `${errors.length} error(s), ${warningCount} warning(s)`
                      : 'Graph is valid'
                  }
                  aria-label="Validation"
                >
                  {issues.length ? <IconAlert size={16} /> : <IconCheck size={16} />}
                  {issues.length > 0 && (
                    <span className="rail-badge">{errors.length || issues.length}</span>
                  )}
                </button>
                {selNode && (
                  <button
                    type="button"
                    className="rail-btn"
                    onClick={() => openSection('connections')}
                    title={`Connections of ${selNode.id}`}
                    aria-label="Connections"
                  >
                    <IconLink size={16} />
                    <span className="rail-badge neutral">
                      {doc.edges.filter((e) => e.from === selNode.id || e.to === selNode.id).length}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  className="rail-btn"
                  onClick={() =>
                    openSection(selNode ? 'properties' : selEdge ? 'edge' : 'flow-settings')
                  }
                  title={selNode ? 'Node properties' : selEdge ? 'Connection' : 'Flow settings'}
                  aria-label="Properties"
                >
                  {selNode || selEdge ? <IconSliders size={16} /> : <IconGear size={16} />}
                </button>
                {(selNode || selEdge) && (
                  <span
                    className="rail-selected"
                    style={{ '--type-color': selNode ? NODE_COLOR[selNode.type] : 'var(--accent)' }}
                    title={selNode ? selNode.id : selEdge.id}
                  >
                    {selNode ? selNode.id : selEdge.id}
                  </span>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      <Modal
        open={versionsOpen}
        title={inspectVer ? `Published v${inspectVer.version} (read-only)` : 'Published versions'}
        hint={
          inspectVer
            ? `${inspectVer.published_at ?? ''} ${inspectVer.content_hash ? inspectVer.content_hash.slice(0, 12) : ''}`.trim()
            : 'Inspect a published document without changing the draft.'
        }
        onClose={() => {
          setVersionsOpen(false)
          setInspectVer(null)
        }}
        onSubmit={() => {
          setVersionsOpen(false)
          setInspectVer(null)
        }}
        submitLabel="Done"
      >
        {inspectVer ? (
          <>
            <p className="hint">
              This is the published document. It is not written back unless you copy it into the
              builder.
            </p>
            <pre
              className="mono"
              style={{
                maxHeight: 360,
                overflow: 'auto',
                fontSize: 11,
                whiteSpace: 'pre-wrap',
              }}
            >
              {JSON.stringify(inspectVer.doc, null, 2)}
            </pre>
            <div className="actions tight">
              <button
                type="button"
                className="btn secondary sm"
                onClick={() => {
                  setVersionsOpen(false)
                  setInspectVer(null)
                  void loadVersion(inspectVer.version)
                }}
              >
                Copy v{inspectVer.version} into builder
              </button>
            </div>
          </>
        ) : (
          <div>
            {(versions.length
              ? versions
              : publishedVersion != null
                ? [{ version: publishedVersion }]
                : []
            ).map((v) => (
              <div className="row tight" key={v.version} style={{ marginBottom: 8 }}>
                <strong>v{v.version}</strong>
                <span className="desc">{v.published_at ?? ''}</span>
                <button
                  type="button"
                  className="btn secondary sm"
                  onClick={() => void inspectVersion(v.version)}
                >
                  Inspect
                </button>
              </div>
            ))}
            {!versions.length && publishedVersion == null && (
              <p className="hint">No published versions yet.</p>
            )}
          </div>
        )}
      </Modal>
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
