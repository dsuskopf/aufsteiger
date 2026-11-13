import type { ReactNode } from 'react'
import { useUi } from '@renderer/store/settingsStore'
import { Icon } from './Icon'

/**
 * Kompakte Leiste im Pop-up (Bild-im-Bild): ansichtsspezifische Optionen und „Minimieren“.
 * Das Tauschen der Ansichten sitzt in der Seitenleiste der großen Ansicht (ViewSwapButton).
 */
export function PipBar({ children }: { children?: ReactNode }) {
  const setCollapsed = useUi((s) => s.setNetPipCollapsed)
  return (
    <div className="pip-bar">
      {children}
      <button className="icon-only" title="Pop-up minimieren" aria-label="Pop-up minimieren" onClick={() => setCollapsed(true)}>
        <Icon name="minus" />
      </button>
    </div>
  )
}
