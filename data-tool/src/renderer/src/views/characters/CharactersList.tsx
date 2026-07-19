import { useMemo, useState } from 'react'
import type { CharacterSummary } from '@shared/types'
import { MatImage } from '../shared/materialPicker'

const ELEMENTS = ['Anemo', 'Cryo', 'Dendro', 'Electro', 'Geo', 'Hydro', 'Pyro'] as const
const TRAVELER_FILTER = '__traveler__'
const TRAVELER_FILE = 'Characters-Traveler.json'
const isTraveler = (c: CharacterSummary) => c.file === TRAVELER_FILE

type SortCol = 'name' | 'element' | 'weapon' | 'rarity' | 'released'

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
    const base = list.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.key.toLowerCase().includes(q)) return false
      if (!elementFilter) return true
      // "Traveler" shows only the Traveler file; element tabs exclude Travelers so they don't mix in.
      if (elementFilter === TRAVELER_FILTER) return isTraveler(c)
      return c.element === elementFilter && !isTraveler(c)
    })
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
  }, [list, query, elementFilter, sortCol, sortDir])

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
                  <button className="th-sort" onClick={() => toggleSort('element')}>
                    Element {sortIndicator('element')}
                  </button>
                </th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('weapon')}>
                    Weapon {sortIndicator('weapon')}
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
              {filtered.map((c) => (
                <tr key={`${c.file}:${c.key}`} onClick={() => onOpen(c)} className="mat-row">
                  <td>
                    <MatImage rootPath={rootPath} imagePath={c.image ?? ''} className="mat-thumb" />
                  </td>
                  <td>{c.name}{isTraveler(c) && <span className="pill" style={{ marginLeft: 6 }}>Traveler</span>}</td>
                  <td><span className="pill">{c.element}</span></td>
                  <td>{c.weapon}</td>
                  <td>{'★'.repeat(c.rarity)}</td>
                  <td>
                    <span className={`pill ${c.released ? 'pill-ok' : ''}`}>
                      {c.released ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: '16px 0' }}>
                    No characters match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mat-list-count muted">{filtered.length} of {list.length} characters</p>
    </div>
  )
}
