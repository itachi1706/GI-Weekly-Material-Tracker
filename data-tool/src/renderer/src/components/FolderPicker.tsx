import type { DatasetInfo } from '@shared/types'

interface Props {
  info: DatasetInfo | null
  loading: boolean
  onSelect: () => void
}

export default function FolderPicker({ info, loading, onSelect }: Props) {
  const invalid = info && !info.valid

  return (
    <div className="app-center">
      <div className="picker-card">
        <h1 className="picker-title">GI Dataset Tool</h1>
        <p className="muted">Select your dataset folder to begin.</p>

        {invalid && (
          <div className="picker-error">
            <p>
              <strong>That folder isn’t a valid dataset.</strong>
            </p>
            <p className="picker-path">{info!.rootPath}</p>
            <p>Missing required {info!.missing.length === 1 ? 'folder' : 'folders'}:</p>
            <ul>
              {info!.missing.map((m) => (
                <li key={m}>
                  <code>{m}/</code>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button className="btn-primary" onClick={onSelect} disabled={loading}>
          {loading ? 'Working…' : 'Select dataset folder'}
        </button>

        <p className="picker-hint">
          Must contain <code>data/</code>, <code>images/</code> and <code>templates/</code>.
        </p>
      </div>
    </div>
  )
}
