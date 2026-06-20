import { useState } from 'react'
import type {
  MaterialChange,
  MaterialRecord,
  MaterialSummary,
  CommitPreview as Preview
} from '@shared/types'
import {
  applyFormValues,
  defaultImageName,
  getMaterialSchema,
  type MaterialTypeSchema
} from '@shared/materialsSchema'
import { useMaterials } from './useMaterials'
import MaterialsList from './MaterialsList'
import MaterialForm, { type FormDraft } from './MaterialForm'
import CommitPreview from './CommitPreview'
import { extOf, sanitizeImageBasename, toImagePlan } from './util'

/** Default file for creating a record of a given innerType (only local_speciality creatable now). */
const CREATE_FILE: Record<string, string> = {
  local_speciality: 'Materials-Local_Specialities.json'
}

interface FormContext {
  op: 'create' | 'edit'
  schema: MaterialTypeSchema
  base: MaterialRecord
  file: string
  originalKey?: string
}

type Screen =
  | { kind: 'list' }
  | { kind: 'form'; ctx: FormContext }
  | { kind: 'view'; row: MaterialSummary; record: MaterialRecord }

export default function MaterialsView({ rootPath }: { rootPath: string }) {
  const { list, loading, reload } = useMaterials(rootPath)
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  const [preview, setPreview] = useState<{ data: Preview; change: MaterialChange } | null>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goList = () => {
    setScreen({ kind: 'list' })
    setPreview(null)
    setError(null)
  }

  const onNew = async () => {
    const schema = getMaterialSchema('local_speciality')!
    const templates = await window.api.materials.templates(rootPath)
    const base = (templates[schema.templateKey] ?? { innerType: schema.innerType }) as MaterialRecord
    setScreen({
      kind: 'form',
      ctx: { op: 'create', schema, base, file: CREATE_FILE[schema.innerType] }
    })
  }

  const onOpen = async (row: MaterialSummary) => {
    const record = await window.api.materials.get(rootPath, row.file, row.key)
    if (!record) return
    const schema = getMaterialSchema(row.innerType)
    if (!schema) {
      setScreen({ kind: 'view', row, record })
      return
    }
    setScreen({
      kind: 'form',
      ctx: { op: 'edit', schema, base: record, file: row.file, originalKey: row.key }
    })
  }

  /** Build a MaterialChange from the form draft and open the preview modal. */
  const onFormPreview = async (ctx: FormContext, draft: FormDraft) => {
    const { schema } = ctx
    const st = draft.imageState
    const ext = st.mode === 'localFile' ? extOf(st.sourcePath) : st.mode === 'url' ? extOf(st.url) : 'png'
    // Use the user's name override when set; otherwise derive sensible defaults.
    // URL: sanitized filename from the URL. Local file: Item_<key>.<ext> convention.
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
    const destRelative = `${schema.imageFolder}/${destFilename}`
    const imageRelative =
      st.mode === 'existing' ? st.relative : st.mode === 'none' ? '' : destRelative

    const record = applyFormValues(ctx.base, schema, { ...draft.values, image: imageRelative })
    const change: MaterialChange = {
      op: ctx.op === 'edit' ? 'update' : 'create',
      file: ctx.file,
      key: draft.key,
      originalKey: ctx.op === 'edit' ? ctx.originalKey : undefined,
      record,
      ordering: draft.ordering,
      image: toImagePlan(st, destRelative) ?? undefined
    }
    setError(null)
    setPreview({ data: await window.api.materials.previewCommit(rootPath, change), change })
  }

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

  const onApply = async () => {
    if (!preview) return
    setApplying(true)
    const res = await window.api.materials.commit(rootPath, preview.change)
    setApplying(false)
    if (res.ok) {
      await reload()
      goList()
    } else {
      setError(res.error ?? 'Commit failed.')
    }
  }

  return (
    <div className="materials">
      {screen.kind === 'list' && (
        <MaterialsList rootPath={rootPath} list={list} loading={loading} onNew={onNew} onOpen={onOpen} />
      )}

      {screen.kind === 'view' && (
        <div className="mat-readonly">
          <header className="mat-form-head">
            <h2>{screen.row.name}</h2>
            <span className="pill">{screen.row.innerType} · view only</span>
          </header>
          <p className="muted">Editing for this innerType isn’t implemented yet.</p>
          <pre className="json-view">{JSON.stringify(screen.record, null, 2)}</pre>
          <button className="btn-secondary" onClick={goList}>
            Back
          </button>
        </div>
      )}

      {screen.kind === 'form' && (
        <MaterialForm
          rootPath={rootPath}
          schema={screen.ctx.schema}
          mode={screen.ctx.op}
          base={screen.ctx.base}
          originalKey={screen.ctx.originalKey}
          onPreview={(draft) => onFormPreview(screen.ctx, draft)}
          onDelete={screen.ctx.op === 'edit' ? () => onDelete(screen.ctx) : undefined}
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
              onBack={() => {
                setPreview(null)
                setError(null)
              }}
              onDiscard={goList}
            />
          </div>
        </div>
      )}
    </div>
  )
}
