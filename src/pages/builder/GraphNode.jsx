import { Handle, Position, useConnection } from '@xyflow/react'
/** Colour per node type, so the graph's shape is readable at a glance. */
export const NODE_COLOR = {
  Entry: 'var(--n-entry)',
  Speak: 'var(--n-speak)',
  ListenChoice: 'var(--n-listen)',
  ListenLanguage: 'var(--n-listen)',
  ListenSlot: 'var(--n-listen)',
  Decide: 'var(--n-decide)',
  Inform: 'var(--n-inform)',
  Tool: 'var(--n-tool)',
  End: 'var(--n-end)',
}
/** One graph node on the canvas. Shows the detail that matters per type. */
export default function GraphNode({ id, data, selected }) {
  const { node, isEntry, invalid } = data
  const color = NODE_COLOR[node.type] ?? 'var(--border-2)'
  // End is terminal: the cursor stops there and never reads an edge out of it,
  // so offering a dot to drag from only invites edges that do nothing.
  const canLeave = node.type !== 'End'

  // While a connection is being dragged from another node, the whole card
  // becomes the drop target. Hitting an 11px dot — often buried under a dozen
  // edges — was the hard part of wiring a large flow. The overlay handle
  // carries no id, so the edge still attaches to the visible dot.
  const dropAs = useConnection((c) => {
    if (!c.inProgress || c.fromNode?.id === id) return null
    return c.fromHandle?.type === 'target' ? 'source' : 'target'
  })
  const showDrop = dropAs === 'target' || (dropAs === 'source' && canLeave)

  const meta =
    node.type === 'Tool'
      ? `${node.tool ?? '(no verb)'}${node.matrix_intent ? ` → ${node.matrix_intent}` : ''}`
      : node.type === 'Inform'
        ? node.binding_ref || '(no binding)'
        : node.prompt_ref || ''
  return (
    <div
      className={`gnode ${selected ? 'selected' : ''} ${invalid ? 'invalid' : ''}`}
      // The type stripe moved to the top edge now that the graph flows downward.
      style={{ borderTopColor: color }}
      title={`${node.type} node "${node.id}" — click to edit, drag the bottom dot to connect`}
    >
      <Handle type="target" position={Position.Top} aria-label="incoming connections" />
      <div
        className="gtype"
        style={{
          color,
        }}
      >
        {node.type}
        {isEntry && <span className="gentry">ENTRY</span>}
      </div>
      <div className="gid">{node.id}</div>
      {meta && <div className="gmeta">{meta}</div>}
      {canLeave && (
        <Handle
          type="source"
          position={Position.Bottom}
          aria-label="drag to connect to another node"
        />
      )}
      {/* Rendered last: React Flow resolves id-less edges to the first handle. */}
      {showDrop && (
        <Handle
          type={dropAs}
          position={dropAs === 'target' ? Position.Top : Position.Bottom}
          className="body-drop"
          isConnectableStart={false}
        />
      )}
    </div>
  )
}
