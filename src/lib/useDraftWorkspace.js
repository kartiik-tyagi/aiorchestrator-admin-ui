import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { mi } from '../api/mi/client'
import { initialState, isDirty, ops, patchBody, reducer } from './draftWorkspace'
import { setDirtyGuard } from './dirtyGuard'
import { miErrorSentence } from './miErrors'

/**
 * Page-level MoM draft state (wave 7.2). Called once in MeetingDetail so the
 * working copy survives tab switches. Saves send only changed fields plus
 * expected_version (MI.37); a stale save becomes a conflict to resolve, never
 * a silent overwrite.
 */
export function useDraftWorkspace(meetingId) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [jobBusy, setJobBusy] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const dirty = isDirty(state)
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  }, [state])

  /**
   * Fetch the server draft. An automatic reload never replaces edits made while
   * it was in flight; pass { force: true } to discard them deliberately.
   */
  const reload = useCallback(async (opts = {}) => {
    setLoading(true)
    try {
      const d = await mi.getDraft(meetingId)
      if (!opts.force && isDirty(stateRef.current)) return stateRef.current.draft
      dispatch({ type: 'loaded', draft: d })
      setLoadError(null)
      setSaveError(null)
      setJobBusy(false)
      return d
    } catch (e) {
      // A failed background reload must not wipe unsaved edits.
      if (!opts.force && isDirty(stateRef.current)) return stateRef.current.draft
      dispatch({ type: 'loaded', draft: null })
      setLoadError(e)
      return null
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    setDirtyGuard(dirty, 'draft')
    if (!dirty) return undefined
    const onUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])
  useEffect(() => () => setDirtyGuard(false), [])

  /** Resolves true when the server holds the working copy afterwards. */
  const saveState = useCallback(async (st) => {
    const body = patchBody(st)
    if (!body) return true
    setSaving(true)
    setSaveError(null)
    try {
      const got = await mi.patchDraft(meetingId, body)
      dispatch({ type: 'loaded', draft: got })
      setJobBusy(false)
      setSavedAt(new Date())
      return true
    } catch (e) {
      if (e.code === 'draft_version_conflict' && e.body?.current) {
        dispatch({ type: 'conflict', theirs: e.body.current })
      } else if (e.code === 'job_in_progress') {
        setJobBusy(true)
      } else {
        setSaveError(miErrorSentence(e.code, e.message))
      }
      return false
    } finally {
      setSaving(false)
    }
  }, [meetingId])

  const save = useCallback(() => saveState(stateRef.current), [saveState])

  const resolveConflict = useCallback(
    async (choice) => {
      const cur = stateRef.current
      const theirs = cur.conflict?.theirs
      if (!theirs) return false
      if (choice === 'theirs') {
        dispatch({ type: 'loaded', draft: theirs })
        return true
      }
      // Rebase mine onto theirs and save that exact state (no render race).
      const next = reducer(cur, { type: 'keepMine' })
      dispatch({ type: 'keepMine' })
      return saveState(next)
    },
    [saveState],
  )

  const editor = useMemo(() => {
    const at = () => Date.now()
    return {
      setSection: (i, field, value) =>
        dispatch({ type: 'edit', fn: ops.setSection(i, field, value), key: `sec-${i}-${field}`, at: at() }),
      setClaim: (kind, i, patch) =>
        dispatch({
          type: 'edit',
          fn: ops.setClaim(kind, i, patch),
          key: `${kind}-${i}-${Object.keys(patch).join(',')}`,
          at: at(),
        }),
      addClaim: (kind) => dispatch({ type: 'edit', fn: ops.addClaim(kind), key: '', at: at() }),
      removeClaim: (kind, i) => dispatch({ type: 'edit', fn: ops.removeClaim(kind, i), key: '', at: at() }),
      moveClaim: (kind, i, delta) =>
        dispatch({ type: 'edit', fn: ops.moveClaim(kind, i, delta), key: '', at: at() }),
    }
  }, [])

  return {
    draft: state.draft,
    working: state.working,
    loadedVersion: state.draft?.version ?? null,
    dirty,
    loading,
    loadError,
    saving,
    saveError,
    jobBusy,
    savedAt,
    conflict: state.conflict,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    discard: () => dispatch({ type: 'loaded', draft: stateRef.current.draft }),
    reload,
    save,
    resolveConflict,
    editor,
  }
}
