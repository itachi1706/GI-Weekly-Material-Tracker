import { useState } from 'react'
import { formatForExtension } from '@shared/validate'
import { normalizeImageUrl } from '../materials/util'
import { useImage } from '../shared/imageCache'

interface Props {
  rootPath: string
  /** Image path relative to images/ (from the finding). */
  imagePath: string
  /** Already replaced in this session (possibly via another finding for the same file). */
  replaced: boolean
  onReplaced: (imagePath: string) => void
}

/** Electron prefixes rejected IPC errors with the channel name; show just the handler's message. */
const ipcMessage = (e: unknown): string =>
  (e as Error).message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')

/** Inline "replace this image from a URL" fix for an `image-format` validation finding. */
export default function ImageReplaceFix({ rootPath, imagePath, replaced, onReplaced }: Readonly<Props>) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState<'preview' | 'replace' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = useImage(rootPath, open ? imagePath : null)

  if (replaced) return <div className="validate-fix-done">✓ Replaced — re-run validation to confirm.</div>
  if (!open) {
    return (
      <button type="button" className="btn-link validate-fix-toggle" onClick={() => setOpen(true)}>
        Replace from URL…
      </button>
    )
  }

  const expected = formatForExtension(imagePath)
  // The preview's data-URL MIME comes from the response Content-Type; main re-checks the real bytes.
  const previewMatches = !!preview && !!expected && preview.startsWith(`data:image/${expected}`)

  const loadPreview = async (): Promise<void> => {
    const u = normalizeImageUrl(url)
    if (!u) return
    setUrl(u)
    setBusy('preview')
    setError(null)
    setPreview(null)
    const data = await window.api.materials.previewImage(rootPath, { source: 'url', url: u, destRelative: '' })
    setBusy(null)
    if (data) setPreview(data)
    else setError('Could not load an image from that URL.')
  }

  const replace = async (): Promise<void> => {
    setBusy('replace')
    setError(null)
    try {
      await window.api.validate.replaceImage(rootPath, imagePath, url)
      onReplaced(imagePath)
    } catch (e) {
      setError(ipcMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="validate-fix">
      <div className="validate-fix-row">
        <input
          type="text"
          placeholder="Paste the original image URL (e.g. static.wikia.nocookie.net/…)"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setPreview(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void loadPreview()
          }}
        />
        <button type="button" className="btn-secondary" disabled={!url.trim() || busy !== null} onClick={() => void loadPreview()}>
          {busy === 'preview' ? 'Loading…' : 'Preview'}
        </button>
        <button type="button" className="btn-link" onClick={() => setOpen(false)}>Cancel</button>
      </div>

      <div className="validate-fix-compare">
        <figure>
          {current ? <img src={current} alt="current" /> : <div className="image-picker-loading" />}
          <figcaption>Current</figcaption>
        </figure>
        {preview && (
          <figure>
            <img src={preview} alt="replacement" />
            <figcaption>{previewMatches ? `New (${expected?.toUpperCase()})` : 'New — wrong format'}</figcaption>
          </figure>
        )}
      </div>

      {preview && !previewMatches && (
        <div className="form-errors">
          That URL isn’t serving a {expected?.toUpperCase()} — replacing would keep the file mismatched.
        </div>
      )}
      {error && <div className="form-errors">{error}</div>}

      {preview && previewMatches && (
        <button type="button" className="btn-primary" disabled={busy !== null} onClick={() => void replace()}>
          {busy === 'replace' ? 'Replacing…' : `Replace ${imagePath.split('/').pop()}`}
        </button>
      )}
    </div>
  )
}
