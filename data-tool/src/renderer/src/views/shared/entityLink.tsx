import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
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
  placeholder: string
}

const MAX_RESULTS = 50

/**
 * Select2-style combobox: type to filter known records (thumbnail + name), pick with mouse or
 * arrow keys + Enter, or press Enter on unmatched text to add it as a custom key. Selected entries
 * render as removable chips. Used for Outfit↔Character cross-references.
 */
export function EntityLinkInput({ rootPath, value, onChange, options, placeholder }: Props) {
  const [inputValue, setInputValue] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Move the entry at `from` to position `to` (used by drag-and-drop and the ‹ › fallback buttons).
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return
    const next = [...value]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  const onDrop = (targetIdx: number) => {
    if (dragIndex != null) move(dragIndex, targetIdx)
    setDragIndex(null)
    setDropIndex(null)
  }

  const byKey = useMemo(() => new Map(options.map((o) => [o.key, o])), [options])

  const filtered = useMemo(() => {
    const q = inputValue.trim().toLowerCase()
    const avail = options.filter((o) => !value.includes(o.key))
    const matched = q
      ? avail.filter((o) => o.name.toLowerCase().includes(q) || o.key.toLowerCase().includes(q))
      : avail
    return matched.sort((a, b) => a.name.localeCompare(b.name)).slice(0, MAX_RESULTS)
  }, [options, value, inputValue])

  const trimmed = inputValue.trim()
  const showCustomRow = trimmed.length > 0 &&
    !filtered.some((o) => o.key.toLowerCase() === trimmed.toLowerCase() || o.name.toLowerCase() === trimmed.toLowerCase())
  const rowCount = filtered.length + (showCustomRow ? 1 : 0)

  useEffect(() => { setHighlight(0) }, [inputValue, open])

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const addKey = (raw: string) => {
    const key = raw.trim()
    if (key && !value.includes(key)) onChange([...value, key])
    setInputValue('')
    setOpen(false)
    inputRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      setHighlight((h) => Math.min(h + 1, Math.max(rowCount - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      if (highlight < filtered.length && filtered[highlight]) addKey(filtered[highlight].key)
      else if (showCustomRow) addKey(trimmed)
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="entity-link" ref={containerRef}>
      <div className="entity-link-tags" onClick={() => inputRef.current?.focus()}>
        {value.map((k, idx) => {
          const opt = byKey.get(k)
          return (
            <span
              key={k}
              className={`tag tag-with-thumb tag-draggable${dragIndex === idx ? ' tag-dragging' : ''}${dropIndex === idx ? ' tag-drop-target' : ''}`}
              draggable
              onDragStart={(e) => { setDragIndex(idx); e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={(e) => { e.preventDefault(); if (dropIndex !== idx) setDropIndex(idx) }}
              onDrop={(e) => { e.preventDefault(); onDrop(idx) }}
              onDragEnd={() => { setDragIndex(null); setDropIndex(null) }}
              title="Drag to reorder"
            >
              <button type="button" className="tag-move" title="Move left"
                onClick={(e) => { e.stopPropagation(); move(idx, idx - 1) }} disabled={idx === 0}>‹</button>
              {opt
                ? <MatImage rootPath={rootPath} imagePath={opt.image} className="tag-thumb" />
                : <span className="tag-thumb tag-thumb-unknown" title="Not found in dataset">?</span>}
              <span className="tag-label">{opt?.name ?? k}</span>
              <button type="button" className="tag-move" title="Move right"
                onClick={(e) => { e.stopPropagation(); move(idx, idx + 1) }} disabled={idx === value.length - 1}>›</button>
              <button type="button" className="tag-remove" onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== k)) }}>
                ×
              </button>
            </span>
          )
        })}
        <input
          ref={inputRef}
          type="text"
          className="entity-link-input"
          placeholder={value.length === 0 ? placeholder : 'Add another…'}
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      {open && rowCount > 0 && (
        <div className="entity-link-dropdown">
          {filtered.map((o, i) => (
            <button
              type="button"
              key={o.key}
              className={`entity-link-option${i === highlight ? ' entity-link-option-active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); addKey(o.key) }}
              onMouseEnter={() => setHighlight(i)}
            >
              <MatImage rootPath={rootPath} imagePath={o.image} className="entity-link-option-thumb" />
              <span className="entity-link-option-info">
                <span className="entity-link-option-name">{o.name}</span>
                {o.sublabel && <span className="entity-link-option-sub muted">{o.sublabel}</span>}
              </span>
            </button>
          ))}
          {showCustomRow && (
            <button
              type="button"
              className={`entity-link-option entity-link-option-custom${highlight === filtered.length ? ' entity-link-option-active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); addKey(trimmed) }}
              onMouseEnter={() => setHighlight(filtered.length)}
            >
              <span className="entity-link-option-thumb entity-link-option-thumb-custom">+</span>
              <span className="entity-link-option-info">
                <span className="entity-link-option-name">Use custom key "{trimmed}"</span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
