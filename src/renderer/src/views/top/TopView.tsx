import { Circle, Layer, Line, Rect, Stage, Text } from 'react-konva'
import { COURT, courtLines } from '@renderer/core/geometry/court'
import {
  applyViewTop,
  fitViewport,
  normTurns,
  worldToTop,
  type TopViewport
} from '@renderer/core/geometry/transform'
import { COLORS } from '@renderer/theme/colors'
import { useElementSize } from '@renderer/components/useElementSize'
import { useZoomPan } from '@renderer/components/useZoomPan'
import { ViewControls } from '@renderer/components/ViewControls'
import { useUi } from '@renderer/store/settingsStore'

const WORLD_W = COURT.length + 2 * COURT.freeZone
const WORLD_H = COURT.width + 2 * COURT.freeZone

/**
 * Draufsicht: Feld 18 × 9 m, Netz bei x = 0, maßstabstreu.
 * Steht die Fläche hochkant, steht auch das Feld hochkant; der Button dreht zusätzlich in 90-Grad-Schritten.
 */
export function TopView() {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const topTurns = useUi((s) => s.topTurns)
  const rotateTop = useUi((s) => s.rotateTop)

  // Gerät hochkant → Feld hochkant (Ansichten stehen dann untereinander). Neu berechnet bei jeder Größenänderung.
  const autoTurns = window.innerHeight > window.innerWidth ? 1 : 0
  const rotation = normTurns(autoTurns + topTurns)
  const base = fitViewport(size.width, size.height, WORLD_W, WORLD_H, 16, rotation)

  // Inhalt (Feld + Freizone) in Basis-Pixeln, begrenzt das Verschieben
  const c1 = worldToTop(base, -WORLD_W / 2, -WORLD_H / 2)
  const c2 = worldToTop(base, WORLD_W / 2, WORLD_H / 2)
  const content = {
    x0: Math.min(c1.px, c2.px),
    x1: Math.max(c1.px, c2.px),
    y0: Math.min(c1.py, c2.py),
    y1: Math.max(c1.py, c2.py)
  }
  const { view, zoomIn, zoomOut, reset } = useZoomPan(ref, { size, content, resetKey: rotation })
  const vp = applyViewTop(base, view)

  return (
    <>
      <div className="canvas-host" ref={ref}>
        {size.width > 0 && (
          <Stage width={size.width} height={size.height}>
            <CourtLayer vp={vp} />
          </Stage>
        )}
      </div>
      <ViewControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset}>
        <button title="Feld um 90° drehen" aria-label="Feld um 90 Grad drehen" onClick={rotateTop}>
          ⤾
        </button>
      </ViewControls>
    </>
  )
}

/** Achsenparalleles Welt-Rechteck → Pixel-Rechteck (funktioniert für jede Vierteldrehung). */
function worldRect(vp: TopViewport, x0: number, y0: number, x1: number, y1: number) {
  const a = worldToTop(vp, x0, y0)
  const b = worldToTop(vp, x1, y1)
  return {
    x: Math.min(a.px, b.px),
    y: Math.min(a.py, b.py),
    width: Math.abs(a.px - b.px),
    height: Math.abs(a.py - b.py)
  }
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
      <Rect {...worldRect(vp, -L - F, -W - F, L + F, W + F)} fill={COLORS.freeZone} cornerRadius={4} />
      <Rect {...worldRect(vp, -L, -W, L, W)} fill={COLORS.courtFloor} />
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
