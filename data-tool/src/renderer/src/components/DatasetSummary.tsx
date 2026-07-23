import type { DatasetInfo } from '@shared/types'

interface Props {
  info: DatasetInfo
  loading: boolean
  onReload: () => void
}

export default function DatasetSummary({ info, loading, onReload }: Readonly<Props>) {
  const totalFiles = info.entities.reduce((s, e) => s + e.files.length, 0)
  const totalRecords = info.entities.reduce((s, e) => s + e.recordCount, 0)

  return (
    <div className="summary">
      <header className="summary-head">
        <div>
          <h2>Dataset loaded</h2>
          <p className="summary-path">{info.rootPath}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onReload} disabled={loading}>
          {loading ? 'Scanning…' : 'Reload'}
        </button>
      </header>

      <table className="summary-table">
        <thead>
          <tr>
            <th>Entity</th>
            <th className="num">Files</th>
            <th className="num">Records</th>
          </tr>
        </thead>
        <tbody>
          {info.entities.map((e) => (
            <tr key={e.key}>
              <td>{e.label}</td>
              <td className="num">{e.files.length}</td>
              <td className="num">{e.recordCount.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="num">{totalFiles}</td>
            <td className="num">{totalRecords.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      <p className="summary-note">
        Editing is coming soon — pick an entity from the sidebar once it’s enabled.
      </p>
    </div>
  )
}
