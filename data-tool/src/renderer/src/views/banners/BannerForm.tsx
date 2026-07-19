import { useEffect, useState } from 'react'
import type { BannerRecord, BannerChange, BannerType, ImagePlan } from '@shared/types'
import ImageField from '../materials/ImageField'
import { extOf, sanitizeImageBasename, type ImageState } from '../materials/util'
import { EntityLinkInput, type LinkOption } from '../shared/entityLink'

const BANNER_TYPES: BannerType[] = ['character', 'weapon', 'standard', 'chronicled']
const TYPE_LABEL: Record<BannerType, string> = {
  character: 'Character', weapon: 'Weapon', standard: 'Standard', chronicled: 'Chronicled'
}
const IMAGE_FOLDER: Record<BannerType, string> = {
  character: 'Banners/Character', weapon: 'Banners/Weapon',
  standard: 'Banners/Standard', chronicled: 'Banners/Chronicled'
}

// ── Date helpers (on-disk: "YYYY-MM-DDTHH:00:00+08" start / "…THH:59:59+08" end, GMT+8) ──────────

function parseIso(s: string | null | undefined): { date: string; hour: string } {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):/.exec(String(s ?? ''))
  return m ? { date: m[1], hour: m[2] } : { date: '', hour: '' }
}
function startIso(date: string, hour: string): string | null {
  return date ? `${date}T${hour.padStart(2, '0')}:00:00+08` : null
}
function endIso(date: string, hour: string): string | null {
  return date ? `${date}T${hour.padStart(2, '0')}:59:59+08` : null
}

// ── Image entry builder ───────────────────────────────────────────────────────

function buildImageEntry(
  state: ImageState, folder: string, defaultName: string
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

function stateFromImage(path: string | null | undefined): ImageState {
  const p = String(path ?? '')
  return p && !p.endsWith('/') ? { mode: 'existing', relative: p } : { mode: 'none' }
}

const emptyToNull = (s: string): string | null => (s.trim() ? s.trim() : null)
const numOrNull = (s: string): number | null => (s.trim() && !Number.isNaN(Number(s)) ? Number(s) : null)

// ── Draft ─────────────────────────────────────────────────────────────────────

interface Draft {
  type: BannerType
  name: string
  startDate: string
  startHour: string
  endDate: string
  endHour: string
  description: string
  characters: string[]
  weapons: string[]
  rateupcharacters: string[]
  rateupweapon: string[]
  softpity: string
  hardpity: string
  versionNumber: string
  versionName: string
  wiki: string
  imageState: ImageState
}

function draftFromRecord(rec: BannerRecord, bannerType: BannerType, mode: 'create' | 'edit'): Draft {
  const s = parseIso(rec.start)
  const e = parseIso(rec.end)
  return {
    type: (rec.type as BannerType) ?? bannerType,
    // Create clones the previous banner's name too (user edits it); wiki/image start blank as
    // they're truly per-banner unique (wiki URL is date-stamped, image is banner-specific).
    name: String(rec.name ?? ''),
    startDate: s.date,
    startHour: s.hour || '11',
    endDate: e.date,
    endHour: e.hour || '17',
    description: String(rec.description ?? ''),
    characters: Array.isArray(rec.characters) ? [...rec.characters] : [],
    weapons: Array.isArray(rec.weapons) ? [...rec.weapons] : [],
    rateupcharacters: Array.isArray(rec.rateupcharacters) ? [...rec.rateupcharacters] : [],
    rateupweapon: Array.isArray(rec.rateupweapon) ? [...rec.rateupweapon] : [],
    softpity: rec.softpity != null ? String(rec.softpity) : '',
    hardpity: rec.hardpity != null ? String(rec.hardpity) : '',
    versionNumber: rec.versionNumber != null ? String(rec.versionNumber) : '',
    versionName: String(rec.versionName ?? ''),
    wiki: mode === 'create' ? '' : String(rec.wiki ?? ''),
    imageState: mode === 'create' ? { mode: 'none' } : stateFromImage(rec.image)
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  rootPath: string
  mode: 'create' | 'edit'
  record: BannerRecord
  bannerType: BannerType
  index?: number
  /** Re-seed a fresh banner from the most-recent banner of a type (create mode, on type change). */
  seedFor: (type: BannerType) => Promise<BannerRecord>
  onPreview: (change: BannerChange) => void
  onDelete?: () => void
  onCancel: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BannerForm({
  rootPath, mode, record, bannerType, index, seedFor, onPreview, onDelete, onCancel
}: Props) {
  const [base, setBase] = useState<BannerRecord>(record)
  const [draft, setDraft] = useState<Draft>(() => draftFromRecord(record, bannerType, mode))
  const [errors, setErrors] = useState<string[]>([])
  const [charOpts, setCharOpts] = useState<LinkOption[]>([])
  const [weaponOpts, setWeaponOpts] = useState<LinkOption[]>([])
  const [poolOpen, setPoolOpen] = useState(false)

  useEffect(() => {
    void window.api.characters.list(rootPath).then((cs) =>
      setCharOpts(cs.map((c) => ({ key: c.key, name: c.name, image: c.image, sublabel: c.element }))))
    void window.api.weapons.list(rootPath).then((ws) =>
      setWeaponOpts(ws.map((w) => ({ key: w.key, name: w.name, image: w.image, sublabel: w.type }))))
  }, [rootPath])

  const set = <K extends keyof Draft>(key: K, val: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: val }))

  const imageFolder = IMAGE_FOLDER[draft.type]
  const defaultImageName = (draft.name.trim() || 'banner').replace(/[^a-zA-Z0-9\-_]/g, '_')

  // Create mode: switching type re-seeds from that type's most-recent banner.
  const onTypeChange = async (type: BannerType) => {
    if (mode === 'edit') return
    const seed = await seedFor(type)
    setBase(seed)
    setDraft(draftFromRecord(seed, type, 'create'))
  }

  const validate = (): string[] => {
    const errs: string[] = []
    if (!draft.name.trim()) errs.push('Name is required.')
    if (!draft.type) errs.push('Type is required.')
    if (!draft.startDate) errs.push('Start date is required.')
    if (!draft.endDate) errs.push('End date is required.')
    return errs
  }

  const buildChange = (): BannerChange => {
    const img = buildImageEntry(draft.imageState, imageFolder, defaultImageName)

    const record: BannerRecord = {
      ...base,
      name: draft.name.trim() || null,
      start: startIso(draft.startDate, draft.startHour),
      end: endIso(draft.endDate, draft.endHour),
      description: emptyToNull(draft.description),
      type: draft.type,
      characters: draft.characters,
      weapons: draft.weapons,
      rateupcharacters: draft.rateupcharacters,
      rateupweapon: draft.rateupweapon,
      softpity: numOrNull(draft.softpity),
      hardpity: numOrNull(draft.hardpity),
      wiki: emptyToNull(draft.wiki),
      image: img.path
    }
    // versionNumber (absent on 98) and versionName (absent on 239) are omitted, not null, on many
    // banners — preserve presence/position; only write when base had it or the user entered a value.
    if ('versionNumber' in base) record.versionNumber = numOrNull(draft.versionNumber)
    else if (draft.versionNumber.trim()) record.versionNumber = numOrNull(draft.versionNumber)
    if ('versionName' in base) record.versionName = emptyToNull(draft.versionName)
    else if (draft.versionName.trim()) record.versionName = draft.versionName.trim()

    return {
      op: mode === 'edit' ? 'update' : 'create',
      bannerType: draft.type,
      index: mode === 'edit' ? index : undefined,
      record,
      image: img.plan
    }
  }

  const submitPreview = () => {
    const errs = validate()
    setErrors(errs)
    if (!errs.length) onPreview(buildChange())
  }

  return (
    <div className="mat-form">
      <header className="mat-form-head">
        <h2>{mode === 'edit' ? 'Edit' : 'New'} Banner</h2>
        {mode === 'edit' && <span className="pill">{TYPE_LABEL[draft.type]}</span>}
      </header>

      {/* Hero banner image — full-width, click to open the picker modal. */}
      <div className="banner-hero">
        <ImageField
          rootPath={rootPath}
          imageFolder={imageFolder}
          defaultBasename={defaultImageName}
          state={draft.imageState}
          onChange={(s) => set('imageState', s)}
          variant="hero"
        />
      </div>

      <div className="mat-form-grid">
        <div className="field">
          <label>Type<span className="req">*</span></label>
          <select value={draft.type} disabled={mode === 'edit'}
            onChange={(e) => void onTypeChange(e.target.value as BannerType)}>
            {BANNER_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          {mode === 'edit'
            ? <p className="field-help">Cannot move a banner between type arrays.</p>
            : <p className="field-help">Seeds fields from the most recent {TYPE_LABEL[draft.type]} banner.</p>}
        </div>

        <div className="field">
          <label>Name<span className="req">*</span></label>
          <input type="text" value={draft.name} onChange={(e) => set('name', e.target.value)} />
          <p className="field-help">e.g. "Epitome Invocation (C)"</p>
        </div>

        {/* Start / End: date + hour (GMT+8); start → :00:00, end → :59:59 */}
        <div className="field">
          <label>Start<span className="req">*</span></label>
          <div className="banner-datetime">
            <input type="date" value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
            <select value={draft.startHour} onChange={(e) => set('startHour', e.target.value)}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
          <p className="field-help">GMT+8; seconds fixed at :00.</p>
        </div>

        <div className="field">
          <label>End<span className="req">*</span></label>
          <div className="banner-datetime">
            <input type="date" value={draft.endDate} onChange={(e) => set('endDate', e.target.value)} />
            <select value={draft.endHour} onChange={(e) => set('endHour', e.target.value)}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={String(h)}>{String(h).padStart(2, '0')}:59</option>
              ))}
            </select>
          </div>
          <p className="field-help">GMT+8; minutes/seconds fixed at :59:59.</p>
        </div>

        <div className="field field-wide">
          <label>Description</label>
          <textarea rows={3} value={draft.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        {/* Rate-up (primary edit surface) */}
        <div className="field field-wide">
          <label>Rate-up characters</label>
          <EntityLinkInput
            rootPath={rootPath}
            value={draft.rateupcharacters}
            onChange={(v) => set('rateupcharacters', v)}
            options={charOpts}
            placeholder="Type to search characters, or enter a custom key…"
          />
        </div>

        <div className="field field-wide">
          <label>Rate-up weapons</label>
          <EntityLinkInput
            rootPath={rootPath}
            value={draft.rateupweapon}
            onChange={(v) => set('rateupweapon', v)}
            options={weaponOpts}
            placeholder="Type to search weapons, or enter a custom key…"
          />
        </div>

        {/* Pity + version */}
        <div className="field">
          <label>Soft pity</label>
          <input type="number" min={0} value={draft.softpity} onChange={(e) => set('softpity', e.target.value)} />
        </div>
        <div className="field">
          <label>Hard pity</label>
          <input type="number" min={0} value={draft.hardpity} onChange={(e) => set('hardpity', e.target.value)} />
        </div>
        <div className="field">
          <label>Version number</label>
          <input type="number" step="0.1" min={0} value={draft.versionNumber}
            onChange={(e) => set('versionNumber', e.target.value)} />
          <p className="field-help">e.g. 6.6</p>
        </div>
        <div className="field">
          <label>Version name</label>
          <input type="text" value={draft.versionName} onChange={(e) => set('versionName', e.target.value)} />
          <p className="field-help">Optional, e.g. "Luna VII".</p>
        </div>

        <div className="field field-wide">
          <label>Wiki URL</label>
          <input type="text" value={draft.wiki} onChange={(e) => set('wiki', e.target.value)} />
        </div>

        {/* Gacha pool (large; collapsed). Contents render only once expanded so the (100+) pool
            thumbnails don't all load on mount and lag the edit screen. */}
        <div className="field field-wide">
          <details className="banner-pool" onToggle={(e) => setPoolOpen((e.currentTarget as HTMLDetailsElement | null)?.open ?? false)}>
            <summary>Gacha pool ({draft.characters.length} characters, {draft.weapons.length} weapons)</summary>
            {poolOpen && (
            <div className="banner-pool-body">
              <label>Pool characters</label>
              <EntityLinkInput
                rootPath={rootPath}
                value={draft.characters}
                onChange={(v) => set('characters', v)}
                options={charOpts}
                placeholder="Add a character to the pool…"
              />
              <label>Pool weapons</label>
              <EntityLinkInput
                rootPath={rootPath}
                value={draft.weapons}
                onChange={(v) => set('weapons', v)}
                options={weaponOpts}
                placeholder="Add a weapon to the pool…"
              />
            </div>
            )}
          </details>
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="form-errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}

      <footer className="mat-form-actions">
        <button className="btn-primary" onClick={submitPreview}>Preview changes</button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        {onDelete && (
          <button className="btn-danger"
            onClick={() => { if (confirm('Delete this banner? Reviewable in the preview before applying.')) onDelete() }}>
            Delete
          </button>
        )}
      </footer>
    </div>
  )
}
