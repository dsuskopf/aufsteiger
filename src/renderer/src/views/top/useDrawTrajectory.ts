import { useEffect, useRef, useState, type RefObject } from 'react'
import { topToWorld, type TopViewport } from '@renderer/core/geometry/transform'
import { clampToArea } from '@renderer/core/lineup/lineup'
import { MIN_DIST, newTrajectory } from '@renderer/core/physics/trajectory'
import { trajectoryDefaults, useSettings } from '@renderer/store/appSettings'
import { usePlay } from '@renderer/store/playStore'
import { useUi } from '@renderer/store/settingsStore'
import type { TrajectoryType } from '@shared/types'

type Pt = { x: number; y: number }

/** Bewegungsschwelle Klick ↔ Ziehen (px): Finger zittern mehr als Stift und Maus */
const THRESHOLD = { mouse: 6, pen: 6, touch: 12 } as Record<string, number>

/**
 * Flugbahn in der Draufsicht zeichnen – beide Eingabe-Arten gleichzeitig:
 *  1. Klick = Start, zweiter Klick = Ende (dazwischen Vorschau zum Zeiger)
 *  2. Ziehen von Start nach Ende in einem Zug
 * Stift und Maus zeichnen immer; der Finger nur, wenn es in den Einstellungen erlaubt ist
 * (sonst verschiebt er die Ansicht – so verschiebt man nichts aus Versehen).
 * Beim Zuspiel mit vorhandener Annahme steht der Start fest (Schlagpunkt der Annahme): ein Klick setzt das Ziel.
 */
export function useDrawTrajectory(hostRef: RefObject<HTMLElement | null>, vp: TopViewport, active: TrajectoryType | null) {
  const vpRef = useRef(vp)
  vpRef.current = vp
  const [preview, setPreview] = useState<{ a: Pt; b: Pt } | null>(null)
  const pendingRef = useRef<Pt | null>(null)

  // Werkzeugwechsel bricht einen angefangenen Klick ab
  useEffect(() => {
    pendingRef.current = null
    setPreview(null)
  }, [active])

  useEffect(() => {
    const el = hostRef.current
    if (!el || !active) return
    const toWorld = (e: PointerEvent): Pt => {
      const r = el.getBoundingClientRect()
      const w = topToWorld(vpRef.current, e.clientX - r.left, e.clientY - r.top)
      return clampToArea(w.x, w.y)
    }
    const fixedStart = (): Pt | null => {
      const a = usePlay.getState().trajectories.annahme
      return active === 'zuspiel' && a ? { ...a.end } : null
    }
    const finish = (a: Pt, b: Pt) => {
      pendingRef.current = null
      setPreview(null)
      if (Math.hypot(b.x - a.x, b.y - a.y) < MIN_DIST) return
      const t = newTrajectory(a, b, trajectoryDefaults(active))
      const play = usePlay.getState()
      play.setTrajectory(active, t)
      play.select(active)
      // Danach direkt anpassen können: zurück zum Auswählen
      useUi.getState().setTool('select')
    }

    let down: { id: number; sx: number; sy: number; at: Pt; dragging: boolean } | null = null

    const canDraw = (e: PointerEvent) =>
      e.button === 0 && (e.pointerType !== 'touch' || useSettings.getState().settings.fingerDraws)

    const onDown = (e: PointerEvent) => {
      if (down || !canDraw(e)) return
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      down = { id: e.pointerId, sx: e.clientX, sy: e.clientY, at: toWorld(e), dragging: false }
    }
    const onMove = (e: PointerEvent) => {
      if (down && e.pointerId === down.id) {
        if (!down.dragging && Math.hypot(e.clientX - down.sx, e.clientY - down.sy) > (THRESHOLD[e.pointerType] ?? 6))
          down.dragging = true
        if (down.dragging) setPreview({ a: pendingRef.current ?? fixedStart() ?? down.at, b: toWorld(e) })
        return
      }
      // Nach dem ersten Klick folgt die Vorschau dem Zeiger (Maus, schwebender Stift)
      const a = pendingRef.current ?? null
      if (a) setPreview({ a, b: toWorld(e) })
    }
    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return
      const d = down
      down = null
      const at = toWorld(e)
      const start = pendingRef.current ?? fixedStart()
      if (d.dragging) finish(start ?? d.at, at)
      else if (start) finish(start, at)
      else {
        pendingRef.current = d.at
        setPreview({ a: d.at, b: d.at })
      }
    }
    const onCancel = (e: PointerEvent) => {
      if (down && e.pointerId === down.id) down = null
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      down = null
      pendingRef.current = null
      setPreview(null)
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey)
    }
  }, [hostRef, active])

  return preview
}
