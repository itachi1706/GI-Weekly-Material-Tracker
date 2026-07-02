import { useMemo, useState } from 'react'
import { MatImage } from './materialPicker'

export interface LinkOption {
  key: string
  name: string
  image: string
  /** Small qualifier shown in the dropdown, e.g. an element or outfit-set label. */
  sublabel?: string
}

interface Props {
  rootPath: string
  value: string[]
  onChange: (next: string[]) => void
  /** Known entities to offer in the dropdown (already-selected keys are filtered out). */
  options: LinkOption[]
  /** Placeholder shown as the dropdown's blank option, e.g. "+ Add existing character…". */
  addLabel: string
  /** Placeholder for the free-text fallback input. */
  customPlaceholder: string
}

/**
 * Multi-select "linked entity" editor: pick from known records (with thumbnail) or type an
 * arbitrary key for a record not yet in the dataset. Used for Outfit↔Character cross-references.
 */
export function EntityLinkInput({ rootPath, value, onChange, options, addLabel, customPlaceholder }: Props) {
  const [customInput, setCustomInput] = useState('')

  const byKey = useMemo(() => new Map(options.map((o) => [o.key, o])), [options])
  const available = useMemo(
    () => options.filter((o) => !value.includes(o.key)).sort((a, b) => a.name.localeCompare(b.name)),
    [options, value]
  )

  const addKey = (raw: string) => {
    const key = raw.trim()
    if (key && !value.includes(key)) onChange([...value, key])
  }

  return (
    <div className="tags-input">
      {value.length > 0 && (
        <div className="tags-list">
          {value.map((k) => {
            const opt = byKey.get(k)
            return (
              <span key={k} className="tag tag-with-thumb">
                {opt
                  ? <MatImage rootPath={rootPath} imagePath={opt.image} className="tag-thumb" />
                  : <span className="tag-thumb tag-thumb-unknown" title="Not found in dataset">?</span>}
                <span className="tag-label">{opt?.name ?? k}</span>
                <button type="button" className="tag-remove" onClick={() => onChange(value.filter((x) => x !== k))}>
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}
      <div className="tags-add">
        <select
          value=""
          onChange={(e) => { if (e.target.value) addKey(e.target.value) }}
        >
          <option value="">{addLabel}</option>
          {available.map((o) => (
            <option key={o.key} value={o.key}>{o.name}{o.sublabel ? ` (${o.sublabel})` : ''}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder={customPlaceholder}
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addKey(customInput); setCustomInput('') }
          }}
        />
        <button type="button" className="btn-secondary" disabled={!customInput.trim()}
          onClick={() => { addKey(customInput); setCustomInput('') }}>
          Add
        </button>
      </div>
    </div>
  )
}
