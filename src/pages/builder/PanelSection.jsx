import { createContext, useCallback, useContext, useId, useMemo, useState } from 'react'
import { IconChevron } from './icons'

/**
 * Collapsible sections for the builder's right-hand panel.
 *
 * Open/closed is remembered per section id (not per node), so folding away
 * "Prompt text" stays folded while you click from node to node — the point is
 * to keep the panel down to what you are working on right now.
 */

const STORE_KEY = 'orch_builder_sections'
const SectionCtx = createContext(null)

function readStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}')
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

/** Owned by the builder, so the collapsed rail can open a section before scrolling to it. */
export function useSectionStore() {
  const [open, setOpenMap] = useState(readStore)
  const write = (next) => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next))
    } catch {
      /* private mode — the layout just will not persist */
    }
    return next
  }
  const setOpen = useCallback((id, value) => {
    setOpenMap((m) => (m[id] === value ? m : write({ ...m, [id]: value })))
  }, [])
  const setMany = useCallback((ids, value) => {
    setOpenMap((m) => write({ ...m, ...Object.fromEntries(ids.map((id) => [id, value])) }))
  }, [])
  return useMemo(
    () => ({ isOpen: (id, fallback = true) => open[id] ?? fallback, setOpen, setMany }),
    [open, setOpen, setMany],
  )
}

export function SectionProvider({ store, children }) {
  return <SectionCtx.Provider value={store}>{children}</SectionCtx.Provider>
}

/**
 * @param {object} p
 * @param {string} p.id        stable key for the remembered state and the rail's scroll target
 * @param {string} p.title
 * @param {import('react').ReactNode} [p.icon]
 * @param {import('react').ReactNode} [p.meta]    small summary shown in the header (counts, a ref)
 * @param {'ok'|'warn'|'err'} [p.tone]           tints the header when the section needs attention
 * @param {import('react').ReactNode} [p.actions] header buttons, outside the toggle
 * @param {boolean} [p.defaultOpen]
 */
export function PanelSection({
  id,
  title,
  icon,
  meta,
  tone,
  actions,
  defaultOpen = true,
  children,
}) {
  const store = useContext(SectionCtx)
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const open = store ? store.isOpen(id, defaultOpen) : localOpen
  const toggle = () => (store ? store.setOpen(id, !open) : setLocalOpen(!open))
  const bodyId = useId()

  return (
    <section
      className={`psec ${open ? 'open' : ''} ${tone ? `tone-${tone}` : ''}`}
      data-section={id}
    >
      <div className="psec-head">
        <button
          type="button"
          className="psec-toggle"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
        >
          <IconChevron className="psec-chev" size={13} />
          {icon && <span className="psec-icon">{icon}</span>}
          <span className="psec-title">{title}</span>
          {meta != null && meta !== false && <span className="psec-meta">{meta}</span>}
        </button>
        {actions && <div className="psec-actions">{actions}</div>}
      </div>
      {/* Stays mounted so half-typed fields survive a fold; inert keeps Tab out of it. */}
      <div className="psec-body" id={bodyId} inert={!open}>
        <div className="psec-inner">
          <div className="psec-content">{children}</div>
        </div>
      </div>
    </section>
  )
}
