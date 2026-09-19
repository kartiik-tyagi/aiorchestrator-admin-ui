import { BaseEdge, EdgeLabelRenderer, useStore } from '@xyflow/react'

/**
 * One graph edge on the canvas.
 *
 * The stock smoothstep edge routes every edge between two rows through the same
 * horizontal midline, so a Listen node with fifteen intents draws fifteen lines
 * on top of each other with their labels stacked into unreadable text — and
 * two edges between the same pair of nodes (an intent plus a repair, say) are
 * pixel-identical, so the second one cannot even be clicked.
 *
 * This draws a bezier instead, and the builder passes two hints per edge:
 *   bow     sideways bend, so parallel edges between one pair fan apart
 *   labelT  where along the curve the label sits, so labels of a fan-out
 *           spread towards the end that has room
 *
 * Labels are HTML (EdgeLabelRenderer) so they can be clicked: a label is a far
 * bigger target than a 1.5px line.
 */

// Mirrors React Flow's own bezier control offset, so edges look familiar.
const controlOffset = (distance) => (distance >= 0 ? 0.5 * distance : 6.25 * Math.sqrt(-distance))
const bezierAt = (p0, c1, c2, p3, t) => {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p3
}
// Below this zoom the labels are unreadable anyway and only hide the graph.
const LABEL_MIN_ZOOM = 0.45
const zoomSelector = (s) => s.transform[2] >= LABEL_MIN_ZOOM

export default function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  label,
  data,
  selected,
}) {
  const zoomedIn = useStore(zoomSelector)
  let bow = data?.bow ?? 0
  const dy = targetY - sourceY
  // A back edge (target above source) drawn straight would run through both
  // nodes; swing it out to the side instead.
  if (dy < 0 && Math.abs(targetX - sourceX) < 260) bow += (targetX >= sourceX ? 1 : -1) * 170
  const k = Math.max(dy < 0 ? 70 : 30, controlOffset(dy))
  const c1x = sourceX + bow
  const c1y = sourceY + k
  const c2x = targetX + bow
  const c2y = targetY - k
  const path = `M${sourceX},${sourceY} C${c1x},${c1y} ${c2x},${c2y} ${targetX},${targetY}`
  // `stack` is a vertical label offset for parallel edges: the label sits that
  // far from the midpoint, on its own curve, so a group reads as a list.
  const stack = data?.stack ?? 0
  const t = stack
    ? Math.min(0.85, Math.max(0.15, 0.5 + (Math.abs(dy) > 40 ? stack / dy : 0)))
    : (data?.labelT ?? 0.5)
  const lx = bezierAt(sourceX, c1x, c2x, targetX, t)
  const ly = stack
    ? bezierAt(sourceY, c1y, c2y, targetY, 0.5) + stack
    : bezierAt(sourceY, c1y, c2y, targetY, t)
  const showLabel =
    !!label && (selected || data?.labels === 'always' || (data?.labels === 'zoomed' && zoomedIn))

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} interactionWidth={18} />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className={[
              'elabel',
              'nodrag',
              'nopan',
              selected && 'selected',
              data?.lit && 'related',
              data?.missing && 'missing',
              data?.secondary && 'secondary',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
            onClick={(e) => {
              e.stopPropagation()
              data?.onSelect?.(id)
            }}
            title={data?.title}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
