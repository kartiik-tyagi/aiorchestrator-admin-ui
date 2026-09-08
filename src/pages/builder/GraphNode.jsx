import { Handle, Position } from '@xyflow/react'
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
export default function GraphNode({ data, selected }) {
  const { node, isEntry, invalid } = data
  const color = NODE_COLOR[node.type] ?? 'var(--border-2)'
  const meta =
    node.type === 'Tool'
      ? `${node.tool ?? '(no verb)'}${node.matrix_intent ? ` → ${node.matrix_intent}` : ''}`
      : node.type === 'Inform'
        ? node.binding_ref || '(no binding)'
        : node.prompt_ref || ''
  return (
    <div
      className={`gnode ${selected ? 'selected' : ''} ${invalid ? 'invalid' : ''}`}
      style={{
        borderLeft: `4px solid ${color}`,
      }}
    >
      <Handle type="target" position={Position.Left} />
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
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
