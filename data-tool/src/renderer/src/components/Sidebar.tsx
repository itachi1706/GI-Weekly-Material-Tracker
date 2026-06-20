import { ENTITIES } from '@shared/entities'
import type { DatasetInfo } from '@shared/types'

interface Props {
  info: DatasetInfo
  onChangeFolder: () => void
}

export default function Sidebar({ info, onChangeFolder }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">GI Dataset Tool</div>

      <nav className="sidebar-nav">
        {ENTITIES.map((ent) => (
          <button
            key={ent.key}
            className="nav-item"
            disabled={!ent.enabled}
            title={ent.enabled ? ent.label : 'Coming soon'}
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
