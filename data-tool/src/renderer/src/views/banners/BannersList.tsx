import { useEffect, useMemo, useState } from 'react'
import type { BannerSummary, BannerType } from '@shared/types'
import { MatImage } from '../shared/materialPicker'

const TYPE_LABEL: Record<BannerType, string> = {
  character: 'Character', weapon: 'Weapon', standard: 'Standard', chronicled: 'Chronicled'
}

type SortCol = 'name' | 'version' | 'start' | 'end'

interface Props {
  rootPath: string
  list: BannerSummary[]
  loading: boolean
  bannerType: BannerType
  query: string
  onQueryChange: (v: string) => void
  onNew: () => void
  onOpen: (row: BannerSummary) => void
}

export default function BannersList({
  rootPath, list, loading, bannerType, query, onQueryChange, onNew, onOpen
}: Props) {
  const [sortCol, setSortCol] = useState<SortCol>('start')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  // key → image path, resolved across characters + weapons for rate-up thumbnails.
  const [imgByKey, setImgByKey] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      window.api.characters.list(rootPath),
      window.api.weapons.list(rootPath)
    ]).then(([chars, weapons]) => {
      if (cancelled) return
      const m = new Map<string, string>()
      for (const c of chars) m.set(c.key, c.image)
      for (const w of weapons) m.set(w.key, w.image)
      setImgByKey(m)
    })
    return () => { cancelled = true }
  }, [rootPath])

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir(col === 'name' ? 'asc' : 'desc') }
  }
  const sortIndicator = (col: SortCol) =>
    sortCol !== col ? <span className="sort-indicator muted">↕</span>
      : <span className="sort-indicator">{sortDir === 'asc' ? '↑' : '↓'}</span>

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = list.filter((b) => b.bannerType === bannerType && (!q || b.name.toLowerCase().includes(q)))
    return [...base].sort((a, b) => {
      let av: string | number, bv: string | number
      if (sortCol === 'version') { av = a.version; bv = b.version }
      else { av = a[sortCol].toLowerCase?.() ?? a[sortCol]; bv = b[sortCol].toLowerCase?.() ?? b[sortCol] }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [list, query, bannerType, sortCol, sortDir])

  return (
    <div className="mat-list">
      <header className="mat-list-head">
        <h2>{TYPE_LABEL[bannerType]} Banners</h2>
        <button className="btn-primary" onClick={onNew}>+ New {TYPE_LABEL[bannerType].toLowerCase()} banner</button>
      </header>

      <div className="mat-list-filters">
        <input type="search" placeholder="Search name…" value={query}
          onChange={(e) => onQueryChange(e.target.value)} />
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
                  <td>{b.version || ''}</td>
                  <td className="banner-date">{b.start.replace('T', ' ').replace('+08', '')}</td>
                  <td className="banner-date">{b.end.replace('T', ' ').replace('+08', '')}</td>
                  <td>
                    <div className="banner-rateup-thumbs">
                      {b.rateup.length === 0
                        ? <span className="muted">—</span>
                        : b.rateup.map((k) => (
                          <span key={k} className="banner-rateup-thumb" title={k}>
                            <MatImage rootPath={rootPath} imagePath={imgByKey.get(k) ?? ''} className="banner-rateup-img" />
                          </span>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="muted" style={{ padding: '16px 0' }}>No banners match your filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mat-list-count muted">{filtered.length} {TYPE_LABEL[bannerType].toLowerCase()} banners</p>
    </div>
  )
}

function BannerThumb({ rootPath, image }: { rootPath: string; image: string }) {
  return image
    ? <MatImage rootPath={rootPath} imagePath={image} className="mat-thumb" />
    : <div className="mat-thumb mat-thumb-empty" />
}
