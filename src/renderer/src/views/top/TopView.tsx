import { Circle, Layer, Line, Stage, Text } from 'react-konva'
import { COURT, courtLines } from '@renderer/core/geometry/court'
import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import { PlayersLayer, hitsPlayer } from './PlayersLayer'
import {
  applyViewTop,
  fitViewport,
  worldToTop,
  type TopViewport
} from '@renderer/core/geometry/transform'
import { tween } from '@renderer/components/tween'
import { COLORS } from '@renderer/theme/colors'
import { useElementSize } from '@renderer/components/useElementSize'
import { useZoomPan } from '@renderer/components/useZoomPan'
import { ViewControls } from '@renderer/components/ViewControls'
import { Icon } from '@renderer/components/Icon'
import { PipBar } from '@renderer/components/PipBar'
import { useUi } from '@renderer/store/settingsStore'

const WORLD_W = COURT.length + 2 * COURT.freeZone
const WORLD_H = COURT.width + 2 * COURT.freeZone

/**
 * Draufsicht: Feld 18 × 9 m, Netz bei x = 0, maßstabstreu.
 * Steht die Fläche hochkant, steht auch das Feld hochkant; der Button dreht zusätzlich in 90-Grad-Schritten.
 */
export function TopView({ compact = false }: { compact?: boolean }) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const topTurns = useUi((s) => s.topTurns)
  const rotateTop = useUi((s) => s.rotateTop)

  // Gerät hochkant → Feld hochkant (Ansichten stehen dann untereinander). Neu berechnet bei jeder Größenänderung.
  const autoTurns = window.innerHeight > window.innerWidth ? 1 : 0
  const targetAngle = ((autoTurns + topTurns) * Math.PI) / 2
  const angle = useAnimatedAngle(targetAngle)
  // Das Netz-Bild-im-Bild liegt als Overlay darüber und verändert die Draufsicht nicht
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
  const stageRef = useRef<Konva.Stage>(null)
  const { view, zoomIn, zoomOut, reset } = useZoomPan(ref, {
    size,
    content,
    // Im Pop-up feste Ansicht: kein Zoom, kein Verschieben (Spieler bleiben ziehbar)
    enabled: !compact,
    // Finger auf einem Spieler zieht den Spieler, nicht die Ansicht
    shouldIgnore: (e) => hitsPlayer(stageRef.current, e.clientX, e.clientY)
  })
  // Beim Drehen den Zoom weich zurücksetzen
  const firstRef = useRef(true)
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false
      return
    }
    reset()
  }, [targetAngle])
  const vp = applyViewTop(base, view)

  return (
    <>
      <div className="canvas-host" ref={ref}>
        {size.width > 0 && (
          <Stage ref={stageRef} width={size.width} height={size.height}>
            <CourtLayer vp={vp} />
            <PlayersLayer vp={vp} />
          </Stage>
        )}
      </div>
      {compact ? (
        <PipBar>
          <button className="icon-only" title="Feld um 90° drehen" aria-label="Feld um 90 Grad drehen" onClick={rotateTop}>
            <Icon name="rotate" />
          </button>
        </PipBar>
      ) : (
      <ViewControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset}>
        <button title="Feld um 90° drehen" aria-label="Feld um 90 Grad drehen" onClick={rotateTop}>
          <Icon name="rotate" />
        </button>
      </ViewControls>
      )}
    </>
  )
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

/** Welt-Rechteck → geschlossenes Polygon in Pixeln (funktioniert für jeden Drehwinkel). */
function worldRect(vp: TopViewport, x0: number, y0: number, x1: number, y1: number) {
  const pts = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1]
  ].flatMap(([x, y]) => {
    const p = worldToTop(vp, x, y)
    return [p.px, p.py]
  })
  return { points: pts, closed: true }
}

function CourtLayer({ vp }: { vp: TopViewport }) {
  const P = (x: number, y: number) => {
    const p = worldToTop(vp, x, y)
    return [p.px, p.py]
  }
  const xy = (x: number, y: number) => {
    const p = worldToTop(vp, x, y)
    return { x: p.px, y: p.py }
  }
  const lw = Math.max(1, COURT.lineWidth * vp.scale)
  const L = COURT.halfLength
  const W = COURT.halfWidth
  const F = COURT.freeZone
  const postY = W + COURT.postDistFromSideline
  const postR = Math.max(3, 0.12 * vp.scale)

  return (
    <Layer listening={false}>
      <Line {...worldRect(vp, -L - F, -W - F, L + F, W + F)} fill={COLORS.freeZone} />
      <Line {...worldRect(vp, -L, -W, L, W)} fill={COLORS.courtFloor} />
      {courtLines().map((l, i) => (
        <Line
          key={i}
          points={[...P(l.a.x, l.a.y), ...P(l.b.x, l.b.y)]}
          stroke={l.kind === 'attack' ? COLORS.lineDim : COLORS.line}
          strokeWidth={lw}
          lineCap="square"
        />
      ))}
      {/* Netz (über die Mittellinie hinaus bis zu den Pfosten) */}
      <Line
        points={[...P(0, -postY), ...P(0, postY)]}
        stroke={COLORS.net}
        strokeWidth={Math.max(2, lw * 1.6)}
        opacity={0.85}
      />
      <Circle {...xy(0, -postY)} radius={postR} fill={COLORS.net} />
      <Circle {...xy(0, postY)} radius={postR} fill={COLORS.net} />
      {/* Seitenbeschriftung mittig in der Freizone hinter der Grundlinie */}
      <SideLabel {...xy(-L - F / 2, 0)} text="A" />
      <SideLabel {...xy(L + F / 2, 0)} text="B" />
    </Layer>
  )
}

function SideLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <Text
      x={x - 20}
      y={y - 8}
      width={40}
      align="center"
      text={text}
      fontSize={16}
      fontStyle="bold"
      fill={COLORS.textDim}
    />
  )
}
