import { useCallback, useEffect, useRef, useState } from 'react'
import type { MaterialSummary } from '@shared/types'

export function useMaterials(rootPath: string) {
  const [list, setList] = useState<MaterialSummary[]>([])
  const [loading, setLoading] = useState(true)
  // Monotonic request id: only the newest reload() is allowed to update state, so a slow response
  // for a previous rootPath can't clobber the current one (out-of-order resolution).
  const reqId = useRef(0)

  const reload = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const data = await window.api.materials.list(rootPath)
      if (id !== reqId.current) return
      setList(data)
    } catch (e) {
      if (id !== reqId.current) return
      // Drop stale records rather than showing another root's data on failure.
      console.error('[useMaterials] list failed:', e)
      setList([])
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [rootPath])

  useEffect(() => {
    void reload()
  }, [reload])

  return { list, loading, reload }
}
