import type { ReactNode } from 'react'
import { useUi } from '@renderer/store/settingsStore'
import { Icon } from './Icon'

/**
 * Kompakte Leiste im Pop-up (Bild-im-Bild): ansichtsspezifische Optionen,
 * dann „Tauschen“ (Pop-up wird groß) und „Minimieren“.
 */
export function PipBar({ children }: { children?: ReactNode }) {
  const swap = useUi((s) => s.swapMain2D)
  const setCollapsed = useUi((s) => s.setNetPipCollapsed)
  return (
    <div className="pip-bar">
      {children}
      <button className="icon-only" title="Groß anzeigen (mit der großen Ansicht tauschen)" aria-label="Mit der großen Ansicht tauschen" onClick={swap}>
        <Icon name="swap" />
      </button>
      <button className="icon-only" title="Pop-up minimieren" aria-label="Pop-up minimieren" onClick={() => setCollapsed(true)}>
        <Icon name="minus" />
      </button>
    </div>
  )
}
