import { useCallback, useEffect, useRef, useState } from 'react'
import type { MaterialSummary } from '@shared/types'

/** Normalize an unknown rejection value into a readable message (never throws). */
function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (e == null) return String(e)
  try {
    const json = JSON.stringify(e)
    return json && json !== '{}' ? json : String(e)
  } catch {
    return String(e)
  }
}

export function useMaterials(rootPath: string) {
  const [list, setList] = useState<MaterialSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Monotonic request id: only the newest reload() is allowed to update state, so a slow response
  // for a previous rootPath can't clobber the current one (out-of-order resolution).
  const reqId = useRef(0)

  const reload = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    // Clear immediately so stale rows from a previous rootPath can't stay actionable while loading.
    setList([])
    try {
      const data = await window.api.materials.list(rootPath)
      if (id !== reqId.current) return
      setList(data)
      setError(null)
    } catch (e) {
      if (id !== reqId.current) return
      // Surface the failure so the list screen can explain the empty state.
      console.error('[useMaterials] list failed:', e)
      setError(`Could not load materials: ${toErrorMessage(e)}`)
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [rootPath])

  useEffect(() => {
    void reload()
  }, [reload])

  return { list, loading, error, reload }
}
