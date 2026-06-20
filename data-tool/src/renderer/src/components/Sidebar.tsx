import { ENTITIES } from '@shared/entities'
import type { DatasetInfo, EntityKey } from '@shared/types'

interface Props {
  info: DatasetInfo
  active: EntityKey | null
  onSelectEntity: (key: EntityKey) => void
  onShowOverview: () => void
  onChangeFolder: () => void
}

export default function Sidebar({
  info,
  active,
  onSelectEntity,
  onShowOverview,
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
          <button
            key={ent.key}
            className={`nav-item ${active === ent.key ? 'nav-item-active' : ''}`}
            disabled={!ent.enabled}
            title={ent.enabled ? ent.label : 'Coming soon'}
            onClick={() => ent.enabled && onSelectEntity(ent.key)}
          >
            <span>{ent.label}</span>
            {!ent.enabled && <span className="nav-badge">soon</span>}
          </button>
        ))}
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
