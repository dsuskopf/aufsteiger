import { useEffect, type RefObject } from 'react'
import type Konva from 'konva'
import { usePlay } from '@renderer/store/playStore'
import { useUi } from '@renderer/store/settingsStore'

/** Bewegung, ab der es kein Tippen mehr ist (px), und höchste Dauer (ms) */
const MOVE_PX = 6
const MAX_MS = 600

/**
 * Tippen/Klicken ins Leere (kein Spieler, Griff oder Flugbahn getroffen) schließt die Karten
 * für Annahme, Zuspiel und Spieler (Laufweg/Sprung). Ziehen (Verschieben, Drehen) schließt nichts.
 * Ohne Konva-Bühne (3D) zählt jeder Tipp als „ins Leere“.
 */
export function useEmptyTapClose(hostRef: RefObject<HTMLElement | null>, stageRef?: RefObject<Konva.Stage | null>) {
  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    let down: { id: number; x: number; y: number; t: number; empty: boolean } | null = null
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || useUi.getState().tool !== 'select') return
      const stage = stageRef?.current
      let empty = true
      if (stage) {
        const r = stage.container().getBoundingClientRect()
        empty = !stage.getIntersection({ x: e.clientX - r.left, y: e.clientY - r.top })
      }
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), empty }
    }
    const onUp = (e: PointerEvent) => {
      const d = down
      down = null
      if (!d || e.pointerId !== d.id || !d.empty) return
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > MOVE_PX || performance.now() - d.t > MAX_MS) return
      const play = usePlay.getState()
      if (play.selected) play.select(null)
      if (play.selectedPlayer) play.selectPlayer(null)
    }
    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('pointerup', onUp, true)
    return () => {
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('pointerup', onUp, true)
    }
  }, [hostRef, stageRef])
}
