import { useState } from 'react'
import { useDataset } from './state/datasetStore'
import FolderPicker from './components/FolderPicker'
import Sidebar from './components/Sidebar'
import DatasetSummary from './components/DatasetSummary'
import MaterialsView from './views/materials/MaterialsView'
import OutfitsView from './views/outfits/OutfitsView'
import WeaponsView from './views/weapons/WeaponsView'
import CharactersView from './views/characters/CharactersView'
import BannersView from './views/banners/BannersView'
import ValidationView from './views/validate/ValidationView'
import type { EntityKey, BannerType } from '@shared/types'

/** Sidebar targets: an entity, the validation view, or the overview (null). */
type ActiveView = EntityKey | 'validate' | null

export default function App() {
  const { info, loading, selectFolder, reload } = useDataset()
  const [active, setActive] = useState<ActiveView>(null)
  const [bannerType, setBannerType] = useState<BannerType>('character')

  const selectBannerType = (t: BannerType) => { setBannerType(t); setActive('banners') }

  // Initial restore in progress.
  if (loading && !info) {
    return (
      <div className="app-center">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  // No folder yet, or the selected folder isn't a valid dataset.
  if (!info?.valid) {
    return <FolderPicker info={info} loading={loading} onSelect={selectFolder} />
  }

  const renderActive = () => {
    if (active === 'materials') return <MaterialsView rootPath={info.rootPath} />
    if (active === 'outfits') return <OutfitsView rootPath={info.rootPath} />
    if (active === 'weapons') return <WeaponsView rootPath={info.rootPath} />
    if (active === 'characters') return <CharactersView rootPath={info.rootPath} />
    if (active === 'banners') return <BannersView rootPath={info.rootPath} bannerType={bannerType} />
    if (active === 'validate') return <ValidationView rootPath={info.rootPath} />
    return <DatasetSummary info={info} onReload={reload} loading={loading} />
  }

  return (
    <div className="app-layout">
      <Sidebar
        info={info}
        active={active}
        bannerType={bannerType}
        onSelectEntity={setActive}
        onSelectBannerType={selectBannerType}
        onShowOverview={() => setActive(null)}
        onShowValidate={() => setActive('validate')}
        onChangeFolder={selectFolder}
      />
      <main className="app-main">{renderActive()}</main>
    </div>
  )
}
