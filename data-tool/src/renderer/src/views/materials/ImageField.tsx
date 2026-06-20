import { useEffect, useState } from 'react'
import type { ImagePlan } from '@shared/types'
import type { ImageState } from './util'

interface Props {
  rootPath: string
  imageFolder: string
  state: ImageState
  onChange: (state: ImageState) => void
}

/** Build the ImagePlan needed only to fetch a preview thumbnail (dest path irrelevant for preview). */
function previewPlan(state: ImageState): ImagePlan | null {
  switch (state.mode) {
    case 'existing':
      return { source: 'existing', relativePath: state.relative }
    case 'localFile':
      return { source: 'localFile', sourcePath: state.sourcePath, destRelative: '' }
    case 'url':
      return { source: 'url', url: state.url, destRelative: '' }
    default:
      return null
  }
}

export default function ImageField({ rootPath, imageFolder, state, onChange }: Props) {
  const [existing, setExisting] = useState<string[]>([])
  const [thumb, setThumb] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState(state.mode === 'url' ? state.url : '')

  // Load the existing images in this folder once.
  useEffect(() => {
    void window.api.materials.listImages(rootPath, imageFolder).then(setExisting)
  }, [rootPath, imageFolder])

  // Refresh the thumbnail whenever the source changes.
  useEffect(() => {
    const plan = previewPlan(state)
    if (!plan) {
      setThumb(null)
      return
    }
    let cancelled = false
    void window.api.materials.previewImage(rootPath, plan).then((d) => {
      if (!cancelled) setThumb(d)
    })
    return () => {
      cancelled = true
    }
  }, [rootPath, state])

  const importFile = async () => {
    const path = await window.api.materials.selectImageFile()
    if (path) onChange({ mode: 'localFile', sourcePath: path })
  }

  const label =
    state.mode === 'existing'
      ? `images/${state.relative}`
      : state.mode === 'localFile'
        ? state.sourcePath
        : state.mode === 'url'
          ? state.url
          : 'No image selected'

  return (
    <div className="image-field">
      <div className="image-field-preview">
        {thumb ? <img src={thumb} alt="preview" /> : <div className="image-field-empty">no preview</div>}
      </div>

      <div className="image-field-controls">
        <div className="image-source-label" title={label}>
          {label}
        </div>

        <div className="image-field-row">
          <select
            value={state.mode === 'existing' ? state.relative : ''}
            onChange={(e) =>
              e.target.value
                ? onChange({ mode: 'existing', relative: `${imageFolder}/${e.target.value}` })
                : onChange({ mode: 'none' })
            }
          >
            <option value="">— pick existing —</option>
            {existing.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <button type="button" className="btn-secondary" onClick={importFile}>
            Import file…
          </button>
        </div>

        <div className="image-field-row">
          <input
            type="text"
            placeholder="…or paste an image URL"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={!urlInput.trim()}
            onClick={() => onChange({ mode: 'url', url: urlInput.trim() })}
          >
            Use URL
          </button>
        </div>
      </div>
    </div>
  )
}
