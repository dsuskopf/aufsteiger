import type { ReactElement } from 'react'
import { Layer, Line, Rect, Stage, Text } from 'react-konva'
import { COURT } from '@renderer/core/geometry/court'
import { applyViewSide, sideToPx, type SideViewport } from '@renderer/core/geometry/transform'
import { COLORS } from '@renderer/theme/colors'
import { useElementSize } from '@renderer/components/useElementSize'
import { useZoomPan } from '@renderer/components/useZoomPan'
import { ViewControls } from '@renderer/components/ViewControls'
import { useUi } from '@renderer/store/settingsStore'

const S_MIN = -1
const S_MAX = COURT.length + 1
/** Maximal darstellbare Höhe in Metern */
const Z_MAX = 25
const PAD_L = 44
const PAD_R = 16
const PAD_T = 40
const PAD_B = 28

/**
 * Seitenansicht (Phase 1: entlang der Feldlänge).
 * Horizontal = Distanz entlang der Linie, vertikal = Höhe (bis 25 m). Netz + Netzhöhe als Referenz.
 * Zoombar, verschiebbar und horizontal drehbar (Blick von der anderen Seite).
 * Ab Phase 3 zeigt sie die vertikale Ebene der ausgewählten Flugbahn.
 */
export function SideView() {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const netHeight = useUi((s) => s.netHeight)
  const mirrored = useUi((s) => s.sideMirrored)
  const toggleMirror = useUi((s) => s.toggleSideMirror)

  // Basis: die ganze Länge füllt die Breite. Wäre dann mehr als 25 m Höhe sichtbar,
  // bestimmt stattdessen die Höhe den Maßstab (die Länge ist dann seitlich verschiebbar).
  const widthFit = (size.width - PAD_L - PAD_R) / (S_MAX - S_MIN)
  const heightFit = (size.height - PAD_T - PAD_B) / Z_MAX
  const scale = Math.max(0.0001, widthFit, heightFit)
  const netS = COURT.halfLength
  const base: SideViewport = {
    scale,
    originX: PAD_L - S_MIN * scale,
    groundY: size.height - PAD_B,
    mirror: mirrored,
    mirrorCenter: (S_MIN + S_MAX) / 2
  }
  // Inhalt: ganze Länge, Höhe bis 25 m (darüber hinaus kann man nicht verschieben)
  const content = {
    x0: 0,
    y0: base.groundY - Z_MAX * scale - PAD_T,
    x1: PAD_L + (S_MAX - S_MIN) * scale + PAD_R,
    y1: size.height
  }
  const netPx = sideToPx(base, netS, 0).px
  const { view, zoomIn, zoomOut, reset } = useZoomPan(ref, {
    size,
    content,
    // Start: Netz mittig
    initial: { z: 1, tx: size.width / 2 - netPx, ty: 0 },
    // Button-Zoom am Boden unter der Mitte, damit der Boden im Bild bleibt
    zoomAnchor: { x: size.width / 2, y: size.height - PAD_B }
  })
  const vp = applyViewSide(base, view)
  const P = (s: number, z: number) => {
    const p = sideToPx(vp, s, z)
    return [p.px, p.py]
  }

  const zStep = vp.scale >= 90 ? 0.5 : vp.scale >= 22 ? 1 : 2
  const sStep = vp.scale >= 45 ? 1 : 3
  const labelY = Math.min(vp.groundY + 8, size.height - 18)

  const grid: ReactElement[] = []
  const labels: ReactElement[] = []
  for (let z = zStep; z <= Z_MAX + 1e-9; z += zStep) {
    const y = P(0, z)[1]
    grid.push(<Line key={`z${z}`} points={[...P(S_MIN, z), ...P(S_MAX, z)]} stroke={COLORS.border} strokeWidth={1} />)
    // Keine Beschriftung unter dem Ansichtstitel
    if (y > 34)
      labels.push(
      <Text key={`zt${z}`} x={4} y={y - 7} text={`${fmt(z)} m`} fontSize={11} fill={COLORS.textDim} />
    )
  }
  for (let s = 0; s <= COURT.length + 1e-9; s += sStep) {
    const x = P(s, 0)[0]
    grid.push(<Text key={`st${s}`} x={x - 10} y={labelY} width={20} align="center" text={`${s}`} fontSize={11} fill={COLORS.textDim} />)
  }

  const [nx, ny] = P(netS, netHeight)
  const labelLeft = mirrored ? nx - 98 : nx + 8

  return (
    <>
      <div className="canvas-host" ref={ref}>
        {size.width > 0 && (
          <Stage width={size.width} height={size.height}>
            <Layer listening={false}>
              {grid}
              {/* Boden */}
              <Line points={[...P(S_MIN, 0), ...P(S_MAX, 0)]} stroke={COLORS.line} strokeWidth={2} />
              {/* Feldgrenzen + Angriffslinien als Bodenmarken */}
              {[0, netS - COURT.attackLineDist, netS + COURT.attackLineDist, COURT.length].map((s) => (
                <Rect key={s} x={P(s, 0)[0] - 1} y={vp.groundY - 4} width={2} height={8} fill={COLORS.lineDim} />
              ))}
              {/* Netz: Pfosten bis Netzoberkante, Netzband 1 m */}
              <Line points={[...P(netS, 0), ...P(netS, netHeight)]} stroke={COLORS.lineDim} strokeWidth={2} />
              <Line
                points={[...P(netS, netHeight - COURT.netBandDepth), ...P(netS, netHeight)]}
                stroke={COLORS.net}
                strokeWidth={4}
              />
              {/* Antenne: 80 cm rot-weiß über der Netzkante */}
              {Array.from({ length: 8 }, (_, i) => (
                <Line
                  key={`a${i}`}
                  points={[...P(netS, netHeight + i * 0.1), ...P(netS, netHeight + (i + 1) * 0.1)]}
                  stroke={i % 2 === 1 ? '#c62828' : '#e6e6ea'}
                  strokeWidth={Math.max(2, 0.01 * vp.scale)}
                />
              ))}
              {/* Netzhöhe als Referenzlinie */}
              <Line
                points={[...P(S_MIN, netHeight), ...P(S_MAX, netHeight)]}
                stroke={COLORS.violetLight}
                strokeWidth={1}
                dash={[6, 6]}
                opacity={0.6}
              />
              <Text
                x={labelLeft}
                y={ny - 18}
                width={90}
                align={mirrored ? 'right' : 'left'}
                text={`Netz ${fmt(netHeight, 2)} m`}
                fontSize={12}
                fill={COLORS.violetLight}
              />
              {/* Höhenskala bleibt am linken Rand stehen */}
              <Rect x={0} y={0} width={PAD_L - 4} height={size.height} fill={COLORS.bg} opacity={0.9} />
              {labels}
            </Layer>
          </Stage>
        )}
      </div>
      <ViewControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset}>
        <button
          className={mirrored ? 'active' : ''}
          title="Von der anderen Seite ansehen (horizontal drehen)"
          aria-label="Seitenansicht horizontal drehen"
          onClick={toggleMirror}
        >
          ⇄
        </button>
      </ViewControls>
    </>
  )
}

function fmt(v: number, digits = 1): string {
  const s = digits === 2 ? v.toFixed(2) : Number.isInteger(v) ? String(v) : v.toFixed(1)
  return s.replace('.', ',')
}
