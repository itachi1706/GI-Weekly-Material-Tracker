import { useEffect, useMemo, useState } from 'react'
import type { BannerSummary, BannerType, ImagePlan } from '@shared/types'

const TYPES: BannerType[] = ['character', 'weapon', 'standard', 'chronicled']
const TYPE_LABEL: Record<BannerType, string> = {
  character: 'Character', weapon: 'Weapon', standard: 'Standard', chronicled: 'Chronicled'
}

type SortCol = 'name' | 'type' | 'version' | 'start' | 'end'

function BannerThumb({ rootPath, image }: { rootPath: string; image: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!image) return
    const plan: ImagePlan = { source: 'existing', relativePath: image }
    void window.api.materials.previewImage(rootPath, plan).then(setSrc)
  }, [rootPath, image])
  return src ? <img className="mat-thumb" src={src} alt="" /> : <div className="mat-thumb mat-thumb-empty" />
}

interface Props {
  rootPath: string
  list: BannerSummary[]
  loading: boolean
  query: string
  typeFilter: string
  onQueryChange: (v: string) => void
  onTypeFilterChange: (v: string) => void
  onNew: () => void
  onOpen: (row: BannerSummary) => void
}

export default function BannersList({
  rootPath, list, loading,
  query, typeFilter, onQueryChange, onTypeFilterChange, onNew, onOpen
}: Props) {
  const [sortCol, setSortCol] = useState<SortCol>('start')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir(col === 'start' || col === 'end' || col === 'version' ? 'desc' : 'asc') }
  }
  const sortIndicator = (col: SortCol) =>
    sortCol !== col ? <span className="sort-indicator muted">↕</span>
      : <span className="sort-indicator">{sortDir === 'asc' ? '↑' : '↓'}</span>

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = list.filter(
      (b) => (!typeFilter || b.bannerType === typeFilter) && (!q || b.name.toLowerCase().includes(q))
    )
    return [...base].sort((a, b) => {
      let av: string | number, bv: string | number
      if (sortCol === 'version') { av = a.version; bv = b.version }
      else if (sortCol === 'type') { av = a.bannerType; bv = b.bannerType }
      else { av = a[sortCol].toLowerCase?.() ?? a[sortCol]; bv = b[sortCol].toLowerCase?.() ?? b[sortCol] }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [list, query, typeFilter, sortCol, sortDir])

  return (
    <div className="mat-list">
      <header className="mat-list-head">
        <h2>Banners</h2>
        <button className="btn-primary" onClick={onNew}>+ New banner</button>
      </header>

      <div className="mat-list-filters">
        <input type="search" placeholder="Search name…" value={query}
          onChange={(e) => onQueryChange(e.target.value)} />
        <select value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value)}>
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
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
                <th><button className="th-sort" onClick={() => toggleSort('name')}>Name {sortIndicator('name')}</button></th>
                <th><button className="th-sort" onClick={() => toggleSort('type')}>Type {sortIndicator('type')}</button></th>
                <th><button className="th-sort" onClick={() => toggleSort('version')}>Version {sortIndicator('version')}</button></th>
                <th><button className="th-sort" onClick={() => toggleSort('start')}>Start {sortIndicator('start')}</button></th>
                <th><button className="th-sort" onClick={() => toggleSort('end')}>End {sortIndicator('end')}</button></th>
                <th>Rate-up</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={`${b.bannerType}:${b.index}:${b.start}`} onClick={() => onOpen(b)} className="mat-row">
                  <td><BannerThumb rootPath={rootPath} image={b.image} /></td>
                  <td>{b.name}</td>
                  <td><span className="pill">{TYPE_LABEL[b.bannerType]}</span></td>
                  <td>{b.version || ''}</td>
                  <td className="banner-date">{b.start.replace('T', ' ').replace('+08', '')}</td>
                  <td className="banner-date">{b.end.replace('T', ' ').replace('+08', '')}</td>
                  <td className="banner-rateup">{b.rateup.join(', ')}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ padding: '16px 0' }}>No banners match your filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mat-list-count muted">{filtered.length} of {list.length} banners</p>
    </div>
  )
}
