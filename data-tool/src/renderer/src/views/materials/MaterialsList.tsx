import { useMemo, useState } from 'react'
import type { MaterialSummary } from '@shared/types'
import { MatImage } from '../shared/materialPicker'

const INNER_TYPE_LABELS: Record<string, string> = {
  local_speciality: 'Local Speciality',
  mob_drops: 'Mob Drops',
  boss_drops: 'Boss Drops',
  domain_material: 'Domain Material'
}

function labelType(key: string): string {
  return INNER_TYPE_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

type SortCol = 'name' | 'type' | 'file' | 'rarity' | 'released'

// (thumbnails now use the shared, lazy + IPC-batched MatImage from ./materialPicker)

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
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const types = useMemo(() => Array.from(new Set(list.map((m) => m.innerType))).sort(), [list])

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortCol(null); setSortDir('asc') }
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sortIndicator = (col: SortCol) => {
    if (sortCol !== col) return <span className="sort-indicator muted">↕</span>
    return <span className="sort-indicator">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = list.filter(
      (m) =>
        (!typeFilter || m.innerType === typeFilter) &&
        (!q || m.name.toLowerCase().includes(q) || m.key.toLowerCase().includes(q))
    )
    if (!sortCol) return base
    return [...base].sort((a, b) => {
      let av: string | number
      let bv: string | number
      switch (sortCol) {
        case 'name':
          av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break
        case 'type':
          av = labelType(a.innerType).toLowerCase(); bv = labelType(b.innerType).toLowerCase(); break
        case 'file':
          av = a.file.replace(/^Materials-|\.json$/g, '').toLowerCase()
          bv = b.file.replace(/^Materials-|\.json$/g, '').toLowerCase()
          break
        case 'rarity':
          av = a.rarity; bv = b.rarity; break
        case 'released':
          av = a.released ? 0 : 1; bv = b.released ? 0 : 1; break
        default: return 0
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [list, query, typeFilter, sortCol, sortDir])

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
        <span className="mat-list-count">
          {loading ? 'Loading…' : `${filtered.length} of ${list.length}`}
        </span>
      </div>

      <div className="mat-table-wrap">
        <table className="mat-table">
          <thead>
            <tr>
              <th style={{ width: 44 }}></th>
              <th>
                <button className="th-sort" onClick={() => toggleSort('name')}>
                  Name {sortIndicator('name')}
                </button>
              </th>
              <th>
                <button className="th-sort" onClick={() => toggleSort('type')}>
                  Type {sortIndicator('type')}
                </button>
              </th>
              <th>
                <button className="th-sort" onClick={() => toggleSort('file')}>
                  File {sortIndicator('file')}
                </button>
              </th>
              <th className="num">
                <button className="th-sort" onClick={() => toggleSort('rarity')}>
                  Rarity {sortIndicator('rarity')}
                </button>
              </th>
              <th>
                <button className="th-sort" onClick={() => toggleSort('released')}>
                  Released {sortIndicator('released')}
                </button>
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr
                key={`${m.file}:${m.key}`}
                className={m.editable ? 'row-editable' : 'row-readonly'}
                onClick={() => onOpen(m)}
              >
                <td>
                  <MatImage rootPath={rootPath} imagePath={m.image ?? ''} className="mat-thumb" />
                </td>
                <td>
                  <div className="mat-name">{m.name}</div>
                  <div className="mat-key">{m.key}</div>
                </td>
                <td>{labelType(m.innerType)}</td>
                <td className="mat-file">{m.file.replace(/^Materials-|\.json$/g, '')}</td>
                <td className="num">{m.rarity}</td>
                <td>{m.released ? '✓' : '—'}</td>
                <td>
                  {m.editable ? (
                    <span className="pill pill-ok">edit</span>
                  ) : (
                    <span className="pill">view</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
