import { useMemo } from 'react'
import type { MaterialSummary } from '@shared/types'
import { MatImage } from '../shared/materialPicker'
import SortableTable, { type Column } from '../shared/SortableTable'

const INNER_TYPE_LABELS: Record<string, string> = {
  local_speciality: 'Local Speciality',
  mob_drops: 'Mob Drops',
  boss_drops: 'Boss Drops',
  domain_material: 'Domain Material'
}

function labelType(key: string): string {
  return INNER_TYPE_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface Props {
  rootPath: string
  list: MaterialSummary[]
  loading: boolean
  // Controlled filter state (lifted to parent so it persists across navigation)
  query: string
  typeFilter: string
  onQueryChange: (v: string) => void
  onTypeFilterChange: (v: string) => void
  onNew: () => void
  onOpen: (row: MaterialSummary) => void
}

export default function MaterialsList({
  rootPath, list, loading,
  query, typeFilter, onQueryChange, onTypeFilterChange,
  onNew, onOpen
}: Props) {
  const types = useMemo(
    () => Array.from(new Set(list.map((m) => m.innerType))).sort((a, b) => a.localeCompare(b)),
    [list]
  )

  const base = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter(
      (m) =>
        (!typeFilter || m.innerType === typeFilter) &&
        (!q || m.name.toLowerCase().includes(q) || m.key.toLowerCase().includes(q))
    )
  }, [list, query, typeFilter])

  const columns: Column<MaterialSummary>[] = useMemo(() => [
    { key: '_thumb', header: '', sortable: false, thStyle: { width: 44 },
      render: (m) => <MatImage rootPath={rootPath} imagePath={m.image ?? ''} className="mat-thumb" /> },
    { key: 'name', header: 'Name',
      render: (m) => (
        <>
          <div className="mat-name">{m.name}</div>
          <div className="mat-key">{m.key}</div>
        </>
      ) },
    // 'type'/'file' don't map 1:1 to props — supply explicit sort accessors.
    { key: 'type', header: 'Type', sortValue: (m) => labelType(m.innerType).toLowerCase(),
      render: (m) => labelType(m.innerType) },
    { key: 'file', header: 'File',
      sortValue: (m) => m.file.replace(/^Materials-|\.json$/g, '').toLowerCase(),
      tdClassName: 'mat-file', render: (m) => m.file.replace(/^Materials-|\.json$/g, '') },
    { key: 'rarity', header: 'Rarity', thClassName: 'num', tdClassName: 'num',
      sortValue: (m) => m.rarity, render: (m) => m.rarity },
    // Released order is INVERTED vs the other lists (released sorts first in asc).
    { key: 'released', header: 'Released', sortValue: (m) => (m.released ? 0 : 1),
      render: (m) => (m.released ? '✓' : '—') },
    { key: '_edit', header: '', sortable: false,
      render: (m) => (m.editable ? <span className="pill pill-ok">edit</span> : <span className="pill">view</span>) }
  ], [rootPath])

  return (
    <div className="mat-list">
      <header className="mat-list-head">
        <h2>Materials</h2>
        <button className="btn-primary" onClick={onNew}>
          + New material
        </button>
      </header>

      <div className="mat-list-filters">
        <input
          type="search"
          placeholder="Search name or key…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value)}>
          <option value="">All Types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {labelType(t)}
            </option>
          ))}
        </select>
      </div>

      <SortableTable
        rows={base}
        total={list.length}
        noun="materials"
        columns={columns}
        loading={loading}
        onOpen={onOpen}
        rowClassName={(m) => (m.editable ? 'row-editable' : 'row-readonly')}
      />
    </div>
  )
}
