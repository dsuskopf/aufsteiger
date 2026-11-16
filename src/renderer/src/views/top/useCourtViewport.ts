import { useEffect, useRef, useState, type RefObject } from 'react'
import { COURT } from '@renderer/core/geometry/court'
import { applyViewTop, fitViewport, worldToTop, type TopViewport } from '@renderer/core/geometry/transform'
import { tween } from '@renderer/components/tween'
import { useZoomPan } from '@renderer/components/useZoomPan'
import { useUi } from '@renderer/store/settingsStore'

export const WORLD_W = COURT.length + 2 * COURT.freeZone
export const WORLD_H = COURT.width + 2 * COURT.freeZone

interface Options {
  /** Pop-up: feste Ansicht ohne Zoom und Verschieben, schmaler Rand */
  compact?: boolean
  /** true = diese Berührung gehört einem Objekt oder dem Stift, nicht der Ansicht */
  shouldIgnore: (e: PointerEvent) => boolean
}

/**
 * Blick von oben auf das Feld (18 × 9 m, Netz bei x = 0, maßstabstreu) – für Draufsicht und Skizze.
 * Steht die Fläche hochkant, steht auch das Feld hochkant; der Drehen-Button dreht zusätzlich in 90-Grad-Schritten.
 */
export function useCourtViewport(hostRef: RefObject<HTMLElement | null>, size: { width: number; height: number }, { compact = false, shouldIgnore }: Options) {
  const topTurns = useUi((s) => s.topTurns)
  // Gerät hochkant → Feld hochkant. Neu berechnet bei jeder Größenänderung.
  const autoTurns = window.innerHeight > window.innerWidth ? 1 : 0
  const targetAngle = ((autoTurns + topTurns) * Math.PI) / 2
  const angle = useAnimatedAngle(targetAngle)
  const base = fitViewport(size.width, size.height, WORLD_W, WORLD_H, compact ? 8 : 16, angle)

  // Inhalt (Feld + Freizone) in Basis-Pixeln, begrenzt das Verschieben
  const corners = [
    worldToTop(base, -WORLD_W / 2, -WORLD_H / 2),
    worldToTop(base, WORLD_W / 2, -WORLD_H / 2),
    worldToTop(base, WORLD_W / 2, WORLD_H / 2),
    worldToTop(base, -WORLD_W / 2, WORLD_H / 2)
  ]
  const content = {
    x0: Math.min(...corners.map((c) => c.px)),
    x1: Math.max(...corners.map((c) => c.px)),
    y0: Math.min(...corners.map((c) => c.py)),
    y1: Math.max(...corners.map((c) => c.py))
  }
  const { view, zoomIn, zoomOut, reset } = useZoomPan(hostRef, { size, content, enabled: !compact, shouldIgnore })
  // Beim Drehen den Zoom weich zurücksetzen
  const firstRef = useRef(true)
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false
      return
    }
    reset()
  }, [targetAngle])
  const vp: TopViewport = applyViewTop(base, view)
  return { vp, zoomIn, zoomOut, reset }
}

/** Dreht weich (Animation) zum Zielwinkel; mehrfaches Tippen setzt am aktuellen Winkel an. */
function useAnimatedAngle(target: number): number {
  const [angle, setAngle] = useState(target)
  const angleRef = useRef(target)
  useEffect(() => {
    const from = angleRef.current
    if (from === target) return
    return tween(450, (k) => {
      const a = from + (target - from) * k
      angleRef.current = a
      setAngle(a)
    })
  }, [target])
  return angle
}
