import type { ReactNode } from 'react'
import { Icon } from './Icon'

interface Props {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  /** Zusätzliche, ansichtsspezifische Buttons (z. B. Drehen); erscheinen getrennt unter dem Zoom. */
  children?: ReactNode
}

/** Schwebende Ansichts-Steuerung oben rechts: Zoom, Zurücksetzen, ansichtsspezifische Aktionen. */
export function ViewControls({ onZoomIn, onZoomOut, onReset, children }: Props) {
  return (
    <div className="view-buttons" role="toolbar" aria-label="Ansicht steuern" aria-orientation="vertical">
      <button title="Hineinzoomen" aria-label="Hineinzoomen" onClick={onZoomIn}>
        <Icon name="plus" />
      </button>
      <button title="Herauszoomen" aria-label="Herauszoomen" onClick={onZoomOut}>
        <Icon name="minus" />
      </button>
      <hr />
      <button title="Ansicht zurücksetzen" aria-label="Ansicht zurücksetzen" onClick={onReset}>
        <Icon name="reset" />
      </button>
      {children}
    </div>
  )
}
