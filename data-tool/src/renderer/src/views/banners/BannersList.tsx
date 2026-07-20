import { useEffect, useMemo, useState } from 'react'
import type { BannerSummary, BannerType } from '@shared/types'
import { MatImage } from '../shared/materialPicker'

const TYPE_LABEL: Record<BannerType, string> = {
  character: 'Character', weapon: 'Weapon', standard: 'Standard', chronicled: 'Chronicled'
}

// How many rows to paint immediately; the rest stream in over subsequent frames so switching to
// the list (or returning from an edit) doesn't block on rendering all ~170 rows at once.
const CHUNK = 60

// Module-level cache of the key → image-path map (characters + weapons), keyed by rootPath, so
// re-mounting the list doesn't re-fetch and rebuild 270+ summaries every time.
const refMapCache = new Map<string, Map<string, string>>()

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
}: Readonly<Props>) {
  const [sortCol, setSortCol] = useState<SortCol>('start')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  // key → image path, for rate-up thumbnails. Seeded synchronously from the module cache if present.
  const [imgByKey, setImgByKey] = useState<Map<string, string>>(() => refMapCache.get(rootPath) ?? new Map())
  const [refsLoaded, setRefsLoaded] = useState(() => refMapCache.has(rootPath))

  useEffect(() => {
    let cancelled = false
    // Stale-while-revalidate: render instantly from the module cache if present, but ALWAYS re-fetch
    // in the background and update. This lets "?" rate-up tiles (a character/weapon that had no image,
    // or didn't exist, when the cache was first built) resolve once its image is added — the previous
    // cache-and-return-forever behavior left them stuck.
    const cached = refMapCache.get(rootPath)
    if (cached) { setImgByKey(cached); setRefsLoaded(true) }
    void Promise.all([
      window.api.characters.list(rootPath),
      window.api.weapons.list(rootPath)
    ]).then(([chars, weapons]) => {
      const m = new Map<string, string>()
      for (const c of chars) m.set(c.key, c.image)
      for (const w of weapons) m.set(w.key, w.image)
      refMapCache.set(rootPath, m)
      if (cancelled) return
      setImgByKey(m)
      setRefsLoaded(true)
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
      let cmp = 0
      if (av < bv) cmp = -1
      else if (av > bv) cmp = 1
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [list, query, bannerType, sortCol, sortDir])

  // Progressive rendering: reset to one chunk whenever the result set changes, then grow per frame.
  const [renderCount, setRenderCount] = useState(CHUNK)
  useEffect(() => { setRenderCount(CHUNK) }, [filtered])
  useEffect(() => {
    if (renderCount >= filtered.length) return
    const id = requestAnimationFrame(() =>
      setRenderCount((c) => Math.min(c + CHUNK, filtered.length))
    )
    return () => cancelAnimationFrame(id)
  }, [renderCount, filtered.length])

  const visible = filtered.slice(0, renderCount)

  return (
    <div className="mat-list">
      <header className="mat-list-head">
        <h2>{TYPE_LABEL[bannerType]} Banners</h2>
        <button type="button" className="btn-primary" onClick={onNew}>+ New {TYPE_LABEL[bannerType].toLowerCase()} banner</button>
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
                <th><button type="button" className="th-sort" onClick={() => toggleSort('name')}>Name {sortIndicator('name')}</button></th>
                <th><button type="button" className="th-sort" onClick={() => toggleSort('version')}>Version {sortIndicator('version')}</button></th>
                <th><button type="button" className="th-sort" onClick={() => toggleSort('start')}>Start {sortIndicator('start')}</button></th>
                <th><button type="button" className="th-sort" onClick={() => toggleSort('end')}>End {sortIndicator('end')}</button></th>
                <th>Rate-up</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((b) => (
                <tr key={`${b.bannerType}:${b.index}:${b.start}`} onClick={() => onOpen(b)} className="mat-row">
                  <td>
                    {b.image
                      ? <MatImage rootPath={rootPath} imagePath={b.image} className="mat-thumb" />
                      : <div className="mat-thumb mat-thumb-empty" />}
                  </td>
                  <td>{b.name}</td>
                  <td>{b.version ? b.version.toFixed(1) : ''}</td>
                  <td className="banner-date">{b.start.replace('T', ' ').replace('+08', '')}</td>
                  <td className="banner-date">{b.end.replace('T', ' ').replace('+08', '')}</td>
                  <td>
                    <div className="banner-rateup-thumbs">
                      {b.rateup.length === 0
                        ? <span className="muted">—</span>
                        : b.rateup.map((k) => {
                          const img = imgByKey.get(k)
                          // Consistent with EntityLinkInput: unknown keys show a "?" once refs load.
                          if (refsLoaded && img === undefined) {
                            return (
                              <span key={k} className="banner-rateup-img mat-img-empty banner-rateup-unknown"
                                title={`${k} (not found)`}>?</span>
                            )
                          }
                          return (
                            <span key={k} className="banner-rateup-thumb" title={k}>
                              <MatImage rootPath={rootPath} imagePath={img ?? ''} className="banner-rateup-img" />
                            </span>
                          )
                        })}
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
