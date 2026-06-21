import { useEffect, useMemo, useState } from 'react'
import type { OutfitSummary, ImagePlan } from '@shared/types'

type SortCol = 'name' | 'character' | 'file' | 'rarity' | 'released'

/** "Outfits-Standard.json" → "Standard" */
function fileLabel(file: string): string {
  return file.replace(/^Outfits-|\.json$/g, '')
}

function OutfitThumb({ rootPath, image }: { rootPath: string; image: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!image) return
    const plan: ImagePlan = { source: 'existing', relativePath: image }
    void window.api.materials.previewImage(rootPath, plan).then(setSrc)
  }, [rootPath, image])

  return src ? (
    <img className="mat-thumb" src={src} alt="" />
  ) : (
    <div className="mat-thumb mat-thumb-empty" />
  )
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
}: Props) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const files = useMemo(() => Array.from(new Set(list.map((o) => o.file))).sort(), [list])

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
      (o) =>
        (!fileFilter || o.file === fileFilter) &&
        (!q ||
          o.name.toLowerCase().includes(q) ||
          o.character.toLowerCase().includes(q) ||
          o.key.toLowerCase().includes(q))
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
  }, [list, query, fileFilter, sortCol, sortDir])

  return (
    <div className="mat-list">
      <header className="mat-list-head">
        <h2>Outfits</h2>
        <button className="btn-primary" onClick={onNew}>+ New outfit</button>
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
                  <button className="th-sort" onClick={() => toggleSort('character')}>
                    Character {sortIndicator('character')}
                  </button>
                </th>
                <th>Type</th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('file')}>
                    Set {sortIndicator('file')}
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
              {filtered.map((o) => (
                <tr key={`${o.file}:${o.key}`} onClick={() => onOpen(o)} className="mat-row">
                  <td>
                    <OutfitThumb rootPath={rootPath} image={o.image} />
                  </td>
                  <td>{o.name}</td>
                  <td>{o.character}</td>
                  <td><span className="pill">{o.type}</span></td>
                  <td><span className="pill">{fileLabel(o.file)}</span></td>
                  <td>{'★'.repeat(o.rarity)}</td>
                  <td>
                    <span className={`pill ${o.released ? 'pill-ok' : ''}`}>
                      {o.released ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ padding: '16px 0' }}>
                    No outfits match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mat-list-count muted">{filtered.length} of {list.length} outfits</p>
    </div>
  )
}
