/** Weiche Kurve für Kamera- und Ansichtsfahrten (langsam an, langsam aus). */
export function easeInOutCubic(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
}

/**
 * Startet eine zeitbasierte Animation. onUpdate bekommt den geglätteten Fortschritt 0..1.
 * Gibt eine Abbruch-Funktion zurück.
 */
export function tween(durationMs: number, onUpdate: (k: number) => void, onDone?: () => void): () => void {
  let raf = 0
  let cancelled = false
  const t0 = performance.now()
  const step = (now: number) => {
    if (cancelled) return
    const k = Math.min(1, (now - t0) / durationMs)
    onUpdate(easeInOutCubic(k))
    if (k < 1) raf = requestAnimationFrame(step)
    else onDone?.()
  }
  raf = requestAnimationFrame(step)
  return () => {
    cancelled = true
    cancelAnimationFrame(raf)
  }
}

export const ZOOM_STEP = 1.35
export const ZOOM_DURATION_MS = 320
