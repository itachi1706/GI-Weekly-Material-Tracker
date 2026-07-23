import { useEffect, useRef, useState } from 'react'
import type { OutfitSummary, OutfitRecord, OutfitChange, CommitPreview as Preview } from '@shared/types'
import OutfitsList from './OutfitsList'
import OutfitForm from './OutfitForm'
import CommitPreview from '../materials/CommitPreview'

type Screen =
  | { kind: 'list' }
  | { kind: 'form'; mode: 'create' | 'edit'; template: OutfitRecord; originalKey?: string; file?: string }

export default function OutfitsView({ rootPath }: Readonly<{ rootPath: string }>) {
  const [list, setList] = useState<OutfitSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  const [listQuery, setListQuery] = useState('')
  const [listFileFilter, setListFileFilter] = useState('')
  const [preview, setPreview] = useState<{ data: Preview; change: OutfitChange } | null>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Only the newest reload() may update state, so a slow response for a previous rootPath can't
  // clobber the current one (out-of-order resolution).
  const reqId = useRef(0)

  const reload = async () => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const data = await window.api.outfits.list(rootPath)
      if (id !== reqId.current) return
      setList(data)
      setError(null) // clear any prior load failure once the latest request succeeds
    } catch (e) {
      if (id !== reqId.current) return
      setList([]) // drop stale records rather than showing another root's data on failure
      setError(`Could not load outfits: ${(e as Error).message}`)
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }

  useEffect(() => { void reload() }, [rootPath])

  const goList = () => {
    setScreen({ kind: 'list' })
    setPreview(null)
    setError(null)
  }

  const onNew = async () => {
    const templates = await window.api.outfits.miscTemplates(rootPath)
    const template = (templates['Outfit'] ?? {}) as OutfitRecord
    setScreen({ kind: 'form', mode: 'create', template })
  }

  const onOpen = async (row: OutfitSummary) => {
    const record = await window.api.outfits.get(rootPath, row.file, row.key)
    if (!record) return
    setScreen({ kind: 'form', mode: 'edit', template: record, originalKey: row.key, file: row.file })
  }

  const onFormPreview = async (change: OutfitChange) => {
    setError(null)
    const data = await window.api.outfits.previewCommit(rootPath, change)
    setPreview({ data, change })
  }

  const onDelete = (file: string, key: string) => {
    if (!confirm(`Delete "${key}"? This stages a removal you can still reject in the preview.`)) return
    const change: OutfitChange = { op: 'delete', file, key, ordering: 'alphabetical' }
    void window.api.outfits.previewCommit(rootPath, change).then((data) => {
      setError(null)
      setPreview({ data, change })
    })
  }

  const onApply = async () => {
    if (!preview) return
    setApplying(true)
    const res = await window.api.outfits.commit(rootPath, preview.change)
    setApplying(false)
    if (res.ok) {
      await reload()
      goList()
    } else {
      setError(res.error ?? 'Commit failed.')
    }
  }

  return (
    <div className="materials">
      {screen.kind === 'list' && (
        <OutfitsList
          rootPath={rootPath}
          list={list}
          loading={loading}
          error={error}
          query={listQuery}
          fileFilter={listFileFilter}
          onQueryChange={setListQuery}
          onFileFilterChange={setListFileFilter}
          onNew={onNew}
          onOpen={onOpen}
        />
      )}

      {screen.kind === 'form' && (
        <OutfitForm
          rootPath={rootPath}
          mode={screen.mode}
          template={screen.template}
          originalKey={screen.originalKey}
          file={screen.file}
          onPreview={(change) => void onFormPreview(change)}
          onDelete={
            screen.mode === 'edit' && screen.file && screen.originalKey
              ? () => onDelete(screen.file!, screen.originalKey!)
              : undefined
          }
          onCancel={goList}
        />
      )}

      {preview && (
        <div className="modal-backdrop">
          <div className="modal">
            <CommitPreview
              preview={preview.data}
              applying={applying}
              error={error}
              onApply={onApply}
              onBack={() => { setPreview(null); setError(null) }}
              onDiscard={goList}
            />
          </div>
        </div>
      )}
    </div>
  )
}
