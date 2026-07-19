import { useMemo, useState } from 'react'
import type { WeaponSummary } from '@shared/types'
import { MatImage } from '../shared/materialPicker'

const WEAPON_TYPES = ['Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'] as const

type SortCol = 'name' | 'type' | 'rarity' | 'released'

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
}: Props) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

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
      (w) =>
        (!typeFilter || w.type === typeFilter) &&
        (!q || w.name.toLowerCase().includes(q) || w.key.toLowerCase().includes(q))
    )
    if (!sortCol) return base
    return [...base].sort((a, b) => {
      let av: string | number
      let bv: string | number
      if (sortCol === 'rarity') { av = a.rarity; bv = b.rarity }
      else if (sortCol === 'released') { av = a.released ? 1 : 0; bv = b.released ? 1 : 0 }
      else { av = a[sortCol].toLowerCase(); bv = b[sortCol].toLowerCase() }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [list, query, typeFilter, sortCol, sortDir])

  return (
    <div className="mat-list">
      <header className="mat-list-head">
        <h2>Weapons</h2>
        <button className="btn-primary" onClick={onNew}>+ New weapon</button>
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

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="mat-table-wrap">
          <table className="mat-table">
            <thead>
              <tr>
                <th></th>
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
                  <button className="th-sort" onClick={() => toggleSort('rarity')}>
                    Rarity {sortIndicator('rarity')}
                  </button>
                </th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('released')}>
                    Released {sortIndicator('released')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr key={`${w.file}:${w.key}`} onClick={() => onOpen(w)} className="mat-row">
                  <td>
                    <MatImage rootPath={rootPath} imagePath={w.image ?? ''} className="mat-thumb" />
                  </td>
                  <td>{w.name}</td>
                  <td><span className="pill">{w.type}</span></td>
                  <td>{'★'.repeat(w.rarity)}</td>
                  <td>
                    <span className={`pill ${w.released ? 'pill-ok' : ''}`}>
                      {w.released ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: '16px 0' }}>
                    No weapons match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mat-list-count muted">{filtered.length} of {list.length} weapons</p>
    </div>
  )
}
