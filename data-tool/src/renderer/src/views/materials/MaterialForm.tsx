import { useMemo, useState } from 'react'
import type { MaterialRecord, InsertModeName, WikiMaterialResult } from '@shared/types'
import { deriveKey, resolveImageFolder, resolveRarityOptions, type FieldSpec, type MaterialTypeSchema } from '@shared/materialsSchema'
import ImageField from './ImageField'
import { RaritySelect } from '../shared/rarity'
import type { ImageState } from './util'
import WikiFillPanel, { type WikiRow } from '../shared/WikiFillPanel'
import { urlStateFromWiki, wikiIconFileName, describeImage, eqi } from '../shared/wikiApply'
import { DAY_ABBR, CATEGORY_LABEL, inferWikiCategory, mapWikiType } from './materialWiki'

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

export function TagsInput({ value, onChange }: Readonly<{ value: string[]; onChange: (v: string[]) => void }>) {
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

export function DaysSelect({ value, onChange }: Readonly<{ value: number[]; onChange: (v: number[]) => void }>) {
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

/** Initial form value for one field, per widget type. */
function initialFieldValue(f: FieldSpec, raw: unknown): unknown {
  if (f.widget === 'bool') return Boolean(raw)
  if (f.widget === 'tags' || f.widget === 'days') return Array.isArray(raw) ? raw : []
  // number / rarity / text / textarea / select: stringify scalars, blank for null/objects
  return raw == null || typeof raw === 'object' ? '' : String(raw as string)
}

function initialValues(schema: MaterialTypeSchema, base: MaterialRecord): Record<string, unknown> {
  const v: Record<string, unknown> = {}
  for (const f of schema.fields) {
    if (f.widget === 'image' || f.widget === 'computed') continue
    v[f.key] = initialFieldValue(f, base[f.key])
  }
  return v
}

/** Required-field error for one field (null if satisfied), per widget type. */
function requiredFieldError(f: FieldSpec, values: Record<string, unknown>, imageState: ImageState): string | null {
  if (f.widget === 'image') return imageState.mode === 'none' ? 'An image is required.' : null
  if (f.widget === 'tags') {
    const arr = values[f.key] as string[]
    return !arr || arr.length === 0 ? `${f.label} is required.` : null
  }
  if (f.widget === 'days') {
    const arr = values[f.key] as number[]
    return !arr || arr.length === 0 ? `${f.label}: select at least one day.` : null
  }
  const v = values[f.key]
  return v == null || String(v).trim() === '' ? `${f.label} is required.` : null
}

/** A real image path (has a filename), vs a template's bare folder prefix. */
function initialImageState(base: MaterialRecord): ImageState {
  const img = base.image
  if (img && !img.endsWith('/') && /\.[a-z0-9]+$/i.test(img)) {
    return { mode: 'existing', relative: img }
  }
  return { mode: 'none' }
}

// ── Schema-aware wiki review rows ──────────────────────────────────────────────
// Value rows patch the `values` map; the icon row sets `imageState`. Only fields present in the
// active schema are offered. Extracted from the component so each builder stays small (S3776).
type ApplyValFn = (v: Record<string, unknown>) => Record<string, unknown>
type MatAddFn = (row: Omit<WikiRow, 'changed'> & { changed?: boolean }, fn?: ApplyValFn) => void

interface MatWikiCtx {
  res: WikiMaterialResult
  values: Record<string, unknown>
  imageState: ImageState
  key: string
  schema: MaterialTypeSchema
  has: Set<string>
  strVal: (k: string) => string
}

function makeMatAdd(rows: WikiRow[], applyVals: Record<string, ApplyValFn>): MatAddFn {
  return (row, fn) => {
    const changed = row.changed ?? (!!row.fetched.trim() && !eqi(row.fetched, row.current))
    rows.push({ ...row, changed })
    if (fn) applyVals[row.id] = fn
  }
}

function addMaterialIdentityRows(add: MatAddFn, ctx: MatWikiCtx): void {
  const { res, has, strVal } = ctx
  if (has.has('name') && res.name)
    add({ id: 'mt-name', group: 'Identity', label: 'Name', current: strVal('name'), fetched: res.name },
      (v) => ({ ...v, name: res.name }))
  if (has.has('description') && res.description)
    add({ id: 'mt-desc', group: 'Identity', label: 'Description', current: strVal('description'), fetched: res.description },
      (v) => ({ ...v, description: res.description }))
  if (has.has('wiki') && res.wikiUrl)
    add({ id: 'mt-wiki', group: 'Identity', label: 'Wiki URL', current: strVal('wiki'), fetched: res.wikiUrl },
      (v) => ({ ...v, wiki: res.wikiUrl }))
}

/** Type: mapped from the wiki Item GROUP → this schema's `type`; warn if the page is a different category. */
function addMaterialTypeRow(add: MatAddFn, ctx: MatWikiCtx): void {
  const { res, has, strVal, schema } = ctx
  const inferred = inferWikiCategory(res)
  if (inferred && inferred !== schema.innerType) {
    add({ id: 'mt-mismatch', group: 'Details', label: '⚠ Material type', current: schema.label,
      fetched: CATEGORY_LABEL[inferred] ?? inferred, confirmOnly: true, ok: false, changed: false,
      note: 'the pasted page is a different material category' })
    return
  }
  if (!has.has('type')) return
  const typeField = schema.fields.find((f) => f.key === 'type')
  const typeOptions = (typeField?.options ?? []).map((o) => String(o.value))
  const mapped = mapWikiType(res, schema.innerType, typeOptions)
  if (mapped)
    add({ id: 'mt-type', group: 'Details', label: 'Type', current: strVal('type'), fetched: mapped },
      (v) => ({ ...v, type: mapped }))
  else if (res.type)
    add({ id: 'mt-type', group: 'Details', label: 'Type', current: strVal('type'), fetched: res.type,
      confirmOnly: true, ok: eqi(strVal('type'), res.type), changed: false })
}

function addMaterialDetailRows(add: MatAddFn, ctx: MatWikiCtx): void {
  const { res, has, strVal, values } = ctx
  if (has.has('obtained') && res.obtained)
    add({ id: 'mt-obtained', group: 'Details', label: 'Obtained', current: strVal('obtained'), fetched: res.obtained },
      (v) => ({ ...v, obtained: res.obtained }))
  if (has.has('days') && res.days) {
    const daysDisp = (arr: number[]): string => arr.map((n) => DAY_ABBR[n] ?? n).join('/')
    add({ id: 'mt-days', group: 'Details', label: 'Available days',
      current: daysDisp((values.days as number[]) ?? []), fetched: daysDisp(res.days) },
      (v) => ({ ...v, days: res.days }))
  }
  addMaterialTypeRow(add, ctx)
  // Rarity (appliable; applyWiki snaps it to a valid option for the resulting type).
  if (has.has('rarity') && res.rarity != null)
    add({ id: 'mt-rarity', group: 'Details', label: 'Rarity', current: strVal('rarity'), fetched: String(res.rarity) },
      (v) => ({ ...v, rarity: String(res.rarity) }))
}

/** Icon row + its imageApply; basename from the fetched name so a first-time fill resolves correctly. */
function buildMaterialImageRow(rows: WikiRow[], ctx: MatWikiCtx): { id: string; state: ImageState } | null {
  const { res, key, values, imageState } = ctx
  if (!res.iconUrl) return null
  const base = `Item_${deriveKey(String(res.name ?? '')) || key.trim() || deriveKey(String(values.name ?? ''))}`
  const file = wikiIconFileName(res.iconUrl, base)
  rows.push({ id: 'mt-icon', group: 'Image', label: 'Icon', current: describeImage(imageState),
    fetched: file, changed: describeImage(imageState) !== file })
  return { id: 'mt-icon', state: urlStateFromWiki(res.iconUrl, base) }
}

function buildMaterialWikiData(
  res: WikiMaterialResult | null, values: Record<string, unknown>, imageState: ImageState,
  key: string, schema: MaterialTypeSchema
): { rows: WikiRow[]; applyVals: Record<string, ApplyValFn>; imageApply: { id: string; state: ImageState } | null } {
  const rows: WikiRow[] = []
  const applyVals: Record<string, ApplyValFn> = {}
  if (!res) return { rows, applyVals, imageApply: null }
  const ctx: MatWikiCtx = {
    res, values, imageState, key, schema,
    has: new Set(schema.fields.map((f) => f.key)),
    strVal: (k) => { const v = values[k]; return v == null ? '' : String(v) }
  }
  const add = makeMatAdd(rows, applyVals)
  addMaterialIdentityRows(add, ctx)
  addMaterialDetailRows(add, ctx)
  const imageApply = buildMaterialImageRow(rows, ctx)
  return { rows, applyVals, imageApply }
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
}: Readonly<Props>) {
  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues(schema, base))
  const [imageState, setImageState] = useState<ImageState>(() => initialImageState(base))
  const [key, setKey] = useState<string>(originalKey ?? '')
  const [keyTouched, setKeyTouched] = useState(false)
  const [ordering, setOrdering] = useState<InsertModeName>('alphabetical')
  const [errors, setErrors] = useState<string[]>([])
  // Wiki auto-fill.
  const [showWiki, setShowWiki] = useState(mode === 'create')
  const [wikiUrl, setWikiUrl] = useState('')
  const [wikiBusy, setWikiBusy] = useState(false)
  const [wikiError, setWikiError] = useState<string | null>(null)
  const [wikiResult, setWikiResult] = useState<WikiMaterialResult | null>(null)

  const imageFolder = resolveImageFolder(schema, values)

  const setField = (k: string, val: unknown) => {
    setValues((prev) => {
      const next = { ...prev, [k]: val }
      // Keep rarity valid when its governing field (e.g. `type`) changes underneath it.
      for (const f of schema.fields) {
        if (f.widget !== 'rarity') continue
        const opts = resolveRarityOptions(f, next)
        if (!opts.includes(Number(next[f.key]))) next[f.key] = String(opts[0])
      }
      return next
    })
    if (k === 'name' && !keyTouched) setKey(deriveKey(String(val)))
  }

  // ── Wiki auto-fill ─────────────────────────────────────────────────────────────

  const fetchMaterialWiki = () => {
    const url = wikiUrl.trim() || String(values.wiki ?? '').trim()
    if (!url) { setWikiError('Paste a Genshin Wiki material URL first.'); return }
    setWikiBusy(true)
    setWikiError(null)
    window.api.wiki
      .fetchMaterial(url)
      .then((r) => { setWikiResult(r); setWikiUrl(url) })
      .catch((e: unknown) => setWikiError(e instanceof Error ? e.message : String(e)))
      .finally(() => setWikiBusy(false))
  }

  // Schema-aware review rows (built by the module-level material-wiki helpers above).
  const wikiData = useMemo(
    () => buildMaterialWikiData(wikiResult, values, imageState, key, schema),
    [wikiResult, values, imageState, key, schema]
  )

  const applyWiki = (ids: string[]) => {
    setValues((prev) => {
      let next = ids.reduce((acc, id) => (wikiData.applyVals[id] ? wikiData.applyVals[id](acc) : acc), prev)
      // Keep rarity valid vs the (possibly newly-applied) type — mirrors setField's snap.
      for (const f of schema.fields) {
        if (f.widget !== 'rarity') continue
        const opts = resolveRarityOptions(f, next)
        if (!opts.includes(Number(next[f.key]))) next = { ...next, [f.key]: String(opts[0]) }
      }
      return next
    })
    if (ids.includes('mt-name') && !keyTouched && wikiResult?.name) setKey(deriveKey(wikiResult.name))
    if (wikiData.imageApply && ids.includes(wikiData.imageApply.id)) setImageState(wikiData.imageApply.state)
    setWikiResult(null)
  }

  const validate = (): string[] => {
    const errs: string[] = []
    for (const f of schema.fields) {
      if (!f.required || f.widget === 'computed') continue
      const e = requiredFieldError(f, values, imageState)
      if (e) errs.push(e)
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
        <button type="button" className="btn-secondary btn-sm wiki-toggle"
          aria-expanded={showWiki} onClick={() => setShowWiki((v) => !v)}>
          {showWiki ? 'Hide auto-fill' : '✨ Auto-fill from wiki'}
        </button>
      </header>

      <div className="mat-form-grid">
        {showWiki && (
          <div className="field field-wide wiki-fetch-field">
            <div className="field-label">Auto-fill from Genshin Wiki</div>
            <div className="wiki-fetch-row">
              <input type="text" placeholder="Paste a fandom.com material page URL…" autoFocus
                value={wikiUrl} onChange={(e) => setWikiUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchMaterialWiki() } }} />
              <button type="button" className="btn-secondary" disabled={wikiBusy} onClick={fetchMaterialWiki}>
                {wikiBusy ? 'Fetching…' : 'Fetch'}
              </button>
            </div>
            {wikiError && <p className="field-help wiki-fetch-error">{wikiError}</p>}
            <p className="field-help">Fetches name, description &amp; image (plus days for domain materials).</p>
          </div>
        )}
        {schema.fields.map((f) => {
          // Computed fields are not shown.
          if (f.widget === 'computed') return null

          if (f.widget === 'image') {
            return (
              <div className="field field-wide" key={f.key}>
                <div className="field-label">
                  {f.label}
                  {f.required && <span className="req">*</span>}
                </div>
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
                <div className="field-label">
                  {f.label}
                  {f.required && <span className="req">*</span>}
                </div>
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
                <div className="field-label">
                  {f.label}
                  {f.required && <span className="req">*</span>}
                </div>
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
              <div className="field-label">
                {f.label}
                {f.required && <span className="req">*</span>}
              </div>
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
              {f.widget === 'rarity' && (
                <RaritySelect
                  value={String(v ?? '')}
                  onChange={(val) => setField(f.key, val)}
                  options={resolveRarityOptions(f, values)}
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
                  <span>{v ? 'Yes' : 'No'}</span>
                </label>
              )}
              {f.help && <p className="field-help">{f.help}</p>}
            </div>
          )
        })}

        <div className="field">
          <label htmlFor="mat-f1">
            Record key
            {renamed && <span className="pill pill-warn">rename</span>}
          </label>
          <input id="mat-f1"
            type="text"
            value={key}
            onChange={(e) => { setKey(e.target.value); setKeyTouched(true) }}
          />
          <p className="field-help">Derived from name; edit to override.</p>
        </div>

        <div className="field">
          <label htmlFor="mat-f2">Insert position</label>
          <select id="mat-f2" value={ordering} onChange={(e) => setOrdering(e.target.value as InsertModeName)}>
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
        <button type="button" className="btn-primary" onClick={submitPreview}>Preview changes</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        {mode === 'edit' && onDelete && (
          <button type="button" className="btn-danger" onClick={onDelete}>Delete…</button>
        )}
      </footer>

      {wikiResult && (
        <WikiFillPanel
          sourceTitle={wikiResult.title}
          rows={wikiData.rows}
          groupOrder={['Identity', 'Details', 'Image']}
          onApply={applyWiki}
          onClose={() => setWikiResult(null)}
        />
      )}
    </div>
  )
}
