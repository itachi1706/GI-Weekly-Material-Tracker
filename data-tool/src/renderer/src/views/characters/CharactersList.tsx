import { useMemo } from 'react'
import type { CharacterSummary } from '@shared/types'
import { MatImage } from '../shared/materialPicker'
import SortableTable, { type Column } from '../shared/SortableTable'

const ELEMENTS = ['Anemo', 'Cryo', 'Dendro', 'Electro', 'Geo', 'Hydro', 'Pyro'] as const
const TRAVELER_FILTER = '__traveler__'
const TRAVELER_FILE = 'Characters-Traveler.json'
const isTraveler = (c: CharacterSummary) => c.file === TRAVELER_FILE

interface Props {
  rootPath: string
  list: CharacterSummary[]
  loading: boolean
  query: string
  elementFilter: string
  onQueryChange: (v: string) => void
  onElementFilterChange: (v: string) => void
  onNew: () => void
  onOpen: (row: CharacterSummary) => void
}

export default function CharactersList({
  rootPath, list, loading,
  query, elementFilter, onQueryChange, onElementFilterChange,
  onNew, onOpen
}: Props) {
  const base = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.key.toLowerCase().includes(q)) return false
      if (!elementFilter) return true
      // "Traveler" shows only the Traveler file; element tabs exclude Travelers so they don't mix in.
      if (elementFilter === TRAVELER_FILTER) return isTraveler(c)
      return c.element === elementFilter && !isTraveler(c)
    })
  }, [list, query, elementFilter])

  const columns: Column<CharacterSummary>[] = useMemo(() => [
    { key: '_thumb', header: '', sortable: false,
      render: (c) => <MatImage rootPath={rootPath} imagePath={c.image ?? ''} className="mat-thumb" /> },
    { key: 'name', header: 'Name',
      render: (c) => (
        <>{c.name}{isTraveler(c) && <span className="pill" style={{ marginLeft: 6 }}>Traveler</span>}</>
      ) },
    { key: 'element', header: 'Element', render: (c) => <span className="pill">{c.element}</span> },
    { key: 'weapon', header: 'Weapon', render: (c) => c.weapon },
    { key: 'rarity', header: 'Rarity', sortValue: (c) => c.rarity, render: (c) => '★'.repeat(c.rarity) },
    { key: 'released', header: 'Released', sortValue: (c) => (c.released ? 1 : 0),
      render: (c) => (
        <span className={`pill ${c.released ? 'pill-ok' : ''}`}>{c.released ? 'Yes' : 'No'}</span>
      ) }
  ], [rootPath])

  return (
    <div className="mat-list">
      <header className="mat-list-head">
        <h2>Characters</h2>
        <button className="btn-primary" onClick={onNew}>+ New character</button>
      </header>

      <div className="mat-list-filters">
        <input
          type="search"
          placeholder="Search name or key…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <select value={elementFilter} onChange={(e) => onElementFilterChange(e.target.value)}>
          <option value="">All elements</option>
          {ELEMENTS.map((el) => (
            <option key={el} value={el}>{el}</option>
          ))}
          <option value={TRAVELER_FILTER}>Traveler</option>
        </select>
      </div>

      <SortableTable
        rows={base}
        total={list.length}
        noun="characters"
        columns={columns}
        loading={loading}
        onOpen={onOpen}
      />
    </div>
  )
}
