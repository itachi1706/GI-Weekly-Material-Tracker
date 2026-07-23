import { useMemo } from 'react'
import type { OutfitSummary } from '@shared/types'
import { MatImage } from '../shared/materialPicker'
import SortableTable, { type Column } from '../shared/SortableTable'

/** "Outfits-Standard.json" → "Standard" */
function fileLabel(file: string): string {
  return file.replaceAll(/^Outfits-|\.json$/g, '')
}

interface Props {
  rootPath: string
  list: OutfitSummary[]
  loading: boolean
  query: string
  fileFilter: string
  onQueryChange: (v: string) => void
  onFileFilterChange: (v: string) => void
  onNew: () => void
  onOpen: (row: OutfitSummary) => void
}

export default function OutfitsList({
  rootPath, list, loading,
  query, fileFilter, onQueryChange, onFileFilterChange,
  onNew, onOpen
}: Readonly<Props>) {
  const files = useMemo(
    () => Array.from(new Set(list.map((o) => o.file))).sort((a, b) => a.localeCompare(b)),
    [list]
  )

  const base = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter(
      (o) =>
        (!fileFilter || o.file === fileFilter) &&
        (!q ||
          o.name.toLowerCase().includes(q) ||
          o.character.toLowerCase().includes(q) ||
          o.key.toLowerCase().includes(q))
    )
  }, [list, query, fileFilter])

  const columns: Column<OutfitSummary>[] = useMemo(() => [
    { key: '_thumb', header: '', sortable: false,
      render: (o) => <MatImage rootPath={rootPath} imagePath={o.image ?? ''} className="mat-thumb" /> },
    { key: 'name', header: 'Name', render: (o) => o.name },
    { key: 'character', header: 'Character', render: (o) => o.character },
    // Type is display-only (not sortable); Set sorts by the raw `file` while rendering fileLabel.
    { key: 'type', header: 'Type', sortable: false, render: (o) => <span className="pill">{o.type}</span> },
    { key: 'file', header: 'Set', render: (o) => <span className="pill">{fileLabel(o.file)}</span> },
    { key: 'rarity', header: 'Rarity', sortValue: (o) => o.rarity, render: (o) => '★'.repeat(o.rarity) },
    { key: 'released', header: 'Released', sortValue: (o) => (o.released ? 1 : 0),
      render: (o) => (
        <span className={`pill ${o.released ? 'pill-ok' : ''}`}>{o.released ? 'Yes' : 'No'}</span>
      ) }
  ], [rootPath])

  return (
    <div className="mat-list">
      <header className="mat-list-head">
        <h2>Outfits</h2>
        <button type="button" className="btn-primary" onClick={onNew}>+ New outfit</button>
      </header>

      <div className="mat-list-filters">
        <input
          type="search"
          placeholder="Search name, character, key…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <select value={fileFilter} onChange={(e) => onFileFilterChange(e.target.value)}>
          <option value="">All files</option>
          {files.map((f) => (
            <option key={f} value={f}>{fileLabel(f)}</option>
          ))}
        </select>
      </div>

      <SortableTable
        rows={base}
        total={list.length}
        noun="outfits"
        columns={columns}
        loading={loading}
        onOpen={onOpen}
      />
    </div>
  )
}
