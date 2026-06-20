import { useDataset } from './state/datasetStore'
import FolderPicker from './components/FolderPicker'
import Sidebar from './components/Sidebar'
import DatasetSummary from './components/DatasetSummary'

export default function App() {
  const { info, loading, selectFolder, reload } = useDataset()

  // Initial restore in progress.
  if (loading && !info) {
    return (
      <div className="app-center">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  // No folder yet, or the selected folder isn't a valid dataset.
  if (!info || !info.valid) {
    return <FolderPicker info={info} loading={loading} onSelect={selectFolder} />
  }

  return (
    <div className="app-layout">
      <Sidebar info={info} onChangeFolder={selectFolder} />
      <main className="app-main">
        <DatasetSummary info={info} onReload={reload} loading={loading} />
      </main>
    </div>
  )
}
