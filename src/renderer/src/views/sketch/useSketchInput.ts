import { useEffect, useRef, useState, type RefObject } from 'react'
import type Konva from 'konva'
import type { SketchStroke } from '@shared/types'
import { topToWorld, type TopViewport } from '@renderer/core/geometry/transform'
import { finishStroke, hitsStroke } from '@renderer/core/sketch/sketch'
import { rewind } from '@renderer/store/actions'
import { useSettings } from '@renderer/store/appSettings'
import { usePlay } from '@renderer/store/playStore'
import { useUi } from '@renderer/store/settingsStore'
import { hitsDraggable } from '../top/PlayersLayer'

/** Radius des Radierers auf dem Bildschirm (px) */
export const ERASER_PX = 14
/** Mindestabstand zwischen zwei aufgenommenen Punkten (px) – der Stift meldet sonst hunderte je Sekunde */
const STEP_PX = 1.5
/** Die Skizze reicht über das Feld hinaus (Notizen am Rand), aber nicht ins Unendliche */
const LIMIT_M = 30

export interface LiveSketch {
  /** Strich, der gerade gezeichnet wird */
  stroke: SketchStroke | null
  /** Radierer, solange er aufgesetzt ist (Weltkoordinaten) */
  eraser: { x: number; y: number } | null
}
const IDLE: LiveSketch = { stroke: null, eraser: null }

/**
 * Zeichnen in der Skizze. Stift und Maus zeichnen; der Finger verschiebt und zoomt (mit „Finger zeichnet“
 * zeichnet er auch). Wer auf einem Spieler aufsetzt, zieht den Spieler. Die Radierer-Taste am Stift
 * (Surface Slim Pen: oben) radiert, ohne das Werkzeug zu wechseln; die seitliche Taste verschiebt die Ansicht.
 * Radiert werden ganze Striche.
 */
export function useSketchInput(hostRef: RefObject<HTMLElement | null>, stageRef: RefObject<Konva.Stage | null>, vp: TopViewport): LiveSketch {
  const vpRef = useRef(vp)
  vpRef.current = vp
  const [live, setLive] = useState<LiveSketch>(IDLE)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const clamp = (v: number) => Math.min(LIMIT_M, Math.max(-LIMIT_M, v))
    const at = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const w = topToWorld(vpRef.current, e.clientX - r.left, e.clientY - r.top)
      return { x: clamp(w.x), y: clamp(w.y) }
    }
    let cur: { id: number; erase: boolean; stroke: SketchStroke } | null = null

    /** Radieren entlang des Wegs von from nach to – auch bei schnellen Bewegungen bleibt kein Strich dazwischen stehen */
    const erase = (to: { x: number; y: number }, from = to) => {
      const radius = ERASER_PX / vpRef.current.scale
      const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (radius * 0.7)))
      const play = usePlay.getState()
      const hit = new Set<number>()
      for (let k = 1; k <= steps; k++) {
        const x = from.x + ((to.x - from.x) * k) / steps
        const y = from.y + ((to.y - from.y) * k) / steps
        play.sketch.forEach((st, i) => {
          if (!hit.has(i) && hitsStroke(st, x, y, radius)) hit.add(i)
        })
      }
      if (hit.size) play.removeStrokes([...hit])
    }

    const onDown = (e: PointerEvent) => {
      if (cur) return
      const pen = e.pointerType === 'pen'
      // Radierer-Ende bzw. Radierer-Taste des Stifts
      const penEraser = pen && (e.button === 5 || (e.buttons & 32) !== 0)
      if (e.button !== 0 && !penEraser) return
      if (e.pointerType === 'touch' && !useSettings.getState().settings.fingerDraws) return
      const ui = useUi.getState()
      const eraseNow = penEraser || ui.sketchTool === 'eraser'
      // Auf einem Spieler aufgesetzt: der Spieler wird gezogen (außer beim Radieren)
      if (!eraseNow && hitsDraggable(stageRef.current, e.clientX, e.clientY)) return
      e.preventDefault()
      e.stopPropagation()
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // auch ohne Capture
      }
      // Gezeichnet wird auf der Grundstellung
      rewind()
      const p = at(e)
      cur = { id: e.pointerId, erase: eraseNow, stroke: { color: ui.sketchColor, width: ui.sketchWidth, points: [p.x, p.y] } }
      if (eraseNow) {
        erase(p)
        setLive({ stroke: null, eraser: p })
      } else setLive({ stroke: cur.stroke, eraser: null })
    }

    const onMove = (e: PointerEvent) => {
      if (!cur || e.pointerId !== cur.id) return
      e.stopPropagation()
      // Alle Zwischenpunkte des Stifts mitnehmen, nicht nur einen je Bild – sonst werden schnelle Bögen eckig
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : []
      const list = events.length ? events : [e]
      if (cur.erase) {
        // Der „Strich“ des Radierers merkt sich nur die letzte Stelle
        const pts = cur.stroke.points
        for (const ev of list) {
          const p = at(ev)
          erase(p, { x: pts[0], y: pts[1] })
          pts[0] = p.x
          pts[1] = p.y
        }
        setLive({ stroke: null, eraser: at(e) })
        return
      }
      const minStep = STEP_PX / vpRef.current.scale
      const pts = cur.stroke.points
      let added = false
      for (const ev of list) {
        const p = at(ev)
        if (Math.hypot(p.x - pts[pts.length - 2], p.y - pts[pts.length - 1]) < minStep) continue
        pts.push(p.x, p.y)
        added = true
      }
      if (added) setLive({ stroke: { ...cur.stroke }, eraser: null })
    }

    const end = (e: PointerEvent, commit: boolean) => {
      if (!cur || e.pointerId !== cur.id) return
      e.stopPropagation()
      const c = cur
      cur = null
      setLive(IDLE)
      if (commit && !c.erase) usePlay.getState().addStroke({ ...c.stroke, points: finishStroke(c.stroke.points) })
    }
    const onUp = (e: PointerEvent) => end(e, true)
    const onCancel = (e: PointerEvent) => end(e, false)

    // Capture: vor Konva (sonst würde der Radierer über einem Spieler den Spieler ziehen) und vor Zoom/Verschieben
    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('pointermove', onMove, true)
    el.addEventListener('pointerup', onUp, true)
    el.addEventListener('pointercancel', onCancel, true)
    return () => {
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('pointermove', onMove, true)
      el.removeEventListener('pointerup', onUp, true)
      el.removeEventListener('pointercancel', onCancel, true)
    }
  }, [hostRef, stageRef])

  return live
}
