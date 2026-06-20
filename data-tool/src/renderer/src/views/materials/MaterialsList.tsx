import { useMemo, useState } from 'react'
import type { MaterialSummary } from '@shared/types'

interface Props {
  list: MaterialSummary[]
  loading: boolean
  onNew: () => void
  onOpen: (row: MaterialSummary) => void
}

export default function MaterialsList({ list, loading, onNew, onOpen }: Props) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const innerTypes = useMemo(
    () => Array.from(new Set(list.map((m) => m.innerType))).sort(),
    [list]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter(
      (m) =>
        (!typeFilter || m.innerType === typeFilter) &&
        (!q || m.name.toLowerCase().includes(q) || m.key.toLowerCase().includes(q))
    )
  }, [list, query, typeFilter])

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
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All innerTypes</option>
          {innerTypes.map((t) => (
            <option key={t} value={t}>
              {t}
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
              <th>Name</th>
              <th>innerType</th>
              <th>File</th>
              <th className="num">Rarity</th>
              <th>Released</th>
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
                  <div className="mat-name">{m.name}</div>
                  <div className="mat-key">{m.key}</div>
                </td>
                <td>{m.innerType}</td>
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
