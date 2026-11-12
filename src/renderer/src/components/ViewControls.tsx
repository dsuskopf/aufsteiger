import type { ReactNode } from 'react'

interface Props {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  /** Zusätzliche Buttons (z. B. Drehen), erscheinen unter den Zoom-Buttons. */
  children?: ReactNode
}

/** Schwebende Ansichts-Buttons oben rechts in einer Ansicht (touch-gerecht, 44 px). */
export function ViewControls({ onZoomIn, onZoomOut, onReset, children }: Props) {
  return (
    <div className="view-buttons">
      <button title="Hineinzoomen" aria-label="Hineinzoomen" onClick={onZoomIn}>
        +
      </button>
      <button title="Herauszoomen" aria-label="Herauszoomen" onClick={onZoomOut}>
        −
      </button>
      <button title="Ansicht zurücksetzen" aria-label="Ansicht zurücksetzen" onClick={onReset}>
        ⟲
      </button>
      {children}
    </div>
  )
}
