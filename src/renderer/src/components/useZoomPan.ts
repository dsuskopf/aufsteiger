import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  IDENTITY_VIEW,
  clampView,
  lerpView,
  zoomAt,
  type PxRect,
  type View2D
} from '@renderer/core/geometry/transform'
import { ZOOM_DURATION_MS, ZOOM_STEP, tween } from './tween'

interface Options {
  size: { width: number; height: number }
  /** Inhalt in Basis-Pixeln (bei Zoom 1); begrenzt das Verschieben. */
  content: PxRect
  /** Startansicht (wird geklemmt), Standard: Zoom 1, zentriert. */
  initial?: View2D
  /** Ändert sich dieser Schlüssel (z. B. Drehung), springt die Ansicht auf die Startansicht. */
  resetKey?: unknown
  /** Fixpunkt für den Button-Zoom (Bildschirm-Pixel), Standard: Mitte der Fläche. */
  zoomAnchor?: { x: number; y: number }
  /** Bereich, in dem der Inhalt zentriert/begrenzt wird (Standard: ganze Fläche) */
  frame?: PxRect
  /** true = diese Berührung gehört einem Objekt (z. B. Spieler ziehen), nicht der Ansicht. */
  shouldIgnore?: (e: PointerEvent) => boolean
}

/**
 * Zoom & Verschieben für eine 2D-Ansicht.
 * - Finger: ein Finger verschiebt, zwei Finger zoomen (Pinch) und verschieben.
 * - Maus: Rad zoomt am Mauszeiger, rechte oder mittlere Taste verschiebt.
 * - Stift: mit gedrückter Stifttaste verschieben. Die Stiftspitze und die linke Maustaste bleiben frei
 *   für das Zeichnen (ab Phase 3).
 * - Buttons: weicher, animierter Zoom zur Mitte bzw. zurück zur Startansicht.
 */
export function useZoomPan(hostRef: RefObject<HTMLElement | null>, opts: Options) {
  const { size, content, initial = IDENTITY_VIEW, resetKey, zoomAnchor, shouldIgnore, frame } = opts
  const [view, setViewState] = useState<View2D>(IDENTITY_VIEW)
  const viewRef = useRef(view)
  const goalRef = useRef<View2D | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)
  const optsRef = useRef({ size, content, initial, zoomAnchor, shouldIgnore, frame })
  optsRef.current = { size, content, initial, zoomAnchor, shouldIgnore, frame }

  const clamp = useCallback((v: View2D) => {
    const o = optsRef.current
    return clampView(v, o.content, o.size.width, o.size.height, o.frame)
  }, [])

  const setView = useCallback(
    (v: View2D) => {
      const c = clamp(v)
      viewRef.current = c
      setViewState(c)
    },
    [clamp]
  )

  const stopAnimation = useCallback(() => {
    cancelRef.current?.()
    cancelRef.current = null
    goalRef.current = null
  }, [])

  const animateTo = useCallback(
    (target: View2D) => {
      cancelRef.current?.()
      const from = viewRef.current
      const to = clamp(target)
      goalRef.current = to
      cancelRef.current = tween(
        ZOOM_DURATION_MS,
        (k) => setView(lerpView(from, to, k)),
        () => {
          cancelRef.current = null
          goalRef.current = null
        }
      )
    },
    [clamp, setView]
  )

  const zoomBy = useCallback(
    (f: number) => {
      const { size: sz, zoomAnchor: anchor } = optsRef.current
      const a = anchor ?? { x: sz.width / 2, y: sz.height / 2 }
      // Mehrfaches Tippen baut auf dem laufenden Ziel auf, nicht auf dem Zwischenstand
      const base = goalRef.current ?? viewRef.current
      animateTo(zoomAt(base, f, a.x, a.y))
    },
    [animateTo]
  )

  const reset = useCallback(() => animateTo(optsRef.current.initial), [animateTo])

  // Startansicht beim ersten Messen und bei Drehung o. ä.; bei Größenänderung nur neu klemmen
  const needsInitRef = useRef(true)
  useEffect(() => {
    stopAnimation()
    needsInitRef.current = true
  }, [resetKey, stopAnimation])
  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return
    if (needsInitRef.current) {
      needsInitRef.current = false
      setView(optsRef.current.initial)
    } else if (!goalRef.current) {
      setView(viewRef.current)
    }
  }, [resetKey, size.width, size.height, content.x0, content.x1, content.y0, content.y1, frame?.x0, frame?.x1, frame?.y0, frame?.y1, setView])

  // Zeiger- und Rad-Gesten
  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const pointers = new Map<number, { x: number; y: number }>()
    let pinch: { dist: number; mx: number; my: number } | null = null

    const local = (e: PointerEvent | WheelEvent) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const isPanPointer = (e: PointerEvent) =>
      e.pointerType === 'touch' ||
      (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) ||
      (e.pointerType === 'pen' && (e.buttons & 2) !== 0)

    const pinchState = () => {
      const [a, b] = [...pointers.values()]
      return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
    }

    const onDown = (e: PointerEvent) => {
      if (!isPanPointer(e)) return
      if (pointers.size === 0 && optsRef.current.shouldIgnore?.(e)) return
      stopAnimation()
      el.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, local(e))
      pinch = pointers.size === 2 ? pinchState() : null
      e.preventDefault()
    }

    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      const p = local(e)
      pointers.set(e.pointerId, p)
      const v = viewRef.current
      if (pointers.size >= 2 && pinch) {
        const next = pinchState()
        const zoomed = zoomAt(v, next.dist / Math.max(1, pinch.dist), next.mx, next.my)
        setView({ ...zoomed, tx: zoomed.tx + next.mx - pinch.mx, ty: zoomed.ty + next.my - pinch.my })
        pinch = next
      } else if (pointers.size === 1) {
        setView({ ...v, tx: v.tx + p.x - prev.x, ty: v.ty + p.y - prev.y })
      }
    }

    const onUp = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return
      pinch = pointers.size === 2 ? pinchState() : null
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      stopAnimation()
      const p = local(e)
      // Touchpad-Pinch kommt als Rad mit ctrlKey und kleinen Werten
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
      setView(zoomAt(viewRef.current, f, p.x, p.y))
    }

    const onContext = (e: Event) => e.preventDefault()

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('contextmenu', onContext)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('contextmenu', onContext)
    }
  }, [hostRef, setView, stopAnimation])

  useEffect(() => () => cancelRef.current?.(), [])

  return {
    view,
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),
    reset
  }
}
