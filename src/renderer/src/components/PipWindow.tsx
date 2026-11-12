import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import type { PxRect } from '@renderer/core/geometry/transform'
import { useUi } from '@renderer/store/settingsStore'

const MIN_W = 260
const MIN_H = 170
const EDGE = 12

/** Standardlage: unten rechts, etwa ein Drittel breit (hochkant knapp die Hälfte), Seitenverhältnis 16:10 */
export function defaultPipRect(viewsW: number, viewsH: number): PxRect {
  const share = viewsH > viewsW ? 0.46 : 0.34
  const w = Math.min(520, Math.max(280, viewsW * share))
  const h = w * 0.625
  return { x0: viewsW - w - 18, y0: viewsH - h - 18, x1: viewsW - 18, y1: viewsH - 18 }
}

/** Hält das Fenster im Ansichtsbereich und über der Mindestgröße */
export function clampPipRect(r: PxRect, viewsW: number, viewsH: number): PxRect {
  let w = Math.min(Math.max(MIN_W, r.x1 - r.x0), Math.max(MIN_W, viewsW - 2 * EDGE))
  let h = Math.min(Math.max(MIN_H, r.y1 - r.y0), Math.max(MIN_H, viewsH - 2 * EDGE))
  w = Math.min(w, viewsW)
  h = Math.min(h, viewsH)
  const x0 = Math.min(Math.max(0, r.x0), Math.max(0, viewsW - w))
  const y0 = Math.min(Math.max(0, r.y0), Math.max(0, viewsH - h))
  return { x0, y0, x1: x0 + w, y1: y0 + h }
}

/** Verschieben oder Größe ändern an einer Kante/Ecke (n = oben, s = unten, w = links, e = rechts) */
type Edge = 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se'
type Mode = 'move' | Edge
const EDGES: Edge[] = ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se']

/**
 * Freies Bild-im-Bild-Fenster über den Ansichten: an der Titelleiste verschiebbar,
 * an allen vier Kanten und Ecken in der Größe änderbar. Lage und Größe merkt sich der Store
 * erst beim Loslassen, damit die Draufsicht nicht während des Ziehens neu ausrichtet.
 */
export function PipWindow({ title, children }: { title: string; children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null)
  const stored = useUi((s) => s.netPipRect)
  const setStored = useUi((s) => s.setNetPipRect)
  const [views, setViews] = useState({ w: 0, h: 0 })
  const [live, setLive] = useState<PxRect | null>(null)

  // Größe des Ansichtsbereichs beobachten (Elternelement)
  useEffect(() => {
    const parent = rootRef.current?.parentElement
    if (!parent) return
    const update = () => setViews({ w: parent.clientWidth, h: parent.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  const rect =
    views.w > 0 ? clampPipRect(live ?? stored ?? defaultPipRect(views.w, views.h), views.w, views.h) : null

  const start = (mode: Mode) => (e: ReactPointerEvent<HTMLElement>) => {
    if (!rect || e.button > 0) return
    e.preventDefault()
    e.stopPropagation()
    const pointerId = e.pointerId
    const sx = e.clientX
    const sy = e.clientY
    const r0 = rect
    let last = r0
    // Bewegung am ganzen Fenster verfolgen, damit schnelles Ziehen den Griff nicht „verliert“
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
      let next: PxRect
      if (mode === 'move') next = { x0: r0.x0 + dx, y0: r0.y0 + dy, x1: r0.x1 + dx, y1: r0.y1 + dy }
      else {
        next = { ...r0 }
        if (mode.includes('w')) next.x0 = Math.min(r0.x0 + dx, r0.x1 - MIN_W)
        if (mode.includes('e')) next.x1 = Math.max(r0.x1 + dx, r0.x0 + MIN_W)
        if (mode.includes('n')) next.y0 = Math.min(r0.y0 + dy, r0.y1 - MIN_H)
        if (mode.includes('s')) next.y1 = Math.max(r0.y1 + dy, r0.y0 + MIN_H)
      }
      last = clampPipRect(next, views.w, views.h)
      setLive(last)
    }
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      setStored(last)
      setLive(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  return (
    <section
      ref={rootRef}
      className={`pane pip ${live ? 'dragging' : ''}`}
      aria-label={title}
      style={
        rect
          ? { left: rect.x0, top: rect.y0, width: rect.x1 - rect.x0, height: rect.y1 - rect.y0 }
          : { visibility: 'hidden' }
      }
    >
      <div
        className="pip-handle"
        onPointerDown={start('move')}
        title="Ziehen zum Verschieben"
        role="button"
        aria-label={`${title} verschieben`}
      >
        <span className="grip" aria-hidden="true" />
        {title}
      </div>
      {children}
      {EDGES.map((edge) => (
        <span key={edge} className={`pip-resize ${edge}`} onPointerDown={start(edge)} title="Größe ändern" aria-hidden="true" />
      ))}
    </section>
  )
}
