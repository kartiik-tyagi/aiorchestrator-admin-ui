/** Small shared building blocks. Deliberately plain — no component library. */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
}) {
  return (
    <Field label={label} desc={desc}>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        className={mono ? 'mono' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
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
