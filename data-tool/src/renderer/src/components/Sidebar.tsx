import { ENTITIES } from '@shared/entities'
import type { DatasetInfo, EntityKey, BannerType } from '@shared/types'

const BANNER_SUBSECTIONS: { type: BannerType; label: string }[] = [
  { type: 'character', label: 'Character' },
  { type: 'weapon', label: 'Weapon' },
  { type: 'standard', label: 'Standard' },
  { type: 'chronicled', label: 'Chronicled' }
]

interface Props {
  info: DatasetInfo
  active: EntityKey | 'validate' | null
  bannerType: BannerType
  onSelectEntity: (key: EntityKey) => void
  onSelectBannerType: (t: BannerType) => void
  onShowOverview: () => void
  onShowValidate: () => void
  onChangeFolder: () => void
}

export default function Sidebar({
  info,
  active,
  bannerType,
  onSelectEntity,
  onSelectBannerType,
  onShowOverview,
  onShowValidate,
  onChangeFolder
}: Props) {
  return (
    <aside className="sidebar">
      <button className="sidebar-brand sidebar-brand-btn" onClick={onShowOverview}>
        GI Dataset Tool
      </button>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${active === null ? 'nav-item-active' : ''}`}
          onClick={onShowOverview}
        >
          <span>Overview</span>
        </button>
        {ENTITIES.map((ent) => (
          <div key={ent.key}>
            <button
              className={`nav-item ${active === ent.key ? 'nav-item-active' : ''}`}
              disabled={!ent.enabled}
              title={ent.enabled ? ent.label : 'Coming soon'}
              onClick={() => ent.enabled && onSelectEntity(ent.key)}
            >
              <span>{ent.label}</span>
              {!ent.enabled && <span className="nav-badge">soon</span>}
            </button>
            {/* Banner type subsections */}
            {ent.key === 'banners' && ent.enabled && (
              <div className="nav-subitems">
                {BANNER_SUBSECTIONS.map((sub) => (
                  <button
                    key={sub.type}
                    className={`nav-subitem ${active === 'banners' && bannerType === sub.type ? 'nav-subitem-active' : ''}`}
                    onClick={() => onSelectBannerType(sub.type)}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        <button
          className={`nav-item ${active === 'validate' ? 'nav-item-active' : ''}`}
          title="Validate the dataset (read-only)"
          onClick={onShowValidate}
        >
          <span>Validation</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="folder-label">Dataset</div>
        <div className="folder-path" title={info.rootPath}>
          {info.rootPath}
        </div>
        <button className="btn-link" onClick={onChangeFolder}>
          Change folder
        </button>
      </div>
    </aside>
  )
}
