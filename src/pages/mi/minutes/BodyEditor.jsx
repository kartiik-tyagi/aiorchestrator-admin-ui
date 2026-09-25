import { useLayoutEffect, useRef } from 'react'
import { SECTION_SOFT_LIMIT } from '../../../lib/miDocument'
import { continueBullet } from '../../../lib/miBodyEdit'

/**
 * Plain-text section body editor (bodies stay strings, OD-DOC-4). Bullet-aware:
 * Enter on a "- " line continues the list, Enter on an empty bullet ends it,
 * Backspace on an empty bullet removes the marker. Esc leaves the block.
 */
export default function BodyEditor({ id, value, onChange, label }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.currentTarget.blur()
      return
    }
    if ((e.key !== 'Enter' && e.key !== 'Backspace') || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
    const el = e.currentTarget
    if (el.selectionStart !== el.selectionEnd) return
    const next = continueBullet(value, el.selectionStart, e.key)
    if (!next) return
    e.preventDefault()
    onChange(next.value)
    window.requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = next.caret
    })
  }

  const over = value.length > SECTION_SOFT_LIMIT
  return (
    <div className="mp-body-edit">
      <textarea
        id={id}
        ref={ref}
        aria-label={label}
        value={value}
        rows={3}
        spellCheck
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <span className={`mp-count ${over ? 'over' : ''}`}>
        {value.length} / {SECTION_SOFT_LIMIT}
        {over ? ' · longer than the AI limit (allowed)' : ''}
      </span>
    </div>
  )
}
