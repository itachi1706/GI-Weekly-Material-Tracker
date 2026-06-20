import { useState } from 'react'
import type { MaterialRecord, InsertModeName } from '@shared/types'
import { deriveKey, type MaterialTypeSchema } from '@shared/materialsSchema'
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
  /** Template skeleton (create) or existing record (edit) — the base the form initializes from. */
  base: MaterialRecord
  originalKey?: string
  onPreview: (draft: FormDraft) => void
  onDelete?: () => void
  onCancel: () => void
}

function initialValues(schema: MaterialTypeSchema, base: MaterialRecord): Record<string, unknown> {
  const v: Record<string, unknown> = {}
  for (const f of schema.fields) {
    if (f.widget === 'image') continue
    const raw = base[f.key]
    if (f.widget === 'bool') v[f.key] = Boolean(raw)
    else if (f.widget === 'number') v[f.key] = raw == null ? '' : String(raw)
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

  const imageFolder = schema.imageFolder

  const setField = (k: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [k]: val }))
    if (k === 'name' && !keyTouched) setKey(deriveKey(String(val)))
  }

  const validate = (): string[] => {
    const errs: string[] = []
    for (const f of schema.fields) {
      if (!f.required) continue
      if (f.widget === 'image') {
        if (imageState.mode === 'none') errs.push('An image is required.')
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
            onChange={(e) => {
              setKey(e.target.value)
              setKeyTouched(true)
            }}
          />
          <p className="field-help">Derived from name; edit to override.</p>
        </div>

        <div className="field">
          <label>Insert position</label>
          <select
            value={ordering}
            onChange={(e) => setOrdering(e.target.value as InsertModeName)}
          >
            <option value="alphabetical">Alphabetical</option>
            <option value="append">Append to bottom</option>
          </select>
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="form-errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <footer className="mat-form-actions">
        <button className="btn-primary" onClick={submitPreview}>
          Preview changes
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        {mode === 'edit' && onDelete && (
          <button className="btn-danger" onClick={onDelete}>
            Delete…
          </button>
        )}
      </footer>
    </div>
  )
}
