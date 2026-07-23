import { useCallback, useEffect, useState } from 'react'
import type { DatasetInfo } from '@shared/types'

export interface DatasetState {
  info: DatasetInfo | null
  loading: boolean
  /** Open the folder picker; keeps current info if the user cancels. */
  selectFolder: () => Promise<void>
  /** Re-scan the current folder. */
  reload: () => Promise<void>
}

export function useDataset(): DatasetState {
  const [info, setInfo] = useState<DatasetInfo | null>(null)
  const [loading, setLoading] = useState(true)

  // On mount, try to restore the last-used folder.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const last = await window.api.getLastDataset()
      if (!cancelled) {
        setInfo(last)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectFolder = useCallback(async () => {
    setLoading(true)
    const result = await window.api.selectDatasetFolder()
    if (result) setInfo(result)
    setLoading(false)
  }, [])

  const reload = useCallback(async () => {
    if (!info) return
    setLoading(true)
    setInfo(await window.api.scanDataset(info.rootPath))
    setLoading(false)
  }, [info])

  return { info, loading, selectFolder, reload }
}
