import { useEffect, useMemo, useState } from 'react'
import type { MaterialSummary, ImagePlan } from '@shared/types'

const INNER_TYPE_LABELS: Record<string, string> = {
  local_speciality: 'Local Speciality',
  mob_drops: 'Mob Drops',
  boss_drops: 'Boss Drops',
  domain_material: 'Domain Material'
}

function labelType(key: string): string {
  return INNER_TYPE_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface Props {
  rootPath: string
  list: MaterialSummary[]
  loading: boolean
  onNew: () => void
  onOpen: (row: MaterialSummary) => void
}

/** Lazy-loads a single thumbnail via IPC and renders it. */
function MatThumb({ rootPath, image }: { rootPath: string; image: string }) {
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

export default function MaterialsList({ rootPath, list, loading, onNew, onOpen }: Props) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const types = useMemo(() => Array.from(new Set(list.map((m) => m.innerType))).sort(), [list])

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
              <th>Name</th>
              <th>Type</th>
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
                  <MatThumb rootPath={rootPath} image={m.image} />
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
