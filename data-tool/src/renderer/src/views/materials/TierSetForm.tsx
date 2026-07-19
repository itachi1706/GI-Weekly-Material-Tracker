import { useState, useEffect, useMemo } from 'react'
import type { MaterialChange, MaterialRecord, WikiMaterialResult } from '@shared/types'
import {
  applyFormValues,
  deriveKey,
  defaultImageName,
  resolveImageFolder,
  resolveTiers,
  type MaterialTypeSchema,
  type TierItemConfig,
  type TierSetConfig
} from '@shared/materialsSchema'
import ImageField from './ImageField'
import { TagsInput, DaysSelect } from './MaterialForm'
import { extOf, sanitizeImageBasename, type ImageState } from './util'
import WikiFillPanel, { type WikiRow } from '../shared/WikiFillPanel'
import { urlStateFromWiki, wikiIconFileName, describeImage, eqi } from '../shared/wikiApply'
import { DAY_ABBR, CATEGORY_LABEL, inferWikiCategory } from './materialWiki'

// ── Per-tier state ────────────────────────────────────────────────────────────

interface TierData {
  name: string
  description: string
  obtained: string
  wiki: string
  hoyowiki: string
  imageState: ImageState
  keyOverride: string
  keyTouched: boolean
}

function emptyTier(): TierData {
  return {
    name: '', description: '', obtained: '', wiki: '', hoyowiki: '',
    imageState: { mode: 'none' }, keyOverride: '', keyTouched: false
  }
}

// ── Shared values initialiser ─────────────────────────────────────────────────

function initShared(schema: MaterialTypeSchema, fromRecord?: MaterialRecord): Record<string, unknown> {
  const config = schema.tierSet!
  const v: Record<string, unknown> = {}
  for (const key of config.sharedFieldKeys) {
    const field = schema.fields.find((f) => f.key === key)
    if (!field) continue
    if (fromRecord) {
      const raw = (fromRecord as Record<string, unknown>)[key]
      if (field.widget === 'tags' || field.widget === 'days') {
        v[key] = Array.isArray(raw) ? raw : []
      } else if (field.widget === 'bool') {
        v[key] = Boolean(raw ?? true)
      } else {
        v[key] = raw ?? ''
      }
    } else if (field.widget === 'bool') {
      v[key] = true
    } else if (field.widget === 'tags') {
      v[key] = []
    } else if (field.widget === 'days') {
      v[key] = []
    } else {
      v[key] = ''
    }
  }
  return v
}

function tierDataFromRecord(record: MaterialRecord, existingKey: string, config: TierSetConfig): TierData {
  return {
    name: String(record.name ?? ''),
    description: String(record.description ?? ''),
    obtained: config.sharedObtained ? '' : String(record.obtained ?? ''),
    wiki: String(record.wiki ?? ''),
    hoyowiki: String(record.hoyowiki ?? ''),
    imageState: record.image
      ? { mode: 'existing' as const, relative: String(record.image) }
      : { mode: 'none' as const },
    keyOverride: existingKey,
    keyTouched: true
  }
}

// ── Stars helper ─────────────────────────────────────────────────────────────

function stars(n: number): string {
  return '★'.repeat(Math.min(n, 5))
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  rootPath: string
  schema: MaterialTypeSchema
  templates: Record<string, MaterialRecord>
  /** When provided, the form opens in edit mode pre-populated with these records (sorted by rarity). */
  editRecords?: MaterialRecord[]
  editFile?: string
  editKeys?: string[]
  onPreview: (changes: MaterialChange[]) => void
  onDelete?: () => void
  onCancel: () => void
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TierSetForm({
  rootPath, schema, templates, editRecords, editFile, editKeys, onPreview, onDelete, onCancel
}: Readonly<Props>) {
  const config = schema.tierSet!

  const [shared, setShared] = useState<Record<string, unknown>>(() =>
    initShared(schema, editRecords?.[0])
  )
  const [tiers, setTiers] = useState<TierData[]>(() => {
    if (editRecords && editKeys) {
      return editRecords.map((r, i) => tierDataFromRecord(r, editKeys[i] ?? '', config))
    }
    return resolveTiers(config, {}).map(() => emptyTier())
  })
  const [errors, setErrors] = useState<string[]>([])
  // Wiki auto-fill — per-tier (each tier is a separate Fandom page). One active fetch at a time.
  const [wikiTier, setWikiTier] = useState<number | null>(null)
  const [wikiBusy, setWikiBusy] = useState(false)
  const [wikiError, setWikiError] = useState<string | null>(null)
  const [wikiResult, setWikiResult] = useState<WikiMaterialResult | null>(null)

  // Recompute tier count when domain type changes (forgery=4, mastery=3).
  const tierConfigs = resolveTiers(config, shared)
  useEffect(() => {
    setTiers((prev) => {
      if (prev.length === tierConfigs.length) return prev
      if (prev.length > tierConfigs.length) return prev.slice(0, tierConfigs.length)
      return [...prev, ...Array.from({ length: tierConfigs.length - prev.length }, emptyTier)]
    })
  }, [tierConfigs.length])

  const imageFolder = resolveImageFolder(schema, shared)

  const setSharedField = (key: string, val: unknown) =>
    setShared((prev) => ({ ...prev, [key]: val }))

  const updateTier = (i: number, patch: Partial<TierData>) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))

  const tierKey = (i: number) => {
    const t = tiers[i]
    if (!t) return ''
    return t.keyTouched && t.keyOverride.trim() ? t.keyOverride.trim() : deriveKey(t.name)
  }

  // Auto-fill alchemy obtained text from previous tier's name.
  const autoFillObtained = (i: number) => {
    const prevName = tiers[i - 1]?.name.trim() ?? ''
    updateTier(i, { obtained: prevName ? `- Alchemy (3x ${prevName})\n` : '' })
  }

  // Append one "- Dropped by <enemy>" line per enemy in the shared "Dropped By" list (mob drops).
  // Level qualifier by tier: tier 1 none, tier 2 "Lv.40+", tier 3 "Lv.60+" (dataset convention).
  // Appends (so it composes with the alchemy line); the user can still tweak wording afterward.
  const appendDroppedBy = (i: number) => {
    const enemies = ((shared['enemies'] as string[] | undefined) ?? []).map((e) => e.trim()).filter(Boolean)
    if (!enemies.length) return
    const qual = ['', 'Lv.40+ ', 'Lv.60+ '][i] ?? ''
    const lines = enemies.map((e) => `- Dropped by ${qual}${e}`).join('\n')
    const cur = tiers[i]?.obtained ?? ''
    const prefix = cur.trim() ? cur.replace(/\n+$/, '') + '\n' : ''
    updateTier(i, { obtained: prefix + lines })
  }

  // ── Wiki auto-fill (per tier) ────────────────────────────────────────────────

  const fetchTierWiki = (i: number) => {
    const url = tiers[i]?.wiki.trim() ?? ''
    setWikiTier(i)
    if (!url) { setWikiError('Paste a wiki URL for this tier first.'); return }
    setWikiBusy(true)
    setWikiError(null)
    setWikiResult(null)
    window.api.wiki
      .fetchMaterial(url)
      .then((r) => setWikiResult(r))
      .catch((e: unknown) => setWikiError(e instanceof Error ? e.message : String(e)))
      .finally(() => setWikiBusy(false))
  }

  // Review rows for the active tier. Identity/Image patch that tier; Details type/days patch the
  // SHARED section; rarity is confirm-only (each tier's rarity is fixed by position — catches a
  // wrong-tier paste). `apply` entries are tagged tier|shared|image and split in applyWiki.
  type TierApply =
    | { kind: 'tier'; patch: Partial<TierData> }
    | { kind: 'shared'; key: string; value: unknown }
    | { kind: 'image'; state: ImageState }
  const wikiData = useMemo(() => {
    const res = wikiResult
    const i = wikiTier
    const rows: WikiRow[] = []
    const apply: Record<string, TierApply> = {}
    if (res == null || i == null) return { rows, apply }
    const tier = tiers[i] ?? emptyTier()
    const cfg = tierConfigs[i]

    const add = (
      row: Omit<WikiRow, 'changed'> & { changed?: boolean },
      entry?: TierApply
    ) => {
      const changed = row.changed ?? (!!row.fetched.trim() && !eqi(row.fetched, row.current))
      rows.push({ ...row, changed })
      if (entry) apply[row.id] = entry
    }

    // Identity (→ this tier)
    if (res.name)
      add({ id: 't-name', group: 'Identity', label: 'Name', current: tier.name, fetched: res.name },
        { kind: 'tier', patch: { name: res.name, ...(tier.keyTouched ? {} : { keyOverride: deriveKey(res.name) }) } })
    if (res.description)
      add({ id: 't-desc', group: 'Identity', label: 'Description', current: tier.description, fetched: res.description },
        { kind: 'tier', patch: { description: res.description } })
    if (res.obtained) {
      if (config.sharedObtained)
        add({ id: 't-obtained', group: 'Identity', label: 'Obtained (shared)', current: String(shared['obtained'] ?? ''), fetched: res.obtained },
          { kind: 'shared', key: 'obtained', value: res.obtained })
      else
        add({ id: 't-obtained', group: 'Identity', label: 'Obtained', current: tier.obtained, fetched: res.obtained },
          { kind: 'tier', patch: { obtained: res.obtained } })
    }
    if (res.wikiUrl)
      add({ id: 't-wiki', group: 'Identity', label: 'Wiki URL', current: tier.wiki, fetched: res.wikiUrl },
        { kind: 'tier', patch: { wiki: res.wikiUrl } })

    // Details — category confirm (mismatch = wrong page), shared days, tier-rarity confirm.
    const inferred = inferWikiCategory(res)
    if (inferred)
      add({ id: 't-category', group: 'Details', label: 'Category', current: CATEGORY_LABEL[schema.innerType] ?? schema.innerType,
        fetched: CATEGORY_LABEL[inferred] ?? inferred, confirmOnly: true, ok: inferred === schema.innerType, changed: false,
        note: inferred === schema.innerType ? undefined : 'pasted page is a different material category' })
    if (config.sharedFieldKeys.includes('days') && res.days) {
      const disp = (arr: number[]): string => arr.map((n) => DAY_ABBR[n] ?? n).join('/')
      add({ id: 't-days', group: 'Details', label: 'Available days (shared)', current: disp((shared['days'] as number[]) ?? []), fetched: disp(res.days) },
        { kind: 'shared', key: 'days', value: res.days })
    }
    if (cfg && res.rarity != null)
      add({ id: 't-rarity', group: 'Details', label: `Rarity (tier ${i + 1})`, current: String(cfg.rarity),
        fetched: String(res.rarity), confirmOnly: true, ok: res.rarity === cfg.rarity, changed: false,
        note: res.rarity === cfg.rarity ? undefined : 'does not match this tier — wrong page?' })

    // Image (→ this tier). Basename from the FETCHED name (first-fill resolves the real name, not "Item_").
    if (res.iconUrl) {
      const base = `Item_${deriveKey(String(res.name ?? '')) || tierKey(i)}`
      const file = wikiIconFileName(res.iconUrl, base)
      add({ id: 't-icon', group: 'Image', label: 'Icon', current: describeImage(tier.imageState), fetched: file,
        changed: describeImage(tier.imageState) !== file },
        { kind: 'image', state: urlStateFromWiki(res.iconUrl, base) })
    }

    return { rows, apply }
  }, [wikiResult, wikiTier, tiers, shared, tierConfigs, config, schema])

  const applyWiki = (ids: string[]) => {
    const i = wikiTier
    if (i == null) { setWikiResult(null); return }
    let tierPatch: Partial<TierData> = {}
    const sharedUpdates: Record<string, unknown> = {}
    for (const id of ids) {
      const e = wikiData.apply[id]
      if (!e) continue
      if (e.kind === 'tier') tierPatch = { ...tierPatch, ...e.patch }
      else if (e.kind === 'image') tierPatch = { ...tierPatch, imageState: e.state }
      else if (e.kind === 'shared') sharedUpdates[e.key] = e.value
    }
    if (Object.keys(tierPatch).length) updateTier(i, tierPatch)
    if (Object.keys(sharedUpdates).length) setShared((prev) => ({ ...prev, ...sharedUpdates }))
    setWikiResult(null)
    setWikiTier(null)
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = (): string[] => {
    const errs: string[] = []

    for (const key of config.sharedFieldKeys) {
      const field = schema.fields.find((f) => f.key === key)
      if (!field?.required) continue
      const v = shared[key]
      if (field.widget === 'tags') {
        if (!(v as string[]).length) errs.push(`${field.label} is required.`)
      } else if (field.widget === 'days') {
        if (!(v as number[]).length) errs.push(`${field.label}: select at least one day.`)
      } else if (!v || String(v).trim() === '') {
        errs.push(`${field.label} is required.`)
      }
    }

    tierConfigs.forEach((_, i) => {
      if (!tiers[i]?.name.trim()) errs.push(`Tier ${i + 1}: Name is required.`)
    })

    return errs
  }

  // ── Build changes ───────────────────────────────────────────────────────────

  const buildChanges = (): MaterialChange[] => {
    const targetFile = schema.deriveFile(shared)

    return tierConfigs.map((cfg: TierItemConfig, i: number) => {
      const tier = tiers[i] ?? emptyTier()
      const base = (templates[cfg.templateKey ?? schema.templateKey] ??
        { innerType: schema.innerType }) as MaterialRecord

      const key = tierKey(i)

      // Image path resolution
      const st = tier.imageState
      let imageRelative = ''
      let imagePlan: MaterialChange['image']

      if (st.mode === 'existing') {
        imageRelative = st.relative
        imagePlan = { source: 'existing', relativePath: st.relative }
      } else if (st.mode === 'localFile') {
        const ext = extOf(st.sourcePath)
        const basename = st.imageName?.trim()
          ? `${st.imageName.trim()}.${ext}`
          : defaultImageName(key, ext)
        imageRelative = `${imageFolder}/${basename}`
        imagePlan = { source: 'localFile', sourcePath: st.sourcePath, destRelative: imageRelative }
      } else if (st.mode === 'url') {
        const ext = extOf(st.url)
        const basename = st.imageName?.trim()
          ? `${st.imageName.trim()}.${ext}`
          : `${sanitizeImageBasename(st.url)}.${ext}`
        imageRelative = `${imageFolder}/${basename}`
        imagePlan = { source: 'url', url: st.url, destRelative: imageRelative }
      }

      // Obtained: shared (weekly boss) or per-tier
      const obtained = config.sharedObtained
        ? String(shared['obtained'] ?? '')
        : tier.obtained

      const values: Record<string, unknown> = {
        ...shared,
        name: tier.name.trim(),
        rarity: String(cfg.rarity),
        description: tier.description.trim() || null,
        obtained: obtained.trim() || null,
        wiki: tier.wiki.trim() || null,
        hoyowiki: tier.hoyowiki.trim() || null,
        image: imageRelative
      }

      const record = applyFormValues(base, schema, values)

      return {
        op: editRecords ? 'update' as const : 'create' as const,
        file: editFile ?? targetFile,
        key,
        originalKey: editRecords ? (editKeys?.[i] ?? key) : undefined,
        record,
        ordering: editRecords ? 'alphabetical' as const : 'append' as const,
        image: imagePlan
      }
    })
  }

  const submitPreview = () => {
    const errs = validate()
    setErrors(errs)
    if (errs.length) return
    onPreview(buildChanges())
  }

  // ── Shared field renderer ───────────────────────────────────────────────────

  const renderSharedField = (key: string) => {
    const field = schema.fields.find((f) => f.key === key)
    if (!field) return null
    const v = shared[key]

    if (field.widget === 'select') {
      return (
        <div className="field" key={key}>
          <label htmlFor="tsf-f1">{field.label}{field.required && <span className="req">*</span>}</label>
          <select id="tsf-f1" value={String(v ?? '')} onChange={(e) => setSharedField(key, e.target.value)}>
            <option value="">— select —</option>
            {field.options?.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
            ))}
          </select>
        </div>
      )
    }
    if (field.widget === 'tags') {
      return (
        <div className="field field-wide" key={key}>
          <label>{field.label}{field.required && <span className="req">*</span>}</label>
          <TagsInput
            value={Array.isArray(v) ? (v as string[]) : []}
            onChange={(tags) => setSharedField(key, tags)}
          />
          {field.help && <p className="field-help">{field.help}</p>}
        </div>
      )
    }
    if (field.widget === 'days') {
      return (
        <div className="field field-wide" key={key}>
          <label>{field.label}{field.required && <span className="req">*</span>}</label>
          <DaysSelect
            value={Array.isArray(v) ? (v as number[]) : []}
            onChange={(days) => setSharedField(key, days)}
          />
        </div>
      )
    }
    if (field.widget === 'bool') {
      return (
        <div className="field" key={key}>
          <label>{field.label}</label>
          <label className="switch">
            <input
              type="checkbox"
              checked={Boolean(v)}
              onChange={(e) => setSharedField(key, e.target.checked)}
            />
            <span>{v ? 'Yes' : 'No'}</span>
          </label>
        </div>
      )
    }
    if (field.widget === 'textarea') {
      return (
        <div className="field field-wide" key={key}>
          <label htmlFor="tsf-f2">{field.label}{field.required && <span className="req">*</span>}</label>
          <textarea id="tsf-f2"
            rows={3}
            value={String(v ?? '')}
            onChange={(e) => setSharedField(key, e.target.value)}
          />
          {field.help && <p className="field-help">{field.help}</p>}
        </div>
      )
    }
    return (
      <div className="field" key={key}>
        <label htmlFor="tsf-f3">{field.label}{field.required && <span className="req">*</span>}</label>
        <input id="tsf-f3"
          type="text"
          value={String(v ?? '')}
          onChange={(e) => setSharedField(key, e.target.value)}
        />
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mat-tier-form">
      <header className="mat-form-head">
        <h2>{editRecords ? 'Edit' : 'New'} {schema.label}</h2>
        <span className="pill">{tierConfigs.length}-item set</span>
      </header>

      {/* Shared fields */}
      <div className="tier-shared-section">
        <p className="tier-shared-label">Shared across all tiers</p>
        <div className="mat-form-grid">
          {config.sharedFieldKeys.map((key) => renderSharedField(key))}
        </div>
      </div>

      {/* Per-tier cards */}
      <div className="tier-cards-grid">
      {tierConfigs.map((cfg: TierItemConfig, i: number) => {
        const tier = tiers[i] ?? emptyTier()
        const key = tierKey(i)
        const showAlchemy = config.autoAlchemy && i > 0
        const tierDefaultBasename = key ? `Item_${key}` : undefined

        return (
          <div className="tier-card" key={i}>
            <div className="tier-card-header">
              <span className="tier-card-title">Tier {i + 1}</span>
              <span className="tier-stars">{stars(cfg.rarity)}</span>
              <span className="tier-rarity-label muted">Rarity {cfg.rarity}</span>
            </div>
            <div className="tier-card-body">
              <div className="mat-form-grid">
                {/* Name → key */}
                <div className="field">
                  <label htmlFor="tsf-f4">Name<span className="req">*</span></label>
                  <input id="tsf-f4"
                    type="text"
                    value={tier.name}
                    onChange={(e) => {
                      const name = e.target.value
                      updateTier(i, {
                        name,
                        ...(!tier.keyTouched ? { keyOverride: deriveKey(name) } : {})
                      })
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="tsf-f5">Record key</label>
                  <input id="tsf-f5"
                    type="text"
                    value={tier.keyTouched ? tier.keyOverride : deriveKey(tier.name)}
                    onChange={(e) => updateTier(i, { keyOverride: e.target.value, keyTouched: true })}
                  />
                  <p className="field-help">Auto-derived from name; edit to override.</p>
                </div>

                {/* Description */}
                <div className="field field-wide">
                  <label htmlFor="tsf-f6">Description</label>
                  <textarea id="tsf-f6"
                    rows={2}
                    value={tier.description}
                    onChange={(e) => updateTier(i, { description: e.target.value })}
                  />
                </div>

                {/* Obtained — skip if sharedObtained (it's in the shared section) */}
                {!config.sharedObtained && (
                  <div className="field field-wide">
                    <label htmlFor="tsf-f7">
                      Obtained
                      {showAlchemy && (
                        <button
                          type="button"
                          className="tier-alchemy-btn"
                          title={`Fill "Alchemy (3x ${tiers[i - 1]?.name.trim() || '…'})"`}
                          onClick={() => autoFillObtained(i)}
                        >
                          ↩ Auto-fill alchemy
                        </button>
                      )}
                      {config.sharedFieldKeys.includes('enemies') && (
                        <button
                          type="button"
                          className="tier-alchemy-btn"
                          title="Append a '- Dropped by <enemy>' line per enemy in the Dropped By list"
                          onClick={() => appendDroppedBy(i)}
                        >
                          + Dropped by
                        </button>
                      )}
                    </label>
                    <textarea id="tsf-f7"
                      rows={2}
                      value={tier.obtained}
                      onChange={(e) => updateTier(i, { obtained: e.target.value })}
                    />
                  </div>
                )}

                {/* Image */}
                <div className="field field-wide">
                  <label>Image</label>
                  <ImageField
                    rootPath={rootPath}
                    imageFolder={imageFolder}
                    defaultBasename={tierDefaultBasename}
                    state={tier.imageState}
                    onChange={(s) => updateTier(i, { imageState: s })}
                  />
                </div>

                {/* Wiki + HoYoWiki */}
                <div className="field">
                  <label>Wiki URL</label>
                  <div className="wiki-fetch-row">
                    <input
                      type="text"
                      placeholder="Paste this tier's page URL…"
                      value={tier.wiki}
                      onChange={(e) => updateTier(i, { wiki: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchTierWiki(i) } }}
                    />
                    <button type="button" className="btn-secondary" disabled={wikiBusy && wikiTier === i}
                      onClick={() => fetchTierWiki(i)}>
                      {wikiBusy && wikiTier === i ? 'Fetching…' : '✨ Fetch'}
                    </button>
                  </div>
                  {wikiError && wikiTier === i && <p className="field-help wiki-fetch-error">{wikiError}</p>}
                </div>
                <div className="field">
                  <label htmlFor="tsf-f8">HoYoWiki ID</label>
                  <input id="tsf-f8"
                    type="number"
                    value={tier.hoyowiki}
                    onChange={(e) => updateTier(i, { hoyowiki: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        )
      })}
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
              if (confirm(`Delete all ${tierConfigs.length} tiers of this set? This can be reviewed in the preview before it's applied.`))
                onDelete()
            }}
          >
            Delete set
          </button>
        )}
      </footer>

      {wikiResult && wikiTier !== null && (
        <WikiFillPanel
          sourceTitle={`${wikiResult.title} → Tier ${wikiTier + 1}`}
          rows={wikiData.rows}
          groupOrder={['Identity', 'Details', 'Image']}
          onApply={applyWiki}
          onClose={() => { setWikiResult(null); setWikiTier(null) }}
        />
      )}
    </div>
  )
}
