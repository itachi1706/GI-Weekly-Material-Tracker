import { useState } from 'react'
import type { MaterialRecord, InsertModeName } from '@shared/types'
import { deriveKey, resolveImageFolder, type MaterialTypeSchema } from '@shared/materialsSchema'
import ImageField from './ImageField'
import type { ImageState } from './util'

export interface FormDraft {
  key: string
  ordering: InsertModeName
  values: Record<string, unknown>
  imageState: ImageState
}

interface Props {
  rootPath: string
  schema: MaterialTypeSchema
  mode: 'create' | 'edit'
  base: MaterialRecord
  originalKey?: string
  onPreview: (draft: FormDraft) => void
  onDelete?: () => void
  onCancel: () => void
}

// ── Tag input ─────────────────────────────────────────────────────────────────

function TagsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')

  const add = () => {
    const tag = input.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setInput('')
  }

  return (
    <div className="tags-input">
      {value.length > 0 && (
        <div className="tags-list">
          {value.map((t) => (
            <span key={t} className="tag">
              {t}
              <button
                type="button"
                className="tag-remove"
                onClick={() => onChange(value.filter((x) => x !== t))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="tags-add">
        <input
          type="text"
          placeholder="Type name, press Enter to add…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add() }
          }}
        />
        <button type="button" className="btn-secondary" onClick={add} disabled={!input.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}

// ── Days selector ─────────────────────────────────────────────────────────────

const DAY_OPTIONS = [
  { n: 1, label: 'Mon' }, { n: 2, label: 'Tue' }, { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' }, { n: 5, label: 'Fri' }, { n: 6, label: 'Sat' },
  { n: 7, label: 'Sun' }
]

function DaysSelect({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const toggle = (n: number) => {
    if (value.includes(n)) onChange(value.filter((x) => x !== n))
    else onChange([...value, n].sort((a, b) => a - b))
  }
  return (
    <div className="days-select">
      {DAY_OPTIONS.map((d) => (
        <label key={d.n} className={`day-btn${value.includes(d.n) ? ' day-btn-active' : ''}`}>
          <input type="checkbox" checked={value.includes(d.n)} onChange={() => toggle(d.n)} />
          {d.label}
        </label>
      ))}
    </div>
  )
}

// ── initialValues ─────────────────────────────────────────────────────────────

function initialValues(schema: MaterialTypeSchema, base: MaterialRecord): Record<string, unknown> {
  const v: Record<string, unknown> = {}
  for (const f of schema.fields) {
    if (f.widget === 'image' || f.widget === 'computed') continue
    const raw = base[f.key]
    if (f.widget === 'bool') v[f.key] = Boolean(raw)
    else if (f.widget === 'number') v[f.key] = raw == null ? '' : String(raw)
    else if (f.widget === 'tags') v[f.key] = Array.isArray(raw) ? raw : []
    else if (f.widget === 'days') v[f.key] = Array.isArray(raw) ? raw : []
    else v[f.key] = raw == null ? '' : String(raw)
  }
  return v
}

/** A real image path (has a filename), vs a template's bare folder prefix. */
function initialImageState(base: MaterialRecord): ImageState {
  const img = base.image
  if (img && !img.endsWith('/') && /\.[a-z0-9]+$/i.test(img)) {
    return { mode: 'existing', relative: img }
  }
  return { mode: 'none' }
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function MaterialForm({
  rootPath,
  schema,
  mode,
  base,
  originalKey,
  onPreview,
  onDelete,
  onCancel
}: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues(schema, base))
  const [imageState, setImageState] = useState<ImageState>(() => initialImageState(base))
  const [key, setKey] = useState<string>(originalKey ?? '')
  const [keyTouched, setKeyTouched] = useState(false)
  const [ordering, setOrdering] = useState<InsertModeName>('alphabetical')
  const [errors, setErrors] = useState<string[]>([])

  const imageFolder = resolveImageFolder(schema, values)

  const setField = (k: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [k]: val }))
    if (k === 'name' && !keyTouched) setKey(deriveKey(String(val)))
  }

  const validate = (): string[] => {
    const errs: string[] = []
    for (const f of schema.fields) {
      if (!f.required || f.widget === 'computed') continue
      if (f.widget === 'image') {
        if (imageState.mode === 'none') errs.push('An image is required.')
      } else if (f.widget === 'tags') {
        const arr = values[f.key] as string[]
        if (!arr || arr.length === 0) errs.push(`${f.label} is required.`)
      } else if (f.widget === 'days') {
        const arr = values[f.key] as number[]
        if (!arr || arr.length === 0) errs.push(`${f.label}: select at least one day.`)
      } else {
        const v = values[f.key]
        if (v == null || String(v).trim() === '') errs.push(`${f.label} is required.`)
      }
    }
    if (key.trim() === '') errs.push('Record key cannot be empty.')
    return errs
  }

  const submitPreview = () => {
    const errs = validate()
    setErrors(errs)
    if (errs.length) return
    onPreview({ key: key.trim(), ordering, values, imageState })
  }

  const renamed = mode === 'edit' && originalKey != null && key.trim() !== originalKey

  return (
    <div className="mat-form">
      <header className="mat-form-head">
        <h2>{mode === 'create' ? 'New material' : `Edit: ${originalKey}`}</h2>
        <span className="pill">{schema.label}</span>
      </header>

      <div className="mat-form-grid">
        {schema.fields.map((f) => {
          // Computed fields are not shown.
          if (f.widget === 'computed') return null

          if (f.widget === 'image') {
            return (
              <div className="field field-wide" key={f.key}>
                <label>
                  {f.label}
                  {f.required && <span className="req">*</span>}
                </label>
                <ImageField
                  rootPath={rootPath}
                  imageFolder={imageFolder}
                  defaultBasename={key.trim() ? `Item_${key.trim()}` : undefined}
                  state={imageState}
                  onChange={setImageState}
                />
                {f.help && <p className="field-help">{f.help}</p>}
              </div>
            )
          }

          const v = values[f.key]

          if (f.widget === 'tags') {
            return (
              <div className="field field-wide" key={f.key}>
                <label>
                  {f.label}
                  {f.required && <span className="req">*</span>}
                </label>
                <TagsInput
                  value={Array.isArray(v) ? (v as string[]) : []}
                  onChange={(tags) => setField(f.key, tags)}
                />
                {f.help && <p className="field-help">{f.help}</p>}
              </div>
            )
          }

          if (f.widget === 'days') {
            return (
              <div className="field field-wide" key={f.key}>
                <label>
                  {f.label}
                  {f.required && <span className="req">*</span>}
                </label>
                <DaysSelect
                  value={Array.isArray(v) ? (v as number[]) : []}
                  onChange={(days) => setField(f.key, days)}
                />
                {f.help && <p className="field-help">{f.help}</p>}
              </div>
            )
          }

          return (
            <div className={`field ${f.widget === 'textarea' ? 'field-wide' : ''}`} key={f.key}>
              <label>
                {f.label}
                {f.required && <span className="req">*</span>}
              </label>
              {f.widget === 'textarea' && (
                <textarea
                  rows={3}
                  value={String(v ?? '')}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              )}
              {f.widget === 'text' && (
                <input
                  type="text"
                  value={String(v ?? '')}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              )}
              {f.widget === 'number' && (
                <input
                  type="number"
                  value={String(v ?? '')}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              )}
              {f.widget === 'select' && (
                <select value={String(v ?? '')} onChange={(e) => setField(f.key, e.target.value)}>
                  <option value="">— select —</option>
                  {f.options?.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
              {f.widget === 'bool' && (
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={Boolean(v)}
                    onChange={(e) => setField(f.key, e.target.checked)}
                  />
                  <span>{Boolean(v) ? 'Yes' : 'No'}</span>
                </label>
              )}
              {f.help && <p className="field-help">{f.help}</p>}
            </div>
          )
        })}

        <div className="field">
          <label>
            Record key
            {renamed && <span className="pill pill-warn">rename</span>}
          </label>
          <input
            type="text"
            value={key}
            onChange={(e) => { setKey(e.target.value); setKeyTouched(true) }}
          />
          <p className="field-help">Derived from name; edit to override.</p>
        </div>

        <div className="field">
          <label>Insert position</label>
          <select value={ordering} onChange={(e) => setOrdering(e.target.value as InsertModeName)}>
            <option value="alphabetical">Alphabetical</option>
            <option value="append">Append to bottom</option>
          </select>
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="form-errors">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <footer className="mat-form-actions">
        <button className="btn-primary" onClick={submitPreview}>Preview changes</button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        {mode === 'edit' && onDelete && (
          <button className="btn-danger" onClick={onDelete}>Delete…</button>
        )}
      </footer>
    </div>
  )
}
