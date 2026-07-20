import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'

/**
 * One column of a {@link SortableTable}. `key` is a free string (a stable sort id + React key), NOT
 * `keyof T` — some columns sort on a derived value (e.g. a label) or are display-only (thumbnails).
 */
export interface Column<T> {
  key: string
  header: ReactNode
  /** Default true. When false the header is plain text (no sort button, no indicator). */
  sortable?: boolean
  thClassName?: string
  tdClassName?: string
  thStyle?: CSSProperties
  /**
   * Value to sort this column by. Numbers compare numerically, strings lexically. Default:
   * `String(row[key] ?? '').toLowerCase()` — valid only when `key` names a real string prop;
   * otherwise supply this (or set `sortable: false`).
   */
  sortValue?: (row: T) => string | number
  render: (row: T) => ReactNode
}

type Dir = 'asc' | 'desc'

/** Owns 3-state sort (asc → desc → off) over `rows`, sorted by the active column's `sortValue`. */
function useSortableList<T>(rows: T[], columns: Column<T>[]) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [dir, setDir] = useState<Dir>('asc')

  const toggle = (key: string): void => {
    if (sortKey === key) {
      if (dir === 'asc') setDir('desc')
      else { setSortKey(null); setDir('asc') }
    } else {
      setSortKey(key)
      setDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const col = columns.find((c) => c.key === sortKey)
    if (!col) return rows
    const valueOf =
      col.sortValue ??
      ((row: T) => {
        const raw = (row as Record<string, unknown>)[col.key]
        return raw == null || typeof raw === 'object' ? '' : String(raw).toLowerCase()
      })
    return [...rows].sort((a, b) => {
      const av = valueOf(a)
      const bv = valueOf(b)
      let cmp = 0
      if (av < bv) cmp = -1
      else if (av > bv) cmp = 1
      return dir === 'asc' ? cmp : -cmp
    })
  }, [rows, columns, sortKey, dir])

  return { sorted, sortKey, dir, toggle }
}

export interface SortableTableProps<T extends { key: string; file: string }> {
  /** Already domain-filtered rows (unsorted); the table applies sorting. */
  rows: T[]
  /** Total unfiltered count, for the "N of M {noun}" footer. */
  total: number
  /** Plural entity noun — drives the count footer and empty-state message. */
  noun: string
  columns: Column<T>[]
  loading: boolean
  onOpen: (row: T) => void
  /** Row `<tr>` className. Default `'mat-row'`. */
  rowClassName?: string | ((row: T) => string)
  /** Unique row key. Default `` `${file}:${key}` ``. */
  rowKey?: (row: T) => string
}

/** Shared sortable list table used by the character/weapon/outfit/material list views. */
export default function SortableTable<T extends { key: string; file: string }>({
  rows, total, noun, columns, loading, onOpen,
  rowClassName = 'mat-row',
  rowKey = (row) => `${row.file}:${row.key}`
}: Readonly<SortableTableProps<T>>) {
  const { sorted, sortKey, dir, toggle } = useSortableList(rows, columns)

  const indicator = (key: string): ReactNode =>
    sortKey !== key
      ? <span className="sort-indicator muted">↕</span>
      : <span className="sort-indicator">{dir === 'asc' ? '↑' : '↓'}</span>

  const classFor = (row: T): string =>
    typeof rowClassName === 'function' ? rowClassName(row) : rowClassName

  return (
    <>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="mat-table-wrap">
          <table className="mat-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={c.thClassName} style={c.thStyle}>
                    {c.sortable === false ? (
                      c.header
                    ) : (
                      <button type="button" className="th-sort" onClick={() => toggle(c.key)}>
                        {c.header} {indicator(c.key)}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={rowKey(row)} className={classFor(row)} onClick={() => onOpen(row)}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.tdClassName}>{c.render(row)}</td>
                  ))}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="muted" style={{ padding: '16px 0' }}>
                    No {noun} match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mat-list-count muted">{sorted.length} of {total} {noun}</p>
    </>
  )
}
