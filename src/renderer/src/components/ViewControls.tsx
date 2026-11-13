import type { ReactNode } from 'react'
import { Icon } from './Icon'

interface Props {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  /** Ganz oben, abgetrennt: Ansicht wechseln (nur 2D) */
  lead?: ReactNode
  /** Zusätzliche, ansichtsspezifische Buttons (Drehen/Blickseite, Namen, Zonen); erscheinen getrennt unter dem Zoom. */
  children?: ReactNode
}

/**
 * Schwebende Ansichts-Steuerung oben rechts, in dieser Reihenfolge:
 * Ansicht wechseln | Zurücksetzen, +, − | Namen, Drehen bzw. Blickseite, Zonen.
 */
export function ViewControls({ onZoomIn, onZoomOut, onReset, lead, children }: Props) {
  return (
    <div className="view-buttons" role="toolbar" aria-label="Ansicht steuern" aria-orientation="vertical">
      {lead && (
        <>
          {lead}
          <hr />
        </>
      )}
      <button title="Ansicht zurücksetzen" aria-label="Ansicht zurücksetzen" onClick={onReset}>
        <Icon name="reset" />
      </button>
      <button title="Hineinzoomen" aria-label="Hineinzoomen" onClick={onZoomIn}>
        <Icon name="plus" />
      </button>
      <button title="Herauszoomen" aria-label="Herauszoomen" onClick={onZoomOut}>
        <Icon name="minus" />
      </button>
      {children && <hr />}
      {children}
    </div>
  )
}
