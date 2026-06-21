import { useState } from 'react'
import type { OutfitRecord, OutfitChange, ImagePlan } from '@shared/types'
import { deriveKey } from '@shared/materialsSchema'
import ImageField from '../materials/ImageField'
import { TagsInput } from '../materials/MaterialForm'
import { extOf, sanitizeImageBasename, type ImageState } from '../materials/util'

// ── Outfit set definitions ────────────────────────────────────────────────────

const OUTFIT_SETS = [
  { file: 'Outfits-Standard.json',  type: 'Default',  label: 'Standard',  folder: 'Outfits/Full/Standard',  wishFolder: 'Outfits/Wish/Standard'  },
  { file: 'Outfits-Alternate.json', type: 'Alternate', label: 'Alternate', folder: 'Outfits/Full/Alternate', wishFolder: 'Outfits/Wish/Alternate' },
  { file: 'Outfits-Themed.json',    type: 'Themed',    label: 'Themed',    folder: 'Outfits/Full/Themed',    wishFolder: 'Outfits/Wish/Themed'    },
] as const

type OutfitSetFile = typeof OUTFIT_SETS[number]['file']

function setByFile(file: string) {
  return OUTFIT_SETS.find((s) => s.file === file) ?? OUTFIT_SETS[0]
}

// ── Date helpers (JSON: "D-M-YYYY", HTML date input: "YYYY-MM-DD") ────────────

function jsonDateToInput(s: string): string {
  const m = s.match(/^(\d+)-(\d+)-(\d{4})$/)
  if (!m) return ''
  const [, day, month, year] = m
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function inputDateToJson(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const [, year, month, day] = m
  return `${parseInt(day)}-${parseInt(month)}-${year}`
}

// ── Image entry builder ───────────────────────────────────────────────────────

function buildImageEntry(
  state: ImageState,
  folder: string,
  defaultName: string
): { path: string | null; plan: ImagePlan | undefined } {
  if (state.mode === 'existing') {
    return { path: state.relative, plan: { source: 'existing', relativePath: state.relative } }
  }
  if (state.mode === 'localFile') {
    const ext = extOf(state.sourcePath)
    const name = state.imageName?.trim() ? `${state.imageName.trim()}.${ext}` : `${defaultName}.${ext}`
    const path = `${folder}/${name}`
    return { path, plan: { source: 'localFile', sourcePath: state.sourcePath, destRelative: path } }
  }
  if (state.mode === 'url') {
    const ext = extOf(state.url)
    const name = state.imageName?.trim() ? `${state.imageName.trim()}.${ext}` : `${sanitizeImageBasename(state.url)}.${ext}`
    const path = `${folder}/${name}`
    return { path, plan: { source: 'url', url: state.url, destRelative: path } }
  }
  return { path: null, plan: undefined }
}

// ── Draft ─────────────────────────────────────────────────────────────────────

interface Draft {
  name: string
  keyOverride: string
  keyTouched: boolean
  /** Target file in create mode; ignored in edit (file prop is used instead). */
  outfitSetFile: OutfitSetFile
  /** The JSON `type` field — readable label, independent of the target file. */
  type: string
  rarity: string
  /** Multi-entry; `character` = characters[0] (legacy field, derived). */
  characters: string[]
  description: string
  obtained: string
  lore: string
  imageState: ImageState
  thumbnailState: ImageState
  wishimageState: ImageState
  model3d: string
  shop: boolean
  shopCost: string
  shopCostDiscounted: string
  /** HTML date format "YYYY-MM-DD" or '' */
  shopCostDiscountedTill: string
  eventGiveFree: boolean
  /** HTML date format "YYYY-MM-DD" or '' */
  eventGiveFreeTill: string
  releasedVersion: string
  releasedVersionName: string
  released: boolean
  wiki: string
}

function stateFromPath(path: string | null | undefined): ImageState {
  return path ? { mode: 'existing', relative: String(path) } : { mode: 'none' }
}

function draftFromRecord(rec: OutfitRecord, defaultFile?: string, existingKey?: string): Draft {
  const file = (defaultFile ?? 'Outfits-Standard.json') as OutfitSetFile
  return {
    name: String(rec.name ?? ''),
    keyOverride: existingKey ?? '',
    keyTouched: !!existingKey,
    outfitSetFile: file,
    type: String(rec.type ?? setByFile(file).type),
    rarity: String(rec.rarity ?? 4),
    characters: Array.isArray(rec.characters) && rec.characters.length > 0
      ? rec.characters.map(String)
      : rec.character ? [String(rec.character)] : [],
    description: String(rec.description ?? ''),
    obtained: String(rec.obtained ?? 'Obtaining Character'),
    lore: String(rec.lore ?? ''),
    imageState: stateFromPath(rec.image),
    thumbnailState: stateFromPath(rec.thumbnail),
    wishimageState: stateFromPath(rec.wishimage),
    model3d: String(rec['3dmodel'] ?? ''),
    shop: Boolean(rec.shop),
    shopCost: String(rec.shop_cost ?? 0),
    shopCostDiscounted: String(rec.shop_cost_discounted ?? 0),
    shopCostDiscountedTill: jsonDateToInput(String(rec.shop_cost_discounted_till ?? '')),
    eventGiveFree: Boolean(rec.event_give_free),
    eventGiveFreeTill: jsonDateToInput(String(rec.event_give_free_till ?? '')),
    releasedVersion: String(rec.released_version ?? '1'),
    releasedVersionName: String(rec.released_version_name ?? ''),
    released: Boolean(rec.released),
    wiki: String(rec.wiki ?? '')
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  rootPath: string
  mode: 'create' | 'edit'
  template: OutfitRecord
  originalKey?: string
  /** Actual file this outfit lives in — required in edit mode; absent for new outfits. */
  file?: string
  onPreview: (change: OutfitChange) => void
  onDelete?: () => void
  onCancel: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OutfitForm({
  rootPath, mode, template, originalKey, file, onPreview, onDelete, onCancel
}: Props) {
  const [draft, setDraft] = useState<Draft>(() =>
    draftFromRecord(template, file, originalKey)
  )
  const [errors, setErrors] = useState<string[]>([])

  const set = <K extends keyof Draft>(key: K, val: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: val }))

  const currentKey = draft.keyTouched && draft.keyOverride.trim()
    ? draft.keyOverride.trim()
    : deriveKey(draft.name)

  // Edit mode: target file is locked to the prop. Create mode: driven by outfit set selector.
  const outfitSet = mode === 'edit' && file ? setByFile(file) : setByFile(draft.outfitSetFile)

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = (): string[] => {
    const errs: string[] = []
    if (!draft.name.trim()) errs.push('Name is required.')
    if (!currentKey) errs.push('Record key is required.')
    if (draft.characters.filter(Boolean).length === 0) errs.push('At least one character is required.')
    if (!draft.rarity) errs.push('Rarity is required.')
    return errs
  }

  // ── Build OutfitChange ──────────────────────────────────────────────────────

  const buildChange = (): OutfitChange => {
    const characters = draft.characters.map((s) => s.trim()).filter(Boolean)
    const character = characters[0] ?? null

    const img = buildImageEntry(draft.imageState, outfitSet.folder, currentKey)
    const thumb = buildImageEntry(draft.thumbnailState, 'Characters', character ?? currentKey)
    const wish = buildImageEntry(draft.wishimageState, outfitSet.wishFolder, currentKey)

    // Explicit key order matching templates/misc.json to prevent position drift on edits.
    const record: OutfitRecord = {
      name: draft.name.trim() || null,
      character,
      characters,
      rarity: Number(draft.rarity),
      image: img.path || null,
      thumbnail: thumb.path || null,
      wishimage: wish.path || null,
      '3dmodel': draft.model3d.trim() || null,
      description: draft.description.trim() || null,
      obtained: draft.obtained.trim() || null,
      lore: draft.lore.trim() || null,
      type: draft.type || outfitSet.type,
      shop: draft.shop,
      shop_cost: draft.shop ? (Number(draft.shopCost) || 0) : 0,
      shop_cost_discounted: draft.shop ? (Number(draft.shopCostDiscounted) || 0) : 0,
      shop_cost_discounted_till: draft.shop && draft.shopCostDiscountedTill
        ? inputDateToJson(draft.shopCostDiscountedTill) : null,
      event_give_free: draft.eventGiveFree,
      event_give_free_till: draft.eventGiveFree && draft.eventGiveFreeTill
        ? inputDateToJson(draft.eventGiveFreeTill) : null,
      released_version: parseFloat(draft.releasedVersion) || 1,
      released_version_name: draft.releasedVersionName.trim() || null,
      released: draft.released,
      wiki: draft.wiki.trim() || null,
      subCollection: {}
    }

    return {
      op: mode === 'edit' ? 'update' : 'create',
      file: outfitSet.file,
      key: currentKey,
      originalKey: mode === 'edit' ? originalKey : undefined,
      record,
      ordering: 'alphabetical',
      image: img.plan,
      thumbnailImage: thumb.plan,
      wishimageImage: wish.plan,
    }
  }

  const submitPreview = () => {
    const errs = validate()
    setErrors(errs)
    if (errs.length) return
    onPreview(buildChange())
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mat-form">
      <header className="mat-form-head">
        <h2>{mode === 'edit' ? 'Edit' : 'New'} Outfit</h2>
        {mode === 'edit' && originalKey && <span className="pill">{originalKey}</span>}
      </header>

      <div className="mat-form-grid">

        {/* ── Identity ── */}
        <div className="field">
          <label>Name<span className="req">*</span></label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => {
              const name = e.target.value
              set('name', name)
              if (!draft.keyTouched) set('keyOverride', deriveKey(name))
            }}
          />
        </div>

        <div className="field">
          <label>Record key</label>
          <input
            type="text"
            value={draft.keyTouched ? draft.keyOverride : deriveKey(draft.name)}
            onChange={(e) => setDraft((p) => ({ ...p, keyOverride: e.target.value, keyTouched: true }))}
          />
          <p className="field-help">Auto-derived from name; edit to override.</p>
        </div>

        {/* Outfit set → target file */}
        <div className="field">
          <label>Outfit set<span className="req">*</span></label>
          <select
            value={outfitSet.file}
            disabled={mode === 'edit'}
            onChange={(e) => {
              const newFile = e.target.value as OutfitSetFile
              const newSet = setByFile(newFile)
              setDraft((p) => ({ ...p, outfitSetFile: newFile, type: newSet.type }))
            }}
          >
            {OUTFIT_SETS.map((s) => (
              <option key={s.file} value={s.file}>{s.label} ({s.file})</option>
            ))}
          </select>
          {mode === 'edit' && <p className="field-help">Cannot move an outfit between files.</p>}
        </div>

        {/* Readable type field (independent of outfit set) */}
        <div className="field">
          <label>Type (readable)</label>
          <input
            type="text"
            list="outfit-types"
            value={draft.type}
            onChange={(e) => set('type', e.target.value)}
          />
          <datalist id="outfit-types">
            <option value="Default" />
            <option value="Alternate" />
            <option value="Themed" />
          </datalist>
          <p className="field-help">Stored in the JSON `type` field; not used for filtering.</p>
        </div>

        <div className="field">
          <label>Rarity<span className="req">*</span></label>
          <select value={draft.rarity} onChange={(e) => set('rarity', e.target.value)}>
            <option value="4">4 ★★★★</option>
            <option value="5">5 ★★★★★</option>
          </select>
        </div>

        {/* Characters (multi-entry; character = characters[0]) */}
        <div className="field field-wide">
          <label>Characters<span className="req">*</span></label>
          <TagsInput
            value={draft.characters}
            onChange={(v) => set('characters', v)}
          />
          <p className="field-help">
            The legacy <code>character</code> field is auto-set to the first entry
            {draft.characters[0] ? ` ("${draft.characters[0]}")` : ''}.
          </p>
        </div>

        {/* ── Description / lore ── */}
        <div className="field field-wide">
          <label>Description</label>
          <textarea rows={2} value={draft.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        <div className="field field-wide">
          <label>Obtained</label>
          <textarea rows={2} value={draft.obtained} onChange={(e) => set('obtained', e.target.value)} />
        </div>

        <div className="field field-wide">
          <label>Lore</label>
          <textarea rows={3} value={draft.lore} onChange={(e) => set('lore', e.target.value)} />
        </div>

        {/* ── Images ── */}
        <div className="field field-wide">
          <label>Image (primary portrait)</label>
          <ImageField
            rootPath={rootPath}
            imageFolder={outfitSet.folder}
            defaultBasename={currentKey || undefined}
            state={draft.imageState}
            onChange={(s) => set('imageState', s)}
          />
        </div>

        <div className="field field-wide">
          <label>Thumbnail</label>
          <ImageField
            rootPath={rootPath}
            imageFolder="Characters"
            browseSourceFolders={['Characters', `Outfits/Thumbnail/${outfitSet.label}`]}
            defaultBasename={draft.characters[0] || currentKey || undefined}
            state={draft.thumbnailState}
            onChange={(s) => set('thumbnailState', s)}
          />
          <p className="field-help">Searches Characters/ (all elements) and Outfits/Thumbnail/{outfitSet.label}/.</p>
        </div>

        <div className="field field-wide">
          <label>Wish image</label>
          <ImageField
            rootPath={rootPath}
            imageFolder={outfitSet.wishFolder}
            defaultBasename={currentKey || undefined}
            state={draft.wishimageState}
            onChange={(s) => set('wishimageState', s)}
          />
        </div>

        {/* ── 3D model ── */}
        <div className="field">
          <label>3D model (.glb)</label>
          <input type="text" value={draft.model3d} onChange={(e) => set('model3d', e.target.value)} />
          <p className="field-help">Filename only, e.g. Amber.glb</p>
        </div>

        {/* ── Shop ── */}
        <div className="field">
          <label>In shop</label>
          <label className="switch">
            <input type="checkbox" checked={draft.shop} onChange={(e) => set('shop', e.target.checked)} />
            <span>{draft.shop ? 'Yes' : 'No'}</span>
          </label>
        </div>

        {draft.shop && (
          <>
            <div className="field">
              <label>Shop cost</label>
              <input type="number" min={0} value={draft.shopCost} onChange={(e) => set('shopCost', e.target.value)} />
            </div>
            <div className="field">
              <label>Discounted cost</label>
              <input type="number" min={0} value={draft.shopCostDiscounted} onChange={(e) => set('shopCostDiscounted', e.target.value)} />
            </div>
            <div className="field">
              <label>Discount ends</label>
              <input type="date" value={draft.shopCostDiscountedTill} onChange={(e) => set('shopCostDiscountedTill', e.target.value)} />
            </div>
          </>
        )}

        {/* ── Event ── */}
        <div className="field">
          <label>Event (free)</label>
          <label className="switch">
            <input type="checkbox" checked={draft.eventGiveFree} onChange={(e) => set('eventGiveFree', e.target.checked)} />
            <span>{draft.eventGiveFree ? 'Yes' : 'No'}</span>
          </label>
        </div>

        {draft.eventGiveFree && (
          <div className="field">
            <label>Free until</label>
            <input type="date" value={draft.eventGiveFreeTill} onChange={(e) => set('eventGiveFreeTill', e.target.value)} />
          </div>
        )}

        {/* ── Release ── */}
        <div className="field">
          <label>Released version</label>
          <input
            type="text"
            value={draft.releasedVersion}
            onChange={(e) => set('releasedVersion', e.target.value)}
          />
          <p className="field-help">Float, e.g. 3.4</p>
        </div>

        <div className="field">
          <label>Version name</label>
          <input
            type="text"
            value={draft.releasedVersionName}
            onChange={(e) => set('releasedVersionName', e.target.value)}
          />
          <p className="field-help">Optional label, e.g. "Luna III"</p>
        </div>

        <div className="field">
          <label>Released</label>
          <label className="switch">
            <input type="checkbox" checked={draft.released} onChange={(e) => set('released', e.target.checked)} />
            <span>{draft.released ? 'Yes' : 'No'}</span>
          </label>
        </div>

        {/* ── Wiki ── */}
        <div className="field field-wide">
          <label>Wiki URL</label>
          <input type="text" value={draft.wiki} onChange={(e) => set('wiki', e.target.value)} />
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
        {onDelete && (
          <button
            className="btn-danger"
            onClick={() => {
              if (confirm(`Delete "${originalKey}"? This can be reviewed in the preview before it's applied.`))
                onDelete()
            }}
          >
            Delete
          </button>
        )}
      </footer>
    </div>
  )
}
