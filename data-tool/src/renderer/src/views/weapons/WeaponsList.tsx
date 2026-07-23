import { useMemo } from 'react'
import type { WeaponSummary } from '@shared/types'
import { MatImage } from '../shared/materialPicker'
import SortableTable, { type Column } from '../shared/SortableTable'

const WEAPON_TYPES = ['Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'] as const

interface Props {
  rootPath: string
  list: WeaponSummary[]
  loading: boolean
  query: string
  typeFilter: string
  onQueryChange: (v: string) => void
  onTypeFilterChange: (v: string) => void
  onNew: () => void
  onOpen: (row: WeaponSummary) => void
}

export default function WeaponsList({
  rootPath, list, loading,
  query, typeFilter, onQueryChange, onTypeFilterChange,
  onNew, onOpen
}: Readonly<Props>) {
  const base = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter(
      (w) =>
        (!typeFilter || w.type === typeFilter) &&
        (!q || w.name.toLowerCase().includes(q) || w.key.toLowerCase().includes(q))
    )
  }, [list, query, typeFilter])

  const columns: Column<WeaponSummary>[] = useMemo(() => [
    { key: '_thumb', header: '', sortable: false,
      render: (w) => <MatImage rootPath={rootPath} imagePath={w.image ?? ''} className="mat-thumb" /> },
    { key: 'name', header: 'Name', render: (w) => w.name },
    { key: 'type', header: 'Type', render: (w) => <span className="pill">{w.type}</span> },
    { key: 'rarity', header: 'Rarity', sortValue: (w) => w.rarity, render: (w) => '★'.repeat(w.rarity) },
    { key: 'released', header: 'Released', sortValue: (w) => (w.released ? 1 : 0),
      render: (w) => (
        <span className={`pill ${w.released ? 'pill-ok' : ''}`}>{w.released ? 'Yes' : 'No'}</span>
      ) }
  ], [rootPath])

  return (
    <div className="mat-list">
      <header className="mat-list-head">
        <h2>Weapons</h2>
        <button type="button" className="btn-primary" onClick={onNew}>+ New weapon</button>
      </header>

      <div className="mat-list-filters">
        <input
          type="search"
          placeholder="Search name or key…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value)}>
          <option value="">All types</option>
          {WEAPON_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <SortableTable
        rows={base}
        total={list.length}
        noun="weapons"
        columns={columns}
        loading={loading}
        onOpen={onOpen}
      />
    </div>
  )
}
