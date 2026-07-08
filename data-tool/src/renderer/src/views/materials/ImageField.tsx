import { useEffect, useState } from 'react'
import type { ImagePlan } from '@shared/types'
import type { ImageState } from './util'
import { extOf, sanitizeImageBasename, normalizeImageUrl } from './util'
import { loadImage } from '../shared/imageCache'

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
  /** Resting-view shape: 'tile' (default 96×96 square) or 'hero' (full-width wide banner). */
  variant?: 'tile' | 'hero'
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

export default function ImageField({ rootPath, imageFolder, defaultBasename, state, onChange, browseSourceFolders, variant = 'tile' }: Props) {
  const [existing, setExisting] = useState<string[]>([])
  const [thumb, setThumb] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState(state.mode === 'url' ? state.url : '')
  const [open, setOpen] = useState(false)
  const [popupThumbs, setPopupThumbs] = useState<Record<string, string>>({})
  const [browseSearch, setBrowseSearch] = useState('')

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
    // Existing images go through the shared cache (dedup + coalesced batch); localFile/url are
    // one-off and stay direct.
    const p = plan.source === 'existing'
      ? loadImage(rootPath, plan.relativePath)
      : window.api.materials.previewImage(rootPath, plan)
    void p.then((d) => { if (!cancelled) setThumb(d) })
    return () => { cancelled = true }
  }, [rootPath, state])

  // When browseSourceFolders is set, `f` is already root-relative; otherwise prepend imageFolder.
  const browseRelative = (f: string) => browseSourceFolders ? f : `${imageFolder}/${f}`

  const openModal = () => {
    setOpen(true)
    setBrowseSearch('')
    existing.forEach((f) => {
      if (popupThumbs[f]) return
      void loadImage(rootPath, browseRelative(f)).then((d) => {
        if (d) setPopupThumbs((prev) => ({ ...prev, [f]: d }))
      })
    })
  }

  const selectExisting = (f: string) => {
    onChange({ mode: 'existing', relative: browseRelative(f) })
    setOpen(false)
  }

  const importFile = async () => {
    const path = await window.api.materials.selectImageFile()
    if (!path) return
    // Leave imageName unset — the commit layer falls back to the default basename.
    // User can override via the "Save as" field.
    onChange({ mode: 'localFile', sourcePath: path })
  }

  const applyUrl = () => {
    const url = normalizeImageUrl(urlInput)
    if (!url) return
    onChange({ mode: 'url', url, imageName: sanitizeImageBasename(url) })
  }

  const clearSelection = () => {
    onChange({ mode: 'none' })
    setUrlInput('')
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

  const staged = state.mode === 'localFile' || state.mode === 'url'

  return (
    <div className={`image-field${variant === 'hero' ? ' image-field-hero' : ''}`}>
      {/* Resting view: clickable thumbnail + filename caption */}
      <div className="image-field-trigger">
        <button type="button" className="image-field-tile" onClick={openModal} title="Click to change image">
          {thumb
            ? <img src={thumb} alt="preview" />
            : <span className="image-field-tile-add">+ Add image</span>
          }
          {thumb && <span className="image-field-tile-hint">Change</span>}
        </button>
        {currentLabel && (
          <div className="image-field-tile-caption" title={currentLabel}>{currentLabel}</div>
        )}
      </div>

      {/* Modal: import controls + existing grid */}
      {open && (
        <div className="image-picker-backdrop" onClick={() => setOpen(false)}>
          <div className="image-picker-popup" onClick={(e) => e.stopPropagation()}>
            <div className="image-picker-header">
              <span>Select image</span>
              <button type="button" className="btn-link" onClick={() => setOpen(false)}>✕ Close</button>
            </div>

            {/* Import from file / URL */}
            <div className="image-picker-import">
              <div className="image-picker-import-row">
                <button type="button" className="btn-secondary" onClick={importFile}>Import file…</button>
                <input
                  type="text"
                  placeholder="…or paste an image URL"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyUrl() }}
                />
                <button type="button" className="btn-secondary" disabled={!urlInput.trim()} onClick={applyUrl}>Use</button>
              </div>

              {/* Save-as name override — for a staged localFile/url import */}
              {staged && (
                <div className="image-picker-staged">
                  <div className="image-picker-staged-preview">
                    {thumb ? <img src={thumb} alt="staged" /> : <span className="image-field-tile-add">…</span>}
                  </div>
                  <div className="image-picker-staged-fields">
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
                    <div className="image-picker-staged-actions">
                      <button type="button" className="btn-primary" onClick={() => setOpen(false)}>Done</button>
                      <button type="button" className="btn-link" onClick={clearSelection}>Clear</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Existing grid */}
            <div className="image-picker-divider">Or choose an existing image</div>
            {existing.length === 0 ? (
              <p className="muted" style={{ padding: '0 16px 16px' }}>No images found in {imageFolder}.</p>
            ) : (() => {
              const q = browseSearch.trim().toLowerCase()
              const matches = q ? existing.filter((f) => f.toLowerCase().includes(q)) : existing
              return (
                <>
                  <div className="image-picker-search">
                    <input
                      type="search"
                      placeholder={`Filter ${existing.length} images…`}
                      value={browseSearch}
                      onChange={(e) => setBrowseSearch(e.target.value)}
                    />
                    {q && <span className="muted">{matches.length} match{matches.length === 1 ? '' : 'es'}</span>}
                  </div>
                  {matches.length === 0 ? (
                    <p className="muted" style={{ padding: '0 16px 16px' }}>No images match “{browseSearch}”.</p>
                  ) : (
              <div className="image-picker-grid">
                {matches.map((f) => {
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
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
