import { Circle, Layer, Line, Stage, Text } from 'react-konva'
import { COURT, courtLines } from '@renderer/core/geometry/court'
import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import { PlayersLayer, hitsDraggable } from './PlayersLayer'
import { TrajectoryLayer } from './TrajectoryLayer'
import { useDrawTrajectory } from './useDrawTrajectory'
import { useDrawPath } from './useDrawPath'
import { PathLayer } from './PathLayer'
import { useEmptyTapClose } from '@renderer/components/useEmptyTapClose'
import { useSettings } from '@renderer/store/appSettings'
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
import { ZoneMarks } from './ZoneMarks'
import { NamesButton, ViewSwapButton, ZonesButton } from '@renderer/components/ViewToggles'
import { useUi } from '@renderer/store/settingsStore'

export const WORLD_W = COURT.length + 2 * COURT.freeZone
export const WORLD_H = COURT.width + 2 * COURT.freeZone

/**
 * Draufsicht: Feld 18 × 9 m, Netz bei x = 0, maßstabstreu.
 * Steht die Fläche hochkant, steht auch das Feld hochkant; der Button dreht zusätzlich in 90-Grad-Schritten.
 */
export function TopView({ compact = false }: { compact?: boolean }) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const topTurns = useUi((s) => s.topTurns)
  const rotateTop = useUi((s) => s.rotateTop)
  const tool = useUi((s) => s.tool)
  const drawing = tool !== 'select'

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
    // Finger auf einem Spieler oder Griff zieht diesen, nicht die Ansicht; zeichnet der Finger, verschiebt er nicht
    shouldIgnore: (e) =>
      (e.pointerType === 'touch' && drawing && useSettings.getState().settings.fingerDraws) ||
      (!drawing && hitsDraggable(stageRef.current, e.clientX, e.clientY))
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
  const preview = useDrawTrajectory(ref, vp, tool === 'annahme' || tool === 'zuspiel' || tool === 'schlag' ? tool : null)
  const stroke = useDrawPath(ref, vp, tool === 'laufweg')
  // Tippen ins Leere schließt Flugbahn- und Spieler-Karte
  useEmptyTapClose(ref, stageRef)
  // Nach einer Größenänderung alle Ebenen neu zeichnen (sonst bleiben einzelne Ebenen leer, bis man etwas bewegt)
  useEffect(() => {
    const id = requestAnimationFrame(() => stageRef.current?.batchDraw())
    return () => cancelAnimationFrame(id)
  }, [size.width, size.height])

  return (
    <>
      <div className={`canvas-host ${drawing ? 'drawing' : ''}`} ref={ref}>
        {size.width > 0 && (
          <Stage ref={stageRef} width={size.width} height={size.height}>
            <CourtLayer vp={vp} />
            <PathLayer vp={vp} interactive={!drawing} stroke={stroke} />
            <PlayersLayer vp={vp} interactive={!drawing} />
            <TrajectoryLayer vp={vp} interactive={!drawing} preview={preview} />
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
      <ViewControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset} lead={<ViewSwapButton />}>
        <NamesButton />
        <button title="Feld um 90° drehen" aria-label="Feld um 90 Grad drehen" onClick={rotateTop}>
          <Icon name="rotate" />
        </button>
        <ZonesButton />
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

export function CourtLayer({ vp }: { vp: TopViewport }) {
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
      <ZoneMarks vp={vp} />
      {/* Abspannseile vom Netz zu den Pfosten: dünn und grau wie die Pfosten */}
      {[-1, 1].map((d) => (
        <Line key={d} points={[...P(0, (d * COURT.netWidth) / 2), ...P(0, d * postY)]} stroke="#6a6a72" strokeWidth={Math.max(1, lw * 0.6)} />
      ))}
      {/* Netz (9,50 m breit, über die Seitenlinien hinaus) */}
      <Line
        points={[...P(0, -COURT.netWidth / 2), ...P(0, COURT.netWidth / 2)]}
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
