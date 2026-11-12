import { useEffect, useRef, useState, type RefObject } from 'react'
import { topToWorld, type TopViewport } from '@renderer/core/geometry/transform'
import { clampToArea } from '@renderer/core/lineup/lineup'
import { RUN_SPEED, strokeToPath } from '@renderer/core/motion/motion'
import { useSettings } from '@renderer/store/appSettings'
import { usePlay } from '@renderer/store/playStore'
import { usePlayback } from '@renderer/store/playbackStore'
import { useUi } from '@renderer/store/settingsStore'
import type { CourtSide, Vec2 } from '@shared/types'

/** Greifradius um einen Spieler (px), mindestens 0,6 m */
const PICK_PX = 28

/**
 * Laufweg zeichnen: auf einem Spieler aufsetzen und den Weg ziehen (Freihand, auch Kurven).
 * Der Strich wird vereinfacht und als glatte Kurve gespeichert; ein vorhandener Laufweg wird ersetzt.
 * Stift und Maus zeichnen immer, der Finger nur mit „Finger zeichnet“.
 */
export function useDrawPath(hostRef: RefObject<HTMLElement | null>, vp: TopViewport, active: boolean): Vec2[] | null {
  const vpRef = useRef(vp)
  vpRef.current = vp
  const [stroke, setStroke] = useState<Vec2[] | null>(null)

  useEffect(() => {
    const el = hostRef.current
    if (!el || !active) return
    const toWorld = (e: PointerEvent): Vec2 => {
      const r = el.getBoundingClientRect()
      const w = topToWorld(vpRef.current, e.clientX - r.left, e.clientY - r.top)
      return clampToArea(w.x, w.y)
    }
    let cur: { id: number; side: CourtSide; playerId: string; pts: Vec2[] } | null = null

    const onDown = (e: PointerEvent) => {
      if (cur || e.button !== 0) return
      if (e.pointerType === 'touch' && !useSettings.getState().settings.fingerDraws) return
      const w = toWorld(e)
      const radius = Math.max(0.6, PICK_PX / vpRef.current.scale)
      const { sides } = usePlay.getState()
      let best: { side: CourtSide; playerId: string; x: number; y: number } | null = null
      let bestD = radius
      for (const side of ['A', 'B'] as const)
        for (const c of sides[side].players) {
          const d = Math.hypot(c.x - w.x, c.y - w.y)
          if (d < bestD) {
            bestD = d
            best = { side, playerId: c.playerId, x: c.x, y: c.y }
          }
        }
      if (!best) return
      e.preventDefault()
      e.stopPropagation()
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // auch ohne Capture
      }
      // Laufwege gelten ab der Grundstellung: Animation an den Anfang
      usePlayback.getState().pause()
      usePlayback.setState({ t: 0 })
      cur = { id: e.pointerId, side: best.side, playerId: best.playerId, pts: [{ x: best.x, y: best.y }] }
      setStroke(cur.pts)
    }
    const onMove = (e: PointerEvent) => {
      if (!cur || e.pointerId !== cur.id) return
      const p = toWorld(e)
      const last = cur.pts[cur.pts.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) < 0.08) return
      cur.pts = [...cur.pts, p]
      setStroke(cur.pts)
    }
    const onUp = (e: PointerEvent) => {
      if (!cur || e.pointerId !== cur.id) return
      const c = cur
      cur = null
      setStroke(null)
      const points = strokeToPath(c.pts)
      const play = usePlay.getState()
      if (points) play.setPath(c.side, c.playerId, { points, delay: 0, speed: RUN_SPEED.default })
      play.selectPlayer({ side: c.side, playerId: c.playerId })
      useUi.getState().setTool('select')
    }
    const onCancel = (e: PointerEvent) => {
      if (cur && e.pointerId === cur.id) {
        cur = null
        setStroke(null)
      }
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
    }
  }, [hostRef, active])

  return stroke
}
