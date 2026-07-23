import { useEffect, useMemo, useState } from 'react'
import type {
  OutfitRecord, OutfitChange, ImagePlan, CharacterSummary, WikiOutfitResult
} from '@shared/types'
import { deriveKey } from '@shared/materialsSchema'
import ImageField from '../materials/ImageField'
import { extOf, sanitizeImageBasename, type ImageState } from '../materials/util'
import { RaritySelect } from '../shared/rarity'
import { EntityLinkInput, type LinkOption } from '../shared/entityLink'
import WikiFillPanel, { type WikiRow } from '../shared/WikiFillPanel'
import { urlStateFromWiki, wikiIconFileName, describeImage, eqi } from '../shared/wikiApply'

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
  const m = /^(\d+)-(\d+)-(\d{4})$/.exec(s)
  if (!m) return ''
  const [, day, month, year] = m
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function inputDateToJson(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return ''
  const [, year, month, day] = m
  return `${Number.parseInt(day)}-${Number.parseInt(month)}-${year}`
}

/** Display a game version keeping the trailing `.0` for whole numbers (`1` → `"1.0"`, `1.6` → `"1.6"`). */
function fmtVersion(v: unknown): string {
  if (v == null || v === '') return '1.0'
  const n = Number(v)
  if (!Number.isFinite(n)) return typeof v === 'object' ? '1.0' : String(v as string)
  return Number.isInteger(n) ? n.toFixed(1) : String(n)
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
  let characters: string[] = []
  if (Array.isArray(rec.characters) && rec.characters.length > 0) characters = rec.characters.map(String)
  else if (rec.character) characters = [String(rec.character)]
  return {
    name: String(rec.name ?? ''),
    keyOverride: existingKey ?? '',
    keyTouched: !!existingKey,
    outfitSetFile: file,
    type: String(rec.type ?? setByFile(file).type),
    rarity: String(rec.rarity ?? 4),
    characters,
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
    releasedVersion: fmtVersion(rec.released_version),
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
}: Readonly<Props>) {
  const [draft, setDraft] = useState<Draft>(() =>
    draftFromRecord(template, file, originalKey)
  )
  const [errors, setErrors] = useState<string[]>([])
  const [characterSummaries, setCharacterSummaries] = useState<CharacterSummary[]>([])
  // Wiki auto-fill.
  const [showWiki, setShowWiki] = useState(mode === 'create')
  const [wikiUrl, setWikiUrl] = useState('')
  const [wikiBusy, setWikiBusy] = useState(false)
  const [wikiError, setWikiError] = useState<string | null>(null)
  const [wikiResult, setWikiResult] = useState<WikiOutfitResult | null>(null)

  const characterOptions = useMemo<LinkOption[]>(
    () => characterSummaries.map((c) => ({ key: c.key, name: c.name, image: c.image, sublabel: c.element })),
    [characterSummaries]
  )

  useEffect(() => { void window.api.characters.list(rootPath).then(setCharacterSummaries) }, [rootPath])

  const set = <K extends keyof Draft>(key: K, val: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: val }))

  const currentKey = draft.keyTouched && draft.keyOverride.trim()
    ? draft.keyOverride.trim()
    : deriveKey(draft.name)

  // Edit mode: target file is locked to the prop. Create mode: driven by outfit set selector.
  const outfitSet = mode === 'edit' && file ? setByFile(file) : setByFile(draft.outfitSetFile)

  // ── Wiki auto-fill ─────────────────────────────────────────────────────────────

  const fetchOutfitWiki = () => {
    const url = wikiUrl.trim() || draft.wiki.trim()
    if (!url) { setWikiError('Paste a Genshin Wiki outfit URL first.'); return }
    setWikiBusy(true)
    setWikiError(null)
    window.api.wiki
      .fetchOutfit(url)
      .then((r) => { setWikiResult(r); setWikiUrl(url) })
      .catch((e: unknown) => setWikiError(e instanceof Error ? e.message : String(e)))
      .finally(() => setWikiBusy(false))
  }

  const wikiData = useMemo(() => {
    const res = wikiResult
    const rows: WikiRow[] = []
    const apply: Record<string, (d: Draft) => Draft> = {}
    if (!res) return { rows, apply }

    const add = (
      row: Omit<WikiRow, 'changed'> & { changed?: boolean },
      fn?: (d: Draft) => Draft
    ) => {
      const changed = row.changed ?? (!!row.fetched.trim() && !eqi(row.fetched, row.current))
      rows.push({ ...row, changed })
      if (fn) apply[row.id] = fn
    }
    const field = (
      id: string, group: string, label: string, current: string, fetched: string | null,
      fn: (d: Draft, v: string) => Draft
    ) => {
      const v = fetched ?? ''
      if (!v) return
      add({ id, group, label, current, fetched: v }, (d) => fn(d, v))
    }

    // Identity
    field('o-name', 'Identity', 'Name', draft.name, res.name, (d, v) => ({
      ...d, name: v, ...(d.keyTouched ? {} : { keyOverride: deriveKey(v) })
    }))
    field('o-desc', 'Identity', 'Description', draft.description, res.description, (d, v) => ({ ...d, description: v }))
    field('o-obtained', 'Identity', 'Obtained', draft.obtained, res.obtained, (d, v) => ({ ...d, obtained: v }))
    field('o-wiki', 'Identity', 'Wiki URL', draft.wiki, res.wikiUrl, (d, v) => ({ ...d, wiki: v }))
    // Confirmation-only
    const confirm = (id: string, label: string, current: string, fetched: string | null) => {
      if (!fetched) return
      add({ id, group: 'Identity', label, current, fetched, confirmOnly: true, ok: eqi(current, fetched), changed: false })
    }
    confirm('o-char', 'Character', draft.characters[0] ?? '', res.character)
    confirm('o-set', 'Outfit set (locked)', outfitSet.type, res.type)
    confirm('o-rarity', 'Rarity', draft.rarity, res.rarity != null ? String(res.rarity) : null)

    // Lore
    field('o-lore', 'Lore', 'Lore', draft.lore, res.lore, (d, v) => ({ ...d, lore: v }))

    // Images (opt-in; Themed basename convention — review save-as for other sets)
    if (res.portraitUrl) {
      const base = `Outfit_${currentKey}_Portrait`
      add({ id: 'o-portrait', group: 'Image', label: 'Portrait', current: describeImage(draft.imageState),
        fetched: wikiIconFileName(res.portraitUrl, base), changed: false },
        (d) => ({ ...d, imageState: urlStateFromWiki(res.portraitUrl!, base) }))
    }
    if (res.wishUrl) {
      const base = `Outfit_${currentKey}_Preview`
      add({ id: 'o-wish', group: 'Image', label: 'Wish image', current: describeImage(draft.wishimageState),
        fetched: wikiIconFileName(res.wishUrl, base), changed: false },
        (d) => ({ ...d, wishimageState: urlStateFromWiki(res.wishUrl!, base) }))
    }

    return { rows, apply }
  }, [wikiResult, draft, currentKey, outfitSet])

  const applyWiki = (ids: string[]) => {
    setDraft((d) => ids.reduce((acc, id) => (wikiData.apply[id] ? wikiData.apply[id](acc) : acc), d))
    setWikiResult(null)
  }

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

    // Spread the original record first so any field not modelled by the form is preserved (edit mode:
    // `template` is the on-disk record; create mode: the skeleton). Explicit fields below override in
    // place, keeping the canonical key order (matching templates/misc.json).
    const record: OutfitRecord = {
      ...template,
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
      released_version: Number.parseFloat(draft.releasedVersion) || 1,
      released_version_name: draft.releasedVersionName.trim() || null,
      released: draft.released,
      wiki: draft.wiki.trim() || null,
      subCollection: {}
    }

    // `released_version_name` is absent (not null) on older records. Preserve that: only omit when the
    // user hasn't entered one AND the original record didn't have the key (else keep the null/value).
    if (!draft.releasedVersionName.trim() && !('released_version_name' in template))
      delete record.released_version_name

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
        <button type="button" className="btn-secondary btn-sm wiki-toggle"
          aria-expanded={showWiki} onClick={() => setShowWiki((v) => !v)}>
          {showWiki ? 'Hide auto-fill' : '✨ Auto-fill from wiki'}
        </button>
      </header>

      <div className="mat-form-grid">

        {/* ── Wiki auto-fill (toggled from the header) ── */}
        {showWiki && (
          <div className="field field-wide wiki-fetch-field">
            <div className="field-label">Auto-fill from Genshin Wiki</div>
            <div className="wiki-fetch-row">
              <input type="text" placeholder="Paste a fandom.com outfit page URL…" autoFocus
                value={wikiUrl} onChange={(e) => setWikiUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchOutfitWiki() } }} />
              <button type="button" className="btn-secondary" disabled={wikiBusy} onClick={fetchOutfitWiki}>
                {wikiBusy ? 'Fetching…' : 'Fetch'}
              </button>
            </div>
            {wikiError && <p className="field-help wiki-fetch-error">{wikiError}</p>}
            <p className="field-help">Fetches name, description, lore &amp; obtained; you pick which fields to apply.</p>
          </div>
        )}

        {/* ── Identity ── */}
        <div className="field">
          <label htmlFor="out-f1">Name<span className="req">*</span></label>
          <input id="out-f1"
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
          <label htmlFor="out-f2">Record key</label>
          <input id="out-f2"
            type="text"
            value={draft.keyTouched ? draft.keyOverride : deriveKey(draft.name)}
            onChange={(e) => setDraft((p) => ({ ...p, keyOverride: e.target.value, keyTouched: true }))}
          />
          <p className="field-help">Auto-derived from name; edit to override.</p>
        </div>

        {/* Outfit set → target file */}
        <div className="field">
          <label htmlFor="out-f3">Outfit set<span className="req">*</span></label>
          <select id="out-f3"
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
          <label htmlFor="out-f4">Type (readable)</label>
          <input id="out-f4"
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
          <div className="field-label">Rarity<span className="req">*</span></div>
          <RaritySelect value={draft.rarity} onChange={(v) => set('rarity', v)} options={[4, 5]} />
        </div>

        {/* Characters (multi-entry; character = characters[0]) */}
        <div className="field field-wide">
          <div className="field-label">Characters<span className="req">*</span></div>
          <EntityLinkInput
            rootPath={rootPath}
            value={draft.characters}
            onChange={(v) => set('characters', v)}
            options={characterOptions}
            placeholder="Type to search characters, or enter a custom key…"
          />
          <p className="field-help">
            The legacy <code>character</code> field is auto-set to the first entry
            {draft.characters[0] ? ` ("${draft.characters[0]}")` : ''}.
          </p>
        </div>

        {/* ── Description / lore ── */}
        <div className="field field-wide">
          <label htmlFor="out-f5">Description</label>
          <textarea id="out-f5" rows={2} value={draft.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        <div className="field field-wide">
          <label htmlFor="out-f6">Obtained</label>
          <textarea id="out-f6" rows={2} value={draft.obtained} onChange={(e) => set('obtained', e.target.value)} />
        </div>

        <div className="field field-wide">
          <label htmlFor="out-f7">Lore</label>
          <textarea id="out-f7" rows={3} value={draft.lore} onChange={(e) => set('lore', e.target.value)} />
        </div>

        {/* ── Images ── */}
        <div className="field field-wide">
          <div className="field-label">Images</div>
          <div className="image-field-row">
            <div className="image-field-item">
              <span className="image-field-item-label">Portrait</span>
              <ImageField
                rootPath={rootPath}
                imageFolder={outfitSet.folder}
                defaultBasename={currentKey || undefined}
                state={draft.imageState}
                onChange={(s) => set('imageState', s)}
              />
            </div>
            <div className="image-field-item">
              <span className="image-field-item-label">Thumbnail</span>
              <ImageField
                rootPath={rootPath}
                imageFolder="Characters"
                browseSourceFolders={['Characters', `Outfits/Thumbnail/${outfitSet.label}`]}
                defaultBasename={draft.characters[0] || currentKey || undefined}
                state={draft.thumbnailState}
                onChange={(s) => set('thumbnailState', s)}
              />
            </div>
            <div className="image-field-item">
              <span className="image-field-item-label">Wish image</span>
              <ImageField
                rootPath={rootPath}
                imageFolder={outfitSet.wishFolder}
                defaultBasename={currentKey || undefined}
                state={draft.wishimageState}
                onChange={(s) => set('wishimageState', s)}
              />
            </div>
          </div>
        </div>

        {/* ── 3D model ── */}
        <div className="field">
          <label htmlFor="out-f8">3D model (.glb)</label>
          <input id="out-f8" type="text" value={draft.model3d} onChange={(e) => set('model3d', e.target.value)} />
          <p className="field-help">Filename only, e.g. Amber.glb</p>
        </div>

        {/* ── Shop ── */}
        <div className="field">
          <div className="field-label">In shop</div>
          <label className="switch">
            <input type="checkbox" checked={draft.shop} onChange={(e) => set('shop', e.target.checked)} />
            <span>{draft.shop ? 'Yes' : 'No'}</span>
          </label>
        </div>

        {draft.shop && (
          <>
            <div className="field">
              <label htmlFor="out-f9">Shop cost</label>
              <input id="out-f9" type="number" min={0} value={draft.shopCost} onChange={(e) => set('shopCost', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="out-f10">Discounted cost</label>
              <input id="out-f10" type="number" min={0} value={draft.shopCostDiscounted} onChange={(e) => set('shopCostDiscounted', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="out-f11">Discount ends</label>
              <input id="out-f11" type="date" value={draft.shopCostDiscountedTill} onChange={(e) => set('shopCostDiscountedTill', e.target.value)} />
            </div>
          </>
        )}

        {/* ── Event ── */}
        <div className="field">
          <div className="field-label">Event (free)</div>
          <label className="switch">
            <input type="checkbox" checked={draft.eventGiveFree} onChange={(e) => set('eventGiveFree', e.target.checked)} />
            <span>{draft.eventGiveFree ? 'Yes' : 'No'}</span>
          </label>
        </div>

        {draft.eventGiveFree && (
          <div className="field">
            <label htmlFor="out-f12">Free until</label>
            <input id="out-f12" type="date" value={draft.eventGiveFreeTill} onChange={(e) => set('eventGiveFreeTill', e.target.value)} />
          </div>
        )}

        {/* ── Release ── */}
        <div className="field">
          <label htmlFor="out-f13">Released version</label>
          <input id="out-f13"
            type="text"
            value={draft.releasedVersion}
            onChange={(e) => set('releasedVersion', e.target.value)}
          />
          <p className="field-help">Float, e.g. 3.4</p>
        </div>

        <div className="field">
          <label htmlFor="out-f14">Version name</label>
          <input id="out-f14"
            type="text"
            value={draft.releasedVersionName}
            onChange={(e) => set('releasedVersionName', e.target.value)}
          />
          <p className="field-help">Optional label, e.g. "Luna III"</p>
        </div>

        <div className="field">
          <div className="field-label">Released</div>
          <label className="switch">
            <input type="checkbox" checked={draft.released} onChange={(e) => set('released', e.target.checked)} />
            <span>{draft.released ? 'Yes' : 'No'}</span>
          </label>
        </div>

        {/* ── Wiki ── */}
        <div className="field field-wide">
          <label htmlFor="out-f15">Wiki URL</label>
          <input id="out-f15" type="text" value={draft.wiki} onChange={(e) => set('wiki', e.target.value)} />
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
        {onDelete && (
          <button type="button"
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

      {wikiResult && (
        <WikiFillPanel
          sourceTitle={wikiResult.title}
          rows={wikiData.rows}
          groupOrder={['Identity', 'Lore', 'Image']}
          onApply={applyWiki}
          onClose={() => setWikiResult(null)}
        />
      )}
    </div>
  )
}
