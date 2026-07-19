import { useMemo, useState } from 'react'

/**
 * A single reviewable field from a wiki fetch. Display-only: the actual Draft mutation lives in the
 * owning form (Character/Weapon), keyed by `id`. `confirmOnly` rows (locked fields like element/
 * rarity/weapon-type) are shown as a match badge and cannot be applied.
 */
export interface WikiRow {
  id: string
  group: string
  label: string
  /** Current draft value (for side-by-side display). */
  current: string
  /** Value parsed from the wiki. */
  fetched: string
  /** True when `fetched` is non-empty and differs from `current` (drives default-checked). */
  changed: boolean
  /** Non-appliable confirmation row (locked field); `ok` sets the ✓/✗ badge. */
  confirmOnly?: boolean
  ok?: boolean
  /** Extra hint, e.g. "no draft match — will append". */
  note?: string
}

interface Props {
  sourceTitle: string
  rows: WikiRow[]
  onApply: (ids: string[]) => void
  onClose: () => void
  /** Section display order; unknown groups sort last. Defaults to the character grouping. */
  groupOrder?: string[]
}

const DEFAULT_GROUP_ORDER = ['Identity', 'Talents', 'Constellations', 'Images']

function truncate(s: string, n = 140): string {
  const oneLine = s.replaceAll(/\s+/g, ' ').trim()
  return oneLine.length > n ? oneLine.slice(0, n) + '…' : oneLine
}

export default function WikiFillPanel({ sourceTitle, rows, onApply, onClose, groupOrder }: Readonly<Props>) {
  const order = groupOrder ?? DEFAULT_GROUP_ORDER
  const appliable = useMemo(() => rows.filter((r) => !r.confirmOnly), [rows])
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(appliable.filter((r) => r.changed).map((r) => r.id))
  )

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const groups = useMemo(() => {
    const byGroup = new Map<string, WikiRow[]>()
    for (const r of rows) {
      if (!byGroup.has(r.group)) byGroup.set(r.group, [])
      byGroup.get(r.group)!.push(r)
    }
    const rank = (g: string) => {
      const i = order.indexOf(g)
      return i < 0 ? Number.MAX_SAFE_INTEGER : i
    }
    return [...byGroup.entries()].sort((a, b) => rank(a[0]) - rank(b[0]))
  }, [rows, order])

  const setGroup = (groupRows: WikiRow[], on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev)
      for (const r of groupRows) {
        if (r.confirmOnly) continue
        if (on) next.add(r.id)
        else next.delete(r.id)
      }
      return next
    })

  const selectedCount = checked.size

  return (
    <div className="image-picker-backdrop" onClick={onClose}>
      <div className="image-picker-popup wiki-fill-popup" onClick={(e) => e.stopPropagation()}>
        <div className="image-picker-header">
          <span>Auto-fill from wiki — <strong>{sourceTitle}</strong></span>
          <button type="button" className="btn-link" onClick={onClose}>✕ Close</button>
        </div>

        <p className="muted wiki-fill-hint">
          Tick the fields to apply. Nothing is written to disk here — applied values go into the form,
          and the commit preview is still the final gate.
        </p>

        <div className="wiki-fill-body">
          {groups.map(([group, groupRows]) => {
            const appliableInGroup = groupRows.filter((r) => !r.confirmOnly)
            return (
              <section key={group} className="wiki-fill-group">
                <div className="wiki-fill-group-head">
                  <h4>{group}</h4>
                  {appliableInGroup.length > 0 && (
                    <span className="wiki-fill-group-actions">
                      <button type="button" className="btn-link" onClick={() => setGroup(appliableInGroup, true)}>All</button>
                      <button type="button" className="btn-link" onClick={() => setGroup(appliableInGroup, false)}>None</button>
                    </span>
                  )}
                </div>
                <table className="wiki-fill-table">
                  <tbody>
                    {groupRows.map((r) => (
                      <tr key={r.id} className={r.confirmOnly ? 'wiki-fill-confirm' : ''}>
                        <td className="wiki-fill-check">
                          {r.confirmOnly ? (
                            <span className={r.ok ? 'wiki-badge-ok' : 'wiki-badge-bad'}>{r.ok ? '✓' : '✗'}</span>
                          ) : (
                            <input type="checkbox" checked={checked.has(r.id)} onChange={() => toggle(r.id)} />
                          )}
                        </td>
                        <td className="wiki-fill-label">
                          {r.label}
                          {r.note && <span className="wiki-fill-note"> — {r.note}</span>}
                        </td>
                        <td className="wiki-fill-current" title={r.current}>
                          {r.current ? truncate(r.current) : <span className="muted">—</span>}
                        </td>
                        <td className="wiki-fill-arrow">→</td>
                        <td className="wiki-fill-fetched" title={r.fetched}>
                          {r.fetched ? truncate(r.fetched) : <span className="muted">(none)</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )
          })}
        </div>

        <footer className="wiki-fill-actions">
          <button type="button" className="btn-primary" disabled={selectedCount === 0}
            onClick={() => onApply([...checked])}>
            Apply {selectedCount > 0 ? `${selectedCount} ` : ''}selected
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        </footer>
      </div>
    </div>
  )
}
