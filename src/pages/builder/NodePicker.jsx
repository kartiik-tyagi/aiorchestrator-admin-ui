import { useId, useMemo, useRef, useState } from 'react'
import { NODE_COLOR } from './GraphNode'
import { IconSearch } from './icons'

/**
 * Searchable node picker — "Connect to…" in the Connections panel.
 *
 * A native <select> of 30+ bare ids gives no clue which node is which. This
 * shows each node's type colour and type, filters as you type (by id, type or
 * prompt/binding), and marks nodes you are already connected to, so a second
 * edge to the same node is a deliberate choice.
 *
 * The list renders inline below the input rather than floating, so it can
 * never be clipped by the scrolling panel.
 */
export default function NodePicker({ nodes, placeholder, onPick, already = {}, disabled, addon }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const listRef = useRef(null)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return nodes
    return nodes.filter((n) =>
      [n.id, n.type, n.prompt_ref, n.binding_ref, n.matrix_intent]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [nodes, query])

  const pick = (id) => {
    setQuery('')
    setOpen(false)
    setActive(0)
    onPick(id)
  }

  const move = (delta) => {
    if (!matches.length) return
    const next = (active + delta + matches.length) % matches.length
    setActive(next)
    listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && matches[active]) pick(matches[active].id)
      else setOpen(true)
    } else if (e.key === 'Escape') {
      // Close the list first; a second Esc falls through to leave the field.
      if (open || query) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setQuery('')
      }
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const activeId = open && matches[active] ? `${listId}-${matches[active].id}` : undefined

  return (
    <div className={`npick ${open ? 'open' : ''}`}>
      <div className="npick-field">
        <IconSearch size={13} />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {addon ? (
          <span className="npick-addon">{addon}</span>
        ) : (
          open && <span className="npick-hint">↑↓ Enter</span>
        )}
      </div>
      {open && (
        <ul className="npick-list" role="listbox" id={listId} ref={listRef}>
          {matches.map((n, i) => (
            <li
              key={n.id}
              id={`${listId}-${n.id}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              // mousedown, not click: the input's blur would close the list first.
              onMouseDown={(e) => {
                e.preventDefault()
                pick(n.id)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="npick-swatch" style={{ background: NODE_COLOR[n.type] }} />
              <span className="npick-id">{n.id}</span>
              <span className="npick-type">{n.type}</span>
              {already[n.id] > 0 && (
                <span className="npick-linked" title="Edges you already have to this node">
                  {already[n.id]} linked
                </span>
              )}
            </li>
          ))}
          {!matches.length && <li className="npick-empty">No node matches “{query}”</li>}
        </ul>
      )}
    </div>
  )
}
