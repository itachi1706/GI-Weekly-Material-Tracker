import { useEffect, useState } from 'react'
import type { CharacterSummary, CharacterRecord, CharacterChange, CommitPreview as Preview } from '@shared/types'
import CharactersList from './CharactersList'
import CharacterForm from './CharacterForm'
import CommitPreview from '../materials/CommitPreview'

type Screen =
  | { kind: 'list' }
  | { kind: 'form'; mode: 'create' | 'edit'; template: CharacterRecord; originalKey?: string; file?: string }

export default function CharactersView({ rootPath }: Readonly<{ rootPath: string }>) {
  const [list, setList] = useState<CharacterSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  const [listQuery, setListQuery] = useState('')
  const [listElementFilter, setListElementFilter] = useState('')
  const [preview, setPreview] = useState<{ data: Preview; change: CharacterChange } | null>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    const data = await window.api.characters.list(rootPath)
    setList(data)
    setLoading(false)
  }

  useEffect(() => { void reload() }, [rootPath])

  const goList = () => {
    setScreen({ kind: 'list' })
    setPreview(null)
    setError(null)
  }

  const onNew = async () => {
    const templates = await window.api.characters.templates(rootPath)
    // Default to Pyro rarity 5 as starting template.
    const template = (templates['Pyro_5'] ?? {}) as CharacterRecord
    setScreen({ kind: 'form', mode: 'create', template })
  }

  const onOpen = async (row: CharacterSummary) => {
    const record = await window.api.characters.get(rootPath, row.file, row.key)
    if (!record) return
    setScreen({ kind: 'form', mode: 'edit', template: record, originalKey: row.key, file: row.file })
  }

  const onFormPreview = async (change: CharacterChange) => {
    setError(null)
    const data = await window.api.characters.previewCommit(rootPath, change)
    setPreview({ data, change })
  }

  const onDelete = (file: string, key: string) => {
    if (!confirm(`Delete "${key}"? This stages a removal you can still reject in the preview.`)) return
    const change: CharacterChange = { op: 'delete', file, key, ordering: 'alphabetical' }
    void window.api.characters.previewCommit(rootPath, change).then((data) => {
      setError(null)
      setPreview({ data, change })
    })
  }

  const onApply = async () => {
    if (!preview) return
    setApplying(true)
    const res = await window.api.characters.commit(rootPath, preview.change)
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
        <CharactersList
          rootPath={rootPath}
          list={list}
          loading={loading}
          query={listQuery}
          elementFilter={listElementFilter}
          onQueryChange={setListQuery}
          onElementFilterChange={setListElementFilter}
          onNew={onNew}
          onOpen={onOpen}
        />
      )}

      {screen.kind === 'form' && (
        <CharacterForm
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
