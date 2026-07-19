import { useEffect, useState } from 'react'
import type { BannerSummary, BannerRecord, BannerType, BannerChange, CommitPreview as Preview } from '@shared/types'
import BannersList from './BannersList'
import BannerForm from './BannerForm'
import CommitPreview from '../materials/CommitPreview'

type Screen =
  | { kind: 'list' }
  | { kind: 'form'; mode: 'create' | 'edit'; record: BannerRecord; bannerType: BannerType; index?: number }

export default function BannersView({ rootPath, bannerType }: Readonly<{ rootPath: string; bannerType: BannerType }>) {
  const [list, setList] = useState<BannerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  const [listQuery, setListQuery] = useState('')
  const [preview, setPreview] = useState<{ data: Preview; change: BannerChange } | null>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    setList(await window.api.banners.list(rootPath))
    setLoading(false)
  }
  useEffect(() => { void reload() }, [rootPath])

  const goList = () => { setScreen({ kind: 'list' }); setPreview(null); setError(null) }

  // Switching subsection in the sidebar returns to that type's list.
  useEffect(() => { setScreen({ kind: 'list' }); setPreview(null); setError(null) }, [bannerType])

  // Seed a new banner from the most-recent existing banner of the given type (fallback: template).
  const seedFor = async (bannerType: BannerType): Promise<BannerRecord> => {
    const top = await window.api.banners.get(rootPath, bannerType, 0)
    const base = top ?? (await window.api.banners.template(rootPath)) ?? {}
    return { ...base, type: bannerType }
  }

  const onNew = async () => {
    const record = await seedFor(bannerType)
    setScreen({ kind: 'form', mode: 'create', record, bannerType })
  }

  const onOpen = async (row: BannerSummary) => {
    const record = await window.api.banners.get(rootPath, row.bannerType, row.index)
    if (!record) return
    setScreen({ kind: 'form', mode: 'edit', record, bannerType: row.bannerType, index: row.index })
  }

  const onFormPreview = async (change: BannerChange) => {
    setError(null)
    const data = await window.api.banners.previewCommit(rootPath, change)
    setPreview({ data, change })
  }

  const onDelete = (bannerType: BannerType, index: number) => {
    if (!confirm('Delete this banner? This stages a removal you can still reject in the preview.')) return
    const change: BannerChange = { op: 'delete', bannerType, index }
    void window.api.banners.previewCommit(rootPath, change).then((data) => {
      setError(null)
      setPreview({ data, change })
    })
  }

  const onApply = async () => {
    if (!preview) return
    setApplying(true)
    const res = await window.api.banners.commit(rootPath, preview.change)
    setApplying(false)
    if (res.ok) { await reload(); goList() }
    else setError(res.error ?? 'Commit failed.')
  }

  return (
    <div className="materials">
      {screen.kind === 'list' && (
        <BannersList
          rootPath={rootPath}
          list={list}
          loading={loading}
          bannerType={bannerType}
          query={listQuery}
          onQueryChange={setListQuery}
          onNew={onNew}
          onOpen={onOpen}
        />
      )}

      {screen.kind === 'form' && (
        <BannerForm
          rootPath={rootPath}
          mode={screen.mode}
          record={screen.record}
          bannerType={screen.bannerType}
          index={screen.index}
          seedFor={seedFor}
          onPreview={(change) => void onFormPreview(change)}
          onDelete={
            screen.mode === 'edit' && screen.index != null
              ? () => onDelete(screen.bannerType, screen.index!)
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
