import { useCallback, useEffect, useState } from 'react'
import type { MaterialSummary } from '@shared/types'

export function useMaterials(rootPath: string) {
  const [list, setList] = useState<MaterialSummary[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    setList(await window.api.materials.list(rootPath))
    setLoading(false)
  }, [rootPath])

  useEffect(() => {
    void reload()
  }, [reload])

  return { list, loading, reload }
}
