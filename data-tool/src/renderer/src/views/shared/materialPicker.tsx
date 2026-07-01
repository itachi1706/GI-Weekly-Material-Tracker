import { useEffect, useMemo, useState } from 'react'
import type { MaterialSummary } from '@shared/types'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI']
export function roman(n: number): string {
  return ROMAN[n - 1] ?? String(n)
}

/**
 * Small lazily-loaded material thumbnail. Shows a placeholder box until the image resolves,
 * and when `imagePath` is empty.
 */
export function MatImage({
  rootPath, imagePath, className
}: {
  rootPath: string
  imagePath: string
  className: string
}) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!imagePath) { setSrc(null); return }
    let cancelled = false
    void window.api.materials
      .previewImage(rootPath, { source: 'existing', relativePath: imagePath })
      .then((d) => { if (!cancelled) setSrc(d) })
    return () => { cancelled = true }
  }, [rootPath, imagePath])
  return src
    ? <img className={className} src={src} alt="" />
    : <div className={`${className} mat-img-empty`} />
}

/**
 * Find every member of a material tier set given any one member key.
 *
 * Tier-set materials are stored in the data files as CONSECUTIVE groups of `tierSize` entries in
 * ascending rarity (e.g. Boss_Gems = groups of 4: sliver/fragment/chunk/gemstone; Common_Mob =
 * groups of 3). `summaries` must preserve on-disk order (as `materials.list` returns them).
 * Returns a map of `${slotPrefix}${n}` → key for the whole set, or null if not found.
 */
export function findTierSet(
  summaries: MaterialSummary[],
  selectedKey: string,
  fileKeyword: string,
  tierSize: number,
  slotPrefix: string
): Record<string, string> | null {
  if (tierSize <= 1) return null
  const mats = summaries.filter((m) => m.file.includes(fileKeyword))
  for (let i = 0; i + tierSize <= mats.length; i += tierSize) {
    const set = mats.slice(i, i + tierSize)
    if (set.some((m) => m.key === selectedKey)) {
      const result: Record<string, string> = {}
      set.forEach((m, j) => { result[`${slotPrefix}${j + 1}`] = m.key })
      return result
    }
  }
  return null
}

export interface MaterialPickerPopupProps {
  rootPath: string
  /** Header title, e.g. "Gem II" or "Local specialty". */
  title: string
  /** Substring matched against `MaterialSummary.file` to scope the list. */
  fileKeyword: string
  /** Expected rarity for filtering + star display; pass -1 to show all rarities in the file. */
  expectedRarity: number
  selectedKey: string
  materials: MaterialSummary[]
  onSelect: (key: string) => void
  onClose: () => void
}

/** Searchable popup that lists materials from one file (optionally one rarity), with thumbnails. */
export function MaterialPickerPopup({
  rootPath, title, fileKeyword, expectedRarity, selectedKey, materials, onSelect, onClose
}: MaterialPickerPopupProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return materials
      .filter((m) => m.file.includes(fileKeyword) && (expectedRarity < 0 || m.rarity === expectedRarity))
      .filter((m) => !q || m.name.toLowerCase().includes(q) || m.key.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [materials, fileKeyword, expectedRarity, search])

  return (
    <div className="image-picker-backdrop" onClick={onClose}>
      <div className="mat-picker-popup" onClick={(e) => e.stopPropagation()}>
        <div className="image-picker-header">
          <span>{title}{expectedRarity > 0 ? ` — ${'★'.repeat(expectedRarity)}` : ''}</span>
          <button type="button" className="btn-link" onClick={onClose}>✕ Close</button>
        </div>
        <div className="mat-picker-search-wrap">
          <input
            type="search"
            placeholder="Search name or key…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="mat-picker-list">
          {filtered.length === 0 ? (
            <p className="muted" style={{ padding: '12px 16px' }}>No materials found.</p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`mat-picker-item${m.key === selectedKey ? ' mat-picker-selected' : ''}`}
                onClick={() => onSelect(m.key)}
              >
                <MatImage rootPath={rootPath} imagePath={m.image} className="mat-picker-thumb" />
                <div className="mat-picker-info">
                  <span className="mat-picker-name">{m.name}</span>
                  <span className="mat-picker-meta muted">
                    <span className="mat-picker-rarity">{'★'.repeat(m.rarity)}</span>
                    <span className="mat-picker-key">{m.key}</span>
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
