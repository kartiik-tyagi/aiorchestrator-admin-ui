import { useEffect, useState } from 'react'
import { blockId } from '../../../lib/miDocument'

/**
 * Outline of the document: details, sections, decisions, actions. Click scrolls;
 * the block nearest the top of the viewport is highlighted.
 */
export default function OutlineRail({ doc }) {
  const items = [
    { key: 'details', label: 'Meeting details' },
    ...doc.sections.map((s, i) => ({ key: `sec-${s.id || i}`, label: s.title || s.id || `Section ${i + 1}` })),
    { key: 'decisions', label: 'Decisions', count: doc.decisions.length, flags: doc.decisions.filter((d) => d.flag).length },
    { key: 'actions', label: 'Action items', count: doc.actions.length, flags: doc.actions.filter((a) => a.flag).length },
  ]
  const [active, setActive] = useState(items[0].key)
  const keys = items.map((i) => i.key).join('|')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const els = keys
      .split('|')
      .map((k) => document.getElementById(blockId(k)))
      .filter(Boolean)
    if (!els.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setActive(top.target.id.replace(/^mp-/, ''))
      },
      { rootMargin: '-10% 0px -70% 0px' },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [keys])

  const go = (key) => {
    setActive(key)
    document.getElementById(blockId(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className="mp-rail" aria-label="Minutes outline">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={`mp-rail-item ${blockId(it.key) === blockId(active) ? 'on' : ''}`}
          onClick={() => go(it.key)}
        >
          <span>{it.label}</span>
          {it.count != null && (
            <span className={`mp-rail-n ${it.flags ? 'flag' : ''}`}>
              {it.count}
              {it.flags ? ` · ${it.flags} flag${it.flags > 1 ? 's' : ''}` : ''}
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}
