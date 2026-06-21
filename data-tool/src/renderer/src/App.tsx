import { useState } from 'react'
import { useDataset } from './state/datasetStore'
import FolderPicker from './components/FolderPicker'
import Sidebar from './components/Sidebar'
import DatasetSummary from './components/DatasetSummary'
import MaterialsView from './views/materials/MaterialsView'
import OutfitsView from './views/outfits/OutfitsView'
import WeaponsView from './views/weapons/WeaponsView'
import type { EntityKey } from '@shared/types'

export default function App() {
  const { info, loading, selectFolder, reload } = useDataset()
  const [active, setActive] = useState<EntityKey | null>(null)

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
      <Sidebar
        info={info}
        active={active}
        onSelectEntity={setActive}
        onShowOverview={() => setActive(null)}
        onChangeFolder={selectFolder}
      />
      <main className="app-main">
        {active === 'materials' ? (
          <MaterialsView rootPath={info.rootPath} />
        ) : active === 'outfits' ? (
          <OutfitsView rootPath={info.rootPath} />
        ) : active === 'weapons' ? (
          <WeaponsView rootPath={info.rootPath} />
        ) : (
          <DatasetSummary info={info} onReload={reload} loading={loading} />
        )}
      </main>
    </div>
  )
}
