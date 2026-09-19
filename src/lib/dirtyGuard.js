/** Cross-page unsaved work, so the product switcher can warn. */
let dirty = false
let label = 'document'

export function setDirtyGuard(next, why = 'document') {
  dirty = !!next
  label = why || 'document'
}

export function confirmLeaveDirty() {
  if (!dirty) return true
  return window.confirm(`This ${label} has unsaved changes. Leave without saving?`)
}
