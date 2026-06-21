import { useEffect, useState } from 'react'
import type { ImagePlan } from '@shared/types'
import type { ImageState } from './util'
import { extOf, sanitizeImageBasename } from './util'

interface Props {
  rootPath: string
  imageFolder: string
  /** Default save-as basename (no extension) when the user hasn't typed an override — e.g. "Item_Amakumo_Fruit". */
  defaultBasename?: string
  state: ImageState
  onChange: (state: ImageState) => void
  /**
   * When set, the Browse popup lists images from these folders recursively, returning paths
   * relative to the images/ root (e.g. "Characters/Pyro/Amber.png"). Use for multi-folder
   * browsing (e.g. outfit thumbnails span Characters/ and Outfits/Thumbnail/).
   * If omitted, Browse lists `imageFolder` non-recursively (default behavior).
   */
  browseSourceFolders?: string[]
}

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


export default function ImageField({ rootPath, imageFolder, defaultBasename, state, onChange, browseSourceFolders }: Props) {
  const [existing, setExisting] = useState<string[]>([])
  const [thumb, setThumb] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState(state.mode === 'url' ? state.url : '')
  const [showUrl, setShowUrl] = useState(state.mode === 'url')
  const [popupOpen, setPopupOpen] = useState(false)
  const [popupThumbs, setPopupThumbs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (browseSourceFolders) {
      void window.api.materials.listImagesMulti(rootPath, browseSourceFolders).then(setExisting)
    } else {
      void window.api.materials.listImages(rootPath, imageFolder).then(setExisting)
    }
  }, [rootPath, imageFolder, browseSourceFolders?.join(',')])

  useEffect(() => {
    const plan = previewPlan(state)
    if (!plan) { setThumb(null); return }
    let cancelled = false
    void window.api.materials.previewImage(rootPath, plan).then((d) => {
      if (!cancelled) setThumb(d)
    })
    return () => { cancelled = true }
  }, [rootPath, state])

  // When browseSourceFolders is set, `f` is already root-relative; otherwise prepend imageFolder.
  const browseRelative = (f: string) => browseSourceFolders ? f : `${imageFolder}/${f}`

  const openBrowse = () => {
    setPopupOpen(true)
    existing.forEach((f) => {
      if (popupThumbs[f]) return
      void window.api.materials
        .previewImage(rootPath, { source: 'existing', relativePath: browseRelative(f) })
        .then((d) => { if (d) setPopupThumbs((prev) => ({ ...prev, [f]: d })) })
    })
  }

  const selectExisting = (f: string) => {
    onChange({ mode: 'existing', relative: browseRelative(f) })
    setPopupOpen(false)
  }

  const importFile = async () => {
    const path = await window.api.materials.selectImageFile()
    if (!path) return
    // Leave imageName unset — MaterialsView falls back to Item_<key>.<ext>.
    // User can override via the "Save as" field.
    onChange({ mode: 'localFile', sourcePath: path })
  }

  const applyUrl = () => {
    const url = urlInput.trim()
    if (!url) return
    onChange({ mode: 'url', url, imageName: sanitizeImageBasename(url) })
  }

  const currentLabel =
    state.mode === 'existing'
      ? state.relative.split('/').pop() ?? state.relative
      : state.mode === 'localFile'
        ? state.sourcePath.split(/[/\\]/).pop() ?? state.sourcePath
        : state.mode === 'url'
          ? state.url
          : null

  const nameExt =
    state.mode === 'localFile' ? extOf(state.sourcePath) :
    state.mode === 'url' ? extOf(state.url) : 'png'

  const nameValue =
    state.mode === 'localFile' ? (state.imageName ?? '') :
    state.mode === 'url' ? (state.imageName ?? '') : ''

  const onNameChange = (raw: string) => {
    if (state.mode !== 'localFile' && state.mode !== 'url') return
    const clean = raw.replace(/[^a-zA-Z0-9\-_]/g, '_').replace(/_+/g, '_')
    onChange({ ...state, imageName: clean })
  }

  return (
    <div className="image-field">
      {/* Thumbnail */}
      <div className="image-field-preview">
        {thumb
          ? <img src={thumb} alt="preview" />
          : <div className="image-field-empty">no preview</div>
        }
      </div>

      <div className="image-field-controls">
        {/* Current selection label */}
        {currentLabel && (
          <div className="image-source-label" title={currentLabel}>
            {currentLabel}
          </div>
        )}

        {/* Three source buttons inline */}
        <div className="image-source-row">
          <button
            type="button"
            className={`image-source-btn${state.mode === 'existing' ? ' image-source-btn-active' : ''}`}
            onClick={openBrowse}
          >
            Browse existing
          </button>
          <button
            type="button"
            className={`image-source-btn${state.mode === 'localFile' ? ' image-source-btn-active' : ''}`}
            onClick={importFile}
          >
            Import file…
          </button>
          <button
            type="button"
            className={`image-source-btn${state.mode === 'url' || showUrl ? ' image-source-btn-active' : ''}`}
            onClick={() => setShowUrl((v) => !v)}
          >
            From URL
          </button>
        </div>

        {/* URL input — shown when toggled or active */}
        {showUrl && (
          <div className="image-field-section">
            <div className="image-field-section-row">
              <input
                type="text"
                placeholder="Paste image URL…"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyUrl() }}
              />
              <button type="button" className="btn-secondary" disabled={!urlInput.trim()} onClick={applyUrl}>
                Use
              </button>
            </div>
          </div>
        )}

        {/* Save-as name override — for localFile and url */}
        {(state.mode === 'localFile' || state.mode === 'url') && (
          <div className="image-field-section">
            <div className="image-field-section-row">
              <span className="image-field-label">Save as</span>
              <input
                type="text"
                placeholder={defaultBasename ?? 'filename'}
                value={nameValue}
                onChange={(e) => onNameChange(e.target.value)}
              />
              <span className="image-name-ext">.{nameExt}</span>
            </div>
          </div>
        )}
      </div>

      {/* Browse popup */}
      {popupOpen && (
        <div className="image-picker-backdrop" onClick={() => setPopupOpen(false)}>
          <div className="image-picker-popup" onClick={(e) => e.stopPropagation()}>
            <div className="image-picker-header">
              <span>Pick existing image</span>
              <button type="button" className="btn-link" onClick={() => setPopupOpen(false)}>
                ✕ Close
              </button>
            </div>
            {existing.length === 0 ? (
              <p className="muted" style={{ padding: '16px' }}>No images found in {imageFolder}.</p>
            ) : (
              <div className="image-picker-grid">
                {existing.map((f) => {
                  const isSelected = state.mode === 'existing' && state.relative === browseRelative(f)
                  return (
                    <button
                      key={f}
                      type="button"
                      className={`image-picker-item${isSelected ? ' image-picker-selected' : ''}`}
                      onClick={() => selectExisting(f)}
                    >
                      <div className="image-picker-thumb">
                        {popupThumbs[f]
                          ? <img src={popupThumbs[f]} alt="" />
                          : <div className="image-picker-loading" />
                        }
                      </div>
                      <div className="image-picker-name">{f}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
