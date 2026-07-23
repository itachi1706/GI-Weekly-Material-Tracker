import { useCallback, useEffect, useState } from 'react'
import type { MaterialSummary } from '@shared/types'

export function useMaterials(rootPath: string) {
  const [list, setList] = useState<MaterialSummary[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setList(await window.api.materials.list(rootPath))
    } catch (e) {
      // Keep the last-known list; surface the failure without leaving an unhandled rejection.
      console.error('[useMaterials] list failed:', e)
    } finally {
      setLoading(false)
    }
  }, [rootPath])

  useEffect(() => {
    void reload()
  }, [reload])

  return { list, loading, reload }
}
