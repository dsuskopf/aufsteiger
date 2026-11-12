import type { ReactElement } from 'react'
import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva'
import { COURT } from '@renderer/core/geometry/court'
import { applyViewNet, isNearSide, netToPx, type NetViewport } from '@renderer/core/geometry/transform'
import { COLORS } from '@renderer/theme/colors'
import { useElementSize } from '@renderer/components/useElementSize'
import { useZoomPan } from '@renderer/components/useZoomPan'
import { ViewControls } from '@renderer/components/ViewControls'
import { Icon } from '@renderer/components/Icon'
import { useUi } from '@renderer/store/settingsStore'
import { useCourtPlayers, type CourtPlayerView } from '@renderer/store/selectors'

/** Sichtbare Breite: Feld plus Freizone (Pfosten stehen 1 m neben den Seitenlinien) */
const HALF_W = COURT.halfWidth + COURT.freeZone
/** Maximal darstellbare Höhe in Metern */
const Z_MAX = 25
const PAD_X = 16
const PAD_T = 44
const PAD_B = 28
/** Kompakt (Bild-im-Bild): weniger Rand, die Bedienleiste liegt unten über dem Boden */
const PAD_T_COMPACT = 30
const PAD_B_COMPACT = 14

const BODY_HEIGHT = 1.85
const BODY_WIDTH = 0.5

/**
 * Netzansicht: flacher, maßstabstreuer Blick frontal aufs Netz aus dem Feld (Standard: von Seite A).
 * Horizontal = Feldbreite, vertikal = Höhe. So sieht man Flugkurven parallel zum Netz.
 * Zeichenreihenfolge = Tiefe: Spieler der anderen Seite, Netz, Spieler der eigenen Seite.
 * Flugbahnen und Ball kommen in Phase 3/4 hinzu (Ebene „trajectories“).
 */
export function NetView({ compact = false }: { compact?: boolean }) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const netHeight = useUi((s) => s.netHeight)
  const from = useUi((s) => s.netViewFrom)
  const toggleFrom = useUi((s) => s.toggleNetViewFrom)
  const showPlayers = useUi((s) => s.netShowPlayers)
  const setShowPlayers = useUi((s) => s.setNetShowPlayers)
  const setViewMode = useUi((s) => s.setViewMode)
  const setPipCollapsed = useUi((s) => s.setNetPipCollapsed)
  const players = useCourtPlayers()

  // Basis: die Breite füllt die Fläche; mehr als 25 m Höhe sind nie sichtbar
  const padT = compact ? PAD_T_COMPACT : PAD_T
  const padB = compact ? PAD_B_COMPACT : PAD_B
  const widthFit = (size.width - 2 * PAD_X) / (2 * HALF_W)
  const heightFit = (size.height - padT - padB) / Z_MAX
  const scale = Math.max(0.0001, widthFit, heightFit)
  const base: NetViewport = { scale, originX: size.width / 2, groundY: size.height - padB, from }
  const content = {
    x0: base.originX - HALF_W * scale - PAD_X,
    x1: base.originX + HALF_W * scale + PAD_X,
    y0: base.groundY - Z_MAX * scale - padT,
    y1: size.height
  }
  const { view, zoomIn, zoomOut, reset } = useZoomPan(ref, {
    size,
    content,
    // Button-Zoom am Boden unter der Mitte, damit Boden und Netz im Bild bleiben
    zoomAnchor: { x: size.width / 2, y: size.height - padB }
  })
  const vp = applyViewNet(base, view)

  // Nach Tiefe zeichnen (Maler-Algorithmus): vom Betrachter am weitesten entfernt zuerst.
  // Der Betrachter steht hinter der eigenen Grundlinie; „Nähe“ = Abstand zur Grundlinie des Betrachters.
  const towardViewer = (x: number) => (from === 'A' ? -x : x)
  const byDepth = (a: CourtPlayerView, b: CourtPlayerView) => towardViewer(a.x) - towardViewer(b.x)
  const far = players.filter((p) => !isNearSide(vp, p.x)).sort(byDepth)
  const near = players.filter((p) => isNearSide(vp, p.x)).sort(byDepth)

  return (
    <>
      <div className="canvas-host" ref={ref}>
        {size.width > 0 && (
          <Stage width={size.width} height={size.height}>
            <Layer listening={false}>
              <Floor vp={vp} />
              {showPlayers && far.map((p) => <PlayerFigure key={p.key} vp={vp} p={p} dim />)}
              <Net vp={vp} netHeight={netHeight} />
              {showPlayers && near.map((p) => <PlayerFigure key={p.key} vp={vp} p={p} />)}
            </Layer>
            {/* Phase 3/4: Flugbahnen (projiziert auf die Netzebene) und Ball in COLORS.trajectory */}
            <Layer name="trajectories" listening={false} />
          </Stage>
        )}
      </div>
      {compact ? (
        /* Kompakte Leiste im Bild-im-Bild: Spieler, Blickseite, Vergrößern */
        <div className="pip-bar">
          <label className="pip-check">
            <input type="checkbox" checked={showPlayers} onChange={(e) => setShowPlayers(e.target.checked)} />
            Spieler
          </label>
          <button
            className="icon-only"
            title={`Von Seite ${from === 'A' ? 'B' : 'A'} aufs Netz schauen`}
            aria-label={`Blickseite wechseln, aktuell von Seite ${from}`}
            onClick={toggleFrom}
          >
            <Icon name="flip" />
          </button>
          <button
            className="icon-only"
            title="Netzansicht vergrößern"
            aria-label="Netzansicht vergrößern"
            onClick={() => setViewMode('net')}
          >
            <Icon name="expand" />
          </button>
          <button
            className="icon-only"
            title="Netzansicht einklappen"
            aria-label="Netzansicht einklappen"
            onClick={() => setPipCollapsed(true)}
          >
            <Icon name="minus" />
          </button>
        </div>
      ) : (
        <>
      <label className="pane-check">
        <input type="checkbox" checked={showPlayers} onChange={(e) => setShowPlayers(e.target.checked)} />
        Spieler
      </label>
      <ViewControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset}>
        <button
          title={`Von Seite ${from === 'A' ? 'B' : 'A'} aufs Netz schauen`}
          aria-label={`Blickseite wechseln, aktuell von Seite ${from}`}
          onClick={toggleFrom}
        >
          <Icon name="flip" />
        </button>
      </ViewControls>
        </>
      )}
    </>
  )
}

/** Boden: Feldbreite als Linie, Seitenlinien als Markierung, Freizone gedämpft */
function Floor({ vp }: { vp: NetViewport }) {
  const P = (y: number, z: number) => {
    const p = netToPx(vp, y, z)
    return [p.px, p.py]
  }
  const W = COURT.halfWidth
  const lw = Math.max(1.5, COURT.lineWidth * vp.scale)
  return (
    <>
      <Line points={[...P(-HALF_W - 2, 0), ...P(HALF_W + 2, 0)]} stroke={COLORS.lineDim} strokeWidth={1.5} />
      <Line points={[...P(-W, 0), ...P(W, 0)]} stroke={COLORS.line} strokeWidth={lw * 1.6} lineCap="butt" />
      {[-W, W].map((y) => (
        <Line key={y} points={[...P(y, 0), ...P(y, 0.12)]} stroke={COLORS.line} strokeWidth={lw} />
      ))}
    </>
  )
}

/** Netz frontal: Pfosten, Netzfläche mit Maschen, Bänder, Seitenbänder und rot-weiße Antennen */
function Net({ vp, netHeight }: { vp: NetViewport; netHeight: number }) {
  const P = (y: number, z: number) => {
    const p = netToPx(vp, y, z)
    return [p.px, p.py]
  }
  const top = netHeight
  const bottom = netHeight - COURT.netBandDepth
  const half = COURT.netWidth / 2
  const postY = COURT.halfWidth + COURT.postDistFromSideline
  const s = vp.scale

  const mesh: ReactElement[] = []
  const step = 0.1 // Maschenweite 10 cm
  if (step * s >= 3) {
    for (let y = -half; y <= half + 1e-9; y += step)
      mesh.push(<Line key={`v${y.toFixed(2)}`} points={[...P(y, bottom), ...P(y, top)]} stroke="#c8c8d0" strokeWidth={1} opacity={0.22} />)
    for (let z = bottom; z <= top + 1e-9; z += step)
      mesh.push(<Line key={`h${z.toFixed(2)}`} points={[...P(-half, z), ...P(half, z)]} stroke="#c8c8d0" strokeWidth={1} opacity={0.22} />)
  }

  return (
    <>
      {/* Pfosten */}
      {[-postY, postY].map((y) => (
        <Line key={y} points={[...P(y, 0), ...P(y, top + 0.1)]} stroke="#55555c" strokeWidth={Math.max(3, 2 * COURT.postRadius * s)} lineCap="round" />
      ))}
      {/* Spannseile zum Pfosten */}
      {[-1, 1].map((d) => (
        <Line key={`c${d}`} points={[...P(d * half, top - 0.03), ...P(d * postY, top - 0.03)]} stroke="#8a8a92" strokeWidth={1} />
      ))}
      {mesh}
      {/* Netzoberkante (7 cm) und Unterkante */}
      <Line points={[...P(-half, top - 0.035), ...P(half, top - 0.035)]} stroke="#d9d9de" strokeWidth={Math.max(2, 0.07 * s)} />
      <Line points={[...P(-half, bottom), ...P(half, bottom)]} stroke="#c9c9cf" strokeWidth={Math.max(1, 0.02 * s)} />
      {/* Seitenbänder (5 cm) über den Seitenlinien */}
      {[-1, 1].map((d) => (
        <Line
          key={`b${d}`}
          points={[...P(d * (COURT.halfWidth - COURT.sideBandWidth / 2), bottom), ...P(d * (COURT.halfWidth - COURT.sideBandWidth / 2), top)]}
          stroke="#e6e6ea"
          strokeWidth={Math.max(2, COURT.sideBandWidth * s)}
        />
      ))}
      {/* Antennen: 80 cm rot-weiß über der Netzkante, oberstes Feld rot */}
      {[-1, 1].map((d) =>
        Array.from({ length: 8 }, (_, i) => (
          <Line
            key={`a${d}${i}`}
            points={[...P(d * (COURT.halfWidth + 0.01), top + i * 0.1), ...P(d * (COURT.halfWidth + 0.01), top + (i + 1) * 0.1)]}
            stroke={i % 2 === 1 ? '#d63230' : '#e6e6ea'}
            strokeWidth={Math.max(2.5, 2 * COURT.antennaDisplayRadius * s)}
          />
        ))
      )}
    </>
  )
}

/** Spieler als Säule in Trikotfarbe an seiner Breitenposition, Schild mit Kürzel und Nummer über dem Kopf */
function PlayerFigure({ vp, p, dim = false }: { vp: NetViewport; p: CourtPlayerView; dim?: boolean }) {
  const s = vp.scale
  const foot = netToPx(vp, p.y, 0)
  const w = BODY_WIDTH * s
  const h = BODY_HEIGHT * s
  const r = Math.max(12, 0.3 * s)
  return (
    <Group opacity={dim ? 0.4 : 1}>
      <Rect
        x={foot.px - w / 2}
        y={foot.py - h}
        width={w}
        height={h}
        cornerRadius={Math.min(w / 2, 0.2 * s)}
        fill={p.jersey.fill}
        stroke={p.jersey.stroke}
        strokeWidth={1.5}
      />
      <Circle x={foot.px} y={foot.py - h - r - 4} radius={r} fill={p.jersey.fill} stroke={p.jersey.stroke} strokeWidth={2} />
      <Text x={foot.px - r} y={foot.py - h - r - 4 - r * 0.55} width={2 * r} align="center" text={p.role} fontSize={r * 0.62} fontStyle="bold" fill={p.jersey.text} />
      <Text x={foot.px - r} y={foot.py - h - r - 4 + r * 0.1} width={2 * r} align="center" text={String(p.number)} fontSize={r * 0.5} fill={p.jersey.text} />
    </Group>
  )
}
