/** Small shared building blocks. Deliberately plain — no component library. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ApiError } from '../api/client'

/* ------------------------------------------------------------------ toasts */

const ToastCtx = createContext({
  push: () => {},
  ok: () => {},
  fail: () => {},
})
export const useToast = () => useContext(ToastCtx)

/** Renders an ApiError with its status, code and server-supplied details. */
export function describeError(e, prefix) {
  const head = prefix ? `${prefix}: ` : ''
  if (e instanceof ApiError) {
    const bits = [e.message]
    if (e.status) bits.unshift(`${e.status}`)
    const d = e.detailText
    return head + bits.join(' ') + (d ? `\n${d}` : '')
  }
  return head + (e?.message ?? String(e))
}
/**
 * Stable hue (0–359) derived from an id, for list monograms.
 *
 * Same id always gets the same tint, so a row keeps its colour across reloads
 * and is recognisable by shape before it is read.
 */
export function markHue(id) {
  let h = 0
  for (let i = 0; i < (id ?? '').length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const seq = useRef(0)
  const push = useCallback((kind, text) => {
    const id = ++seq.current
    setItems((xs) => [
      ...xs,
      {
        id,
        kind,
        text,
      },
    ])
    // Errors linger; successes get out of the way.
    window.setTimeout(
      () => setItems((xs) => xs.filter((x) => x.id !== id)),
      kind === 'err' ? 9000 : 3500,
    )
  }, [])
  const value = useMemo(
    () => ({
      push,
      ok: (text) => push('ok', text),
      fail: (e, prefix) => push('err', describeError(e, prefix)),
    }),
    [push],
  )
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span>{t.text}</span>
            <button
              className="close"
              onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ------------------------------------------------------------------ fields */

export function Field({ label, desc, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {desc && <p className="desc">{desc}</p>}
    </div>
  )
}
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  desc,
  mono,
  type = 'text',
  disabled,
  suggestions,
  autoFocus,
}) {
  // A stable id per field instance, so the datalist binds to this input only.
  const listId = useId()
  return (
    <Field label={label} desc={desc}>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        list={suggestions?.length ? listId : undefined}
        className={mono ? 'mono' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {!!suggestions?.length && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </Field>
  )
}
export function NumberField({ label, value, onChange, desc, placeholder }) {
  return (
    <Field label={label} desc={desc}>
      <input
        type="number"
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </Field>
  )
}
export function SelectField({
  label,
  value,
  onChange,
  options,
  desc,
  allowEmpty = true,
  emptyLabel,
}) {
  return (
    <Field label={label} desc={desc}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty && (
          <option value="">
            {emptyLabel ?? (options.length ? '— select —' : '— none available —')}
          </option>
        )}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  )
}
export function CheckField({ label, checked, onChange, desc }) {
  return (
    <div className="field">
      <label className="check">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
      {desc && <p className="desc">{desc}</p>}
    </div>
  )
}

/** Multi-select rendered as toggle chips — used for locales, modes, emit lists. */
export function ChipMulti({ label, options, selected, onChange, desc }) {
  const toggle = (o) =>
    onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o])
  return (
    <div className="field">
      <label>{label}</label>
      <div className="chips">
        {options.map((o) => (
          <span
            key={o}
            className={`chip ${selected.includes(o) ? 'on' : ''}`}
            onClick={() => toggle(o)}
          >
            {o}
          </span>
        ))}
        {!options.length && <span className="desc">nothing to choose from</span>}
      </div>
      {desc && <p className="desc">{desc}</p>}
    </div>
  )
}

/** Free-form ordered string list (fallback locales, ladder, providers). */
export function StringList({ label, values, onChange, placeholder, desc }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim()
    if (!t || values.includes(t)) {
      setDraft('')
      return
    }
    onChange([...values, t])
    setDraft('')
  }
  return (
    <div className="field">
      <label>{label}</label>
      <div
        className="chips"
        style={{
          marginBottom: values.length ? '0.4rem' : 0,
        }}
      >
        {values.map((v) => (
          <span key={v} className="chip on">
            {v}
            <span className="x" onClick={() => onChange(values.filter((x) => x !== v))}>
              ×
            </span>
          </span>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
        }}
      >
        <input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="btn secondary sm" onClick={add}>
          Add
        </button>
      </div>
      {desc && <p className="desc">{desc}</p>}
    </div>
  )
}

/**
 * Ordered list built from a fixed set of options — a dropdown instead of free
 * text, so an id that is unregistered or on the wrong port can never be typed
 * in. Order is meaningful (routers try providers in sequence), so entries can
 * be moved up and down rather than just added and removed.
 */
export function SelectList({ label, values, options, onChange, desc, emptyText }) {
  const [pick, setPick] = useState('')
  const remaining = (options ?? []).filter((o) => !values.includes(o))

  const add = () => {
    if (!pick || values.includes(pick)) return
    onChange([...values, pick])
    setPick('')
  }
  const move = (i, delta) => {
    const j = i + delta
    if (j < 0 || j >= values.length) return
    const next = [...values]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="field">
      <label>{label}</label>

      {values.length > 0 && (
        <div className="ordered-list">
          {values.map((v, i) => (
            <div className="ordered-item" key={v}>
              <span className="ord-n">{i + 1}</span>
              <code className="ord-id">{v}</code>
              {!(options ?? []).includes(v) && (
                <span className="badge err" title="Not registered on this port — publish will fail">
                  unknown
                </span>
              )}
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${v} up`}
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => move(i, 1)}
                disabled={i === values.length - 1}
                aria-label={`Move ${v} down`}
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="btn danger sm"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.4rem', marginTop: values.length ? '0.4rem' : 0 }}>
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          disabled={!remaining.length}
          aria-label={`Add to ${label}`}
        >
          <option value="">
            {!(options ?? []).length
              ? (emptyText ?? '— none registered —')
              : remaining.length
                ? '— select a gateway —'
                : '— all added —'}
          </option>
          {remaining.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <button type="button" className="btn secondary sm" onClick={add} disabled={!pick}>
          Add
        </button>
      </div>
      {desc && <p className="desc">{desc}</p>}
    </div>
  )
}

/* --------------------------------------------------------------- structure */

export function Section({ title, tag, children, open = false }) {
  return (
    <details className="section" open={open}>
      <summary>
        {title}
        {tag && <span className="tag">{tag}</span>}
      </summary>
      <div className="body">{children}</div>
    </details>
  )
}
export function Card({ title, hint, children, actions }) {
  return (
    <div className="card">
      {title && <h2>{title}</h2>}
      {hint && <p className="hint">{hint}</p>}
      {children}
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}
/**
 * Modal dialog for the create-a-thing flows.
 *
 * Creating a profile / binding / flow is a short, one-off act, so it does not
 * deserve a permanently open form competing with the editor next to it. The
 * dialog is dismissable three ways (Escape, backdrop, Cancel) because nothing
 * in here is destructive, and it submits on Enter so an id and a name can be
 * typed without reaching for the mouse.
 *
 * Focus moves to the first field on open and returns to whatever opened the
 * dialog on close, so keyboard users are not dumped back at the top of the page.
 */
export function Modal({
  open,
  title,
  hint,
  onClose,
  onSubmit,
  submitLabel = 'Create',
  busy,
  children,
}) {
  const panelRef = useRef(null)
  const restoreRef = useRef(null)

  // Callers write `onClose={() => setCreating(false)}`, so the prop is a new
  // function on every parent render — and every keystroke in a field re-renders
  // the parent. Depending on it would tear this effect down and set it up again
  // per character: the cleanup hands focus back to the button that opened the
  // dialog, then setup re-focuses the *first* field. Typing one letter anywhere
  // but the first input threw focus away, which reads as the field going dead.
  // Keep the latest callback in a ref and key the effect on `open` alone.
  const closeRef = useRef(onClose)
  // Written after commit, not during render. Escape is handled in a user event,
  // long after this has run, so the ref is always the current callback.
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Let the panel paint before hunting for something to focus.
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      )
      ;(first ?? panelRef.current)?.focus()
    }, 0)

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      // Keep Tab inside the dialog.
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  const submit = (e) => {
    e.preventDefault()
    if (!busy) onSubmit?.()
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={submit}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {hint && <p className="modal-hint">{hint}</p>}
        <div className="modal-body">{children}</div>
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Working…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

/**
 * Labelled on/off switch. Unlike CheckField this reads as a mode selector —
 * both states are named, so it is obvious what turning it off actually does.
 */
export function ToggleField({ label, checked, onChange, onLabel, offLabel, desc }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <button
        type="button"
        className={`toggle ${checked ? 'on' : ''}`}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-track">
          <span className="toggle-knob" />
        </span>
        <span className="toggle-text">{checked ? onLabel : offLabel}</span>
      </button>
      {desc && <p className="desc">{desc}</p>}
    </div>
  )
}

export function Probe({ state }) {
  if (!state?.msg) return null
  return <div className={`probe ${state.ok ? 'ok' : 'err'}`}>{state.msg}</div>
}
export function Empty({ children }) {
  return <div className="empty">{children}</div>
}
export function Spinner() {
  return <span className="spinner" />
}

/* ------------------------------------------------------------------- hooks */

/** Load-once async resource with manual reload. */
export function useAsync(fn, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fnRef.current())
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, deps)
  return {
    data,
    error,
    loading,
    reload,
    setData,
  }
}
