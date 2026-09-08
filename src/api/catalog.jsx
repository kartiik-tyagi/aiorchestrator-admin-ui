/**
 * Server catalog context.
 *
 * Doc 13 OD-13-3: Admin dropdowns bind ONLY to GET /v1/meta/catalog, so the UI
 * can never offer a node type, edge kind, tool or clock the kernel would reject.
 * Gateway ids come from GET /v1/gateways for the same reason.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './client'
const Ctx = createContext({
  catalog: null,
  gateways: null,
  status: null,
  loading: true,
  error: null,
  reload: async () => {},
  reloadStatus: async () => {},
  idsFor: () => [],
  allIds: () => [],
})
export const useCatalog = () => useContext(Ctx)
export function CatalogProvider({ children }) {
  const [catalog, setCatalog] = useState(null)
  const [gateways, setGateways] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const reloadStatus = useCallback(async () => {
    try {
      setStatus(await api.platformStatus())
    } catch {
      /* dashboard surfaces it */
    }
  }, [])
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [c, g] = await Promise.all([api.catalog(), api.gateways()])
      setCatalog(c)
      setGateways(g)
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
    void reloadStatus()
  }, [reloadStatus])
  useEffect(() => {
    void reload()
  }, [reload])
  const idsFor = useCallback(
    (port) => (gateways?.gateways?.[port] ?? []).map((g) => g.id),
    [gateways],
  )
  const allIds = useCallback(() => {
    const out = []
    for (const list of Object.values(gateways?.gateways ?? {})) {
      for (const g of list ?? []) if (!out.includes(g.id)) out.push(g.id)
    }
    return out
  }, [gateways])
  const value = useMemo(
    () => ({
      catalog,
      gateways,
      status,
      loading,
      error,
      reload,
      reloadStatus,
      idsFor,
      allIds,
    }),
    [catalog, gateways, status, loading, error, reload, reloadStatus, idsFor, allIds],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
