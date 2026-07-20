import { useState } from 'react'
import type { MaterialChange, MaterialRecord, MaterialSummary, CommitPreview as Preview } from '@shared/types'
import {
  applyFormValues,
  CREATE_OPTIONS,
  defaultImageName,
  findTierSetSiblings,
  getMaterialSchema,
  resolveImageFolder,
  type CreateOption,
  type MaterialTypeSchema
} from '@shared/materialsSchema'
import { useMaterials } from './useMaterials'
import MaterialsList from './MaterialsList'
import MaterialForm, { type FormDraft } from './MaterialForm'
import TierSetForm from './TierSetForm'
import CommitPreview from './CommitPreview'
import { extOf, sanitizeImageBasename, toImagePlan } from './util'

interface FormContext {
  op: 'create' | 'edit'
  schema: MaterialTypeSchema
  base: MaterialRecord
  /** Source file — always set for edit; empty string for create (derived from schema at preview time). */
  file: string
  originalKey?: string
}

type Screen =
  | { kind: 'list' }
  | { kind: 'typePick' }
  | { kind: 'form'; ctx: FormContext }
  | {
      kind: 'tierSetForm'
      schema: MaterialTypeSchema
      templates: Record<string, MaterialRecord>
      editRecords?: MaterialRecord[]
      editFile?: string
      editKeys?: string[]
    }
  | { kind: 'view'; row: MaterialSummary; record: MaterialRecord }

export default function MaterialsView({ rootPath }: Readonly<{ rootPath: string }>) {
  const { list, loading, reload } = useMaterials(rootPath)
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  const [listQuery, setListQuery] = useState('')
  const [listTypeFilter, setListTypeFilter] = useState('')
  const [preview, setPreview] = useState<{
    data: Preview
    change?: MaterialChange
    changes?: MaterialChange[]
  } | null>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goList = () => {
    setScreen({ kind: 'list' })
    setPreview(null)
    setError(null)
  }

  // ── Create flow ─────────────────────────────────────────────────────────────

  const onNew = () => setScreen({ kind: 'typePick' })

  const onPickCreateOption = async (opt: CreateOption) => {
    const templates = await window.api.materials.templates(rootPath)
    if (opt.schema.createMode === 'tier_set') {
      setScreen({ kind: 'tierSetForm', schema: opt.schema, templates })
    } else {
      const base = (templates[opt.schema.templateKey] ?? { innerType: opt.schema.innerType }) as MaterialRecord
      setScreen({ kind: 'form', ctx: { op: 'create', schema: opt.schema, base, file: '' } })
    }
  }

  // ── Open existing record ────────────────────────────────────────────────────

  const onOpen = async (row: MaterialSummary) => {
    const record = await window.api.materials.get(rootPath, row.file, row.key)
    if (!record) return
    const schema = getMaterialSchema(row.innerType, row.file)
    if (!schema) {
      setScreen({ kind: 'view', row, record })
      return
    }

    // For tier-set schemas, try to open the full set in TierSetForm edit mode.
    if (schema.createMode === 'tier_set') {
      const allRecords = await window.api.materials.listFile(rootPath, row.file)
      const siblings = findTierSetSiblings(record, row.innerType, row.file, allRecords)
      if (siblings) {
        const templates = await window.api.materials.templates(rootPath)
        setScreen({
          kind: 'tierSetForm',
          schema,
          templates,
          editRecords: siblings.map((s) => s.record),
          editFile: row.file,
          editKeys: siblings.map((s) => s.key)
        })
        return
      }
    }

    setScreen({ kind: 'form', ctx: { op: 'edit', schema, base: record, file: row.file, originalKey: row.key } })
  }

  // ── Form → preview (single record) ─────────────────────────────────────────

  const onFormPreview = async (ctx: FormContext, draft: FormDraft) => {
    const { schema } = ctx
    const st = draft.imageState
    let ext = 'png'
    if (st.mode === 'localFile') ext = extOf(st.sourcePath)
    else if (st.mode === 'url') ext = extOf(st.url)

    const imgFolder = resolveImageFolder(schema, draft.values)

    let destFilename: string
    if (st.mode === 'url') {
      const base = st.imageName?.trim() || sanitizeImageBasename(st.url)
      destFilename = `${base}.${ext}`
    } else if (st.mode === 'localFile') {
      const base = st.imageName?.trim()
      destFilename = base ? `${base}.${ext}` : defaultImageName(draft.key, ext)
    } else {
      destFilename = defaultImageName(draft.key, ext)
    }
    const destRelative = `${imgFolder}/${destFilename}`

    let imageRelative = destRelative
    if (st.mode === 'existing') imageRelative = st.relative
    else if (st.mode === 'none') imageRelative = ''

    const record = applyFormValues(ctx.base, schema, { ...draft.values, image: imageRelative })

    const targetFile = ctx.op === 'edit' ? ctx.file : schema.deriveFile(draft.values)

    const change: MaterialChange = {
      op: ctx.op === 'edit' ? 'update' : 'create',
      file: targetFile,
      key: draft.key,
      originalKey: ctx.op === 'edit' ? ctx.originalKey : undefined,
      record,
      ordering: draft.ordering,
      image: toImagePlan(st, destRelative) ?? undefined
    }
    setError(null)
    const data = await window.api.materials.previewCommit(rootPath, change)
    setPreview({ data, change })
  }

  // ── Tier-set → preview (batch) ──────────────────────────────────────────────

  const onBatchPreview = async (changes: MaterialChange[]) => {
    setError(null)
    const data = await window.api.materials.previewBatch(rootPath, changes)
    setPreview({ data, changes })
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  const onDelete = (ctx: FormContext) => {
    if (!ctx.originalKey) return
    if (!confirm(`Delete "${ctx.originalKey}"? This stages a removal you can still reject in the preview.`))
      return
    const change: MaterialChange = {
      op: 'delete',
      file: ctx.file,
      key: ctx.originalKey,
      ordering: 'alphabetical'
    }
    void window.api.materials.previewCommit(rootPath, change).then((data) => {
      setError(null)
      setPreview({ data, change })
    })
  }

  // ── Delete tier set ─────────────────────────────────────────────────────────

  const onDeleteTierSet = (file: string, keys: string[]) => {
    const changes: MaterialChange[] = keys.map((key) => ({
      op: 'delete',
      file,
      key,
      ordering: 'alphabetical'
    }))
    void onBatchPreview(changes)
  }

  // ── Apply ───────────────────────────────────────────────────────────────────

  const onApply = async () => {
    if (!preview) return
    setApplying(true)
    const res = preview.changes
      ? await window.api.materials.batchCommit(rootPath, preview.changes)
      : await window.api.materials.commit(rootPath, preview.change!)
    setApplying(false)
    if (res.ok) {
      await reload()
      goList()
    } else {
      setError(res.error ?? 'Commit failed.')
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="materials">
      {screen.kind === 'list' && (
        <MaterialsList
          rootPath={rootPath} list={list} loading={loading}
          query={listQuery} typeFilter={listTypeFilter}
          onQueryChange={setListQuery} onTypeFilterChange={setListTypeFilter}
          onNew={onNew} onOpen={onOpen}
        />
      )}

      {screen.kind === 'typePick' && (
        <div className="type-pick">
          <header className="mat-form-head">
            <h2>New material — choose type</h2>
          </header>
          <div className="type-pick-grid">
            {CREATE_OPTIONS.map((opt) => (
              <button
                key={opt.schemaKey}
                type="button"
                className="type-pick-card"
                onClick={() => void onPickCreateOption(opt)}
              >
                <span className="type-pick-label">{opt.label}</span>
                <span className="type-pick-key muted">{opt.schema.innerType}</span>
              </button>
            ))}
          </div>
          <div className="mat-form-actions" style={{ marginTop: 20 }}>
            <button type="button" className="btn-secondary" onClick={goList}>Cancel</button>
          </div>
        </div>
      )}

      {screen.kind === 'view' && (
        <div className="mat-readonly">
          <header className="mat-form-head">
            <h2>{screen.row.name}</h2>
            <span className="pill">{screen.row.innerType} · view only</span>
          </header>
          <p className="muted">Editing for this innerType isn't implemented yet.</p>
          <pre className="json-view">{JSON.stringify(screen.record, null, 2)}</pre>
          <button type="button" className="btn-secondary" onClick={goList}>Back</button>
        </div>
      )}

      {screen.kind === 'form' && (
        <MaterialForm
          rootPath={rootPath}
          schema={screen.ctx.schema}
          mode={screen.ctx.op}
          base={screen.ctx.base}
          originalKey={screen.ctx.originalKey}
          onPreview={(draft) => void onFormPreview(screen.ctx, draft)}
          onDelete={screen.ctx.op === 'edit' ? () => onDelete(screen.ctx) : undefined}
          onCancel={goList}
        />
      )}

      {screen.kind === 'tierSetForm' && (
        <TierSetForm
          rootPath={rootPath}
          schema={screen.schema}
          templates={screen.templates}
          editRecords={screen.editRecords}
          editFile={screen.editFile}
          editKeys={screen.editKeys}
          onPreview={(changes) => void onBatchPreview(changes)}
          onDelete={
            screen.editFile && screen.editKeys
              ? () => onDeleteTierSet(screen.editFile!, screen.editKeys!)
              : undefined
          }
          onCancel={goList}
        />
      )}

      {preview && (
        <div className="modal-backdrop">
          <div className="modal">
            <CommitPreview
              preview={preview.data}
              applying={applying}
              error={error}
              onApply={onApply}
              onBack={() => { setPreview(null); setError(null) }}
              onDiscard={goList}
            />
          </div>
        </div>
      )}
    </div>
  )
}
