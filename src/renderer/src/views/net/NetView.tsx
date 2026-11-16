import type { ReactElement } from 'react'
import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva'
import { HEAD_DIAMETER } from '@shared/types'
import { COURT } from '@renderer/core/geometry/court'
import { applyViewNet, isNearSide, netDepth, netHalfExtent, netOrient, netProject, netToPx, type NetViewport } from '@renderer/core/geometry/transform'
import { tween } from '@renderer/components/tween'
import { COLORS } from '@renderer/theme/colors'
import { useElementSize } from '@renderer/components/useElementSize'
import { useZoomPan } from '@renderer/components/useZoomPan'
import { ViewControls } from '@renderer/components/ViewControls'
import { PipBar } from '@renderer/components/PipBar'
import { useUi } from '@renderer/store/settingsStore'
import { NamesButton, ViewSwapButton } from '@renderer/components/ViewToggles'
import { useCourtPlayers, useLaeuferMarkers, type CourtPlayerView } from '@renderer/store/selectors'
import { useEffect, useRef } from 'react'
import type Konva from 'konva'
import { NetTrajectories } from './NetTrajectories'
import { hitsDraggable } from '../top/PlayersLayer'
import { LaeuferBadge } from '../top/LaeuferBadge'
import { typingTarget } from '../three/keyCamera'
import { NET_ANGLES, NET_KEY_HELP, netYawLabel } from './netAngles'
import { useEmptyTapClose } from '@renderer/components/useEmptyTapClose'
import { usePlayback, useScene } from '@renderer/store/playbackStore'
import { planAt } from '@renderer/core/motion/plan'

/** Sichtbare Breite: Feld plus Freizone (Pfosten stehen 1 m neben den Seitenlinien) */
export const HALF_W = COURT.halfWidth + COURT.freeZone
/** Maximal darstellbare Höhe in Metern */
const Z_MAX = 25
const PAD_X = 16
const PAD_T = 44
/** Unten Platz für „Spieler“ und den Kompass, damit der Boden frei bleibt */
const PAD_B = 64
/** Kompakt (Pop-up): wenig Rand, die Bedienleiste liegt in der Kopfleiste darüber */
const PAD_T_COMPACT = 12
/** Kompakt unten: Platz für den Kompass */
const PAD_B_COMPACT = 52
/** Kompakt: sichtbare Höhe, an die das Netz angepasst wird (Netz, Antennen und typische Flugkurven) */
const Z_COMPACT = 8

const BODY_WIDTH = 0.5

/**
 * Netzansicht: flacher, maßstabstreuer Blick aufs Netz – frei rundum drehbar (Standard: frontal von Seite A).
 * Horizontal = Feldbreite, vertikal = Höhe. So sieht man Flugkurven parallel zum Netz.
 * Zeichenreihenfolge = Tiefe: Spieler der anderen Seite, Netz, Spieler der eigenen Seite.
 * Darüber Flugbahnen, Ball und die Griffe für Starthöhe, Scheitel und Schlagpunkt.
 */
export function NetView({ compact = false }: { compact?: boolean }) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const netHeight = useUi((s) => s.netHeight)
  const showPlayers = useUi((s) => s.netShowPlayers)
  const setShowPlayers = useUi((s) => s.setNetShowPlayers)
  const basePlayers = useCourtPlayers()
  // Laufwege und Sprünge: Spieler zur aktuellen Zeit (nur mit Bewegungen der Uhr folgen)
  const scene = useScene()
  const moving = [...scene.plans.values()].some((p) => p.path || p.legs.length > 0 || p.jumps.length > 0)
  const t = usePlayback((s) => (moving ? s.t : 0))
  const players = moving
    ? basePlayers.map((p) => {
        const plan = scene.plans.get(p.key)
        const at = plan ? planAt(plan, t) : { x: p.x, y: p.y, z: 0 }
        return { ...p, x: at.x, y: at.y, lift: at.z }
      })
    : basePlayers
  const yaw = useUi((s) => s.netYaw)
  const setYaw = useUi((s) => s.setNetYaw)
  // Freier Blickwinkel rundum → Blickseite (wer steht vorn) und Drehung
  const { from, angle } = netOrient(yaw)
  // Sichtbare halbe Breite hängt von der Drehung ab (seitlich sieht man die ganze Feldlänge)
  const halfW = netHalfExtent({ from, angle }, COURT.halfLength + COURT.freeZone, HALF_W)

  // Basis: die Breite füllt die Fläche; mehr als 25 m Höhe sind nie sichtbar
  const padT = compact ? PAD_T_COMPACT : PAD_T
  const padB = compact ? PAD_B_COMPACT : PAD_B
  const widthFit = (size.width - 2 * PAD_X) / (2 * halfW)
  // Vollansicht: Breite füllt, höchstens 25 m Höhe. Kompakt: Netz passt immer ganz ins Fenster (Breite und 8 m Höhe).
  const scale = compact
    ? Math.max(0.0001, Math.min(widthFit, (size.height - padT - padB) / Z_COMPACT))
    : Math.max(0.0001, widthFit, (size.height - padT - padB) / Z_MAX)
  const base: NetViewport = { scale, originX: size.width / 2, groundY: size.height - padB, from, angle }
  const content = {
    x0: base.originX - halfW * scale - PAD_X,
    x1: base.originX + halfW * scale + PAD_X,
    y0: base.groundY - Z_MAX * scale - padT,
    y1: size.height
  }
  const { view, zoomIn, zoomOut, reset } = useZoomPan(ref, {
    size,
    content,
    // Button-Zoom am Boden unter der Mitte, damit Boden und Netz im Bild bleiben
    zoomAnchor: { x: size.width / 2, y: size.height - padB },
    // Im Bild-im-Bild feste Ansicht: kein Zoom, kein Verschieben
    enabled: !compact,
    // Finger auf einem Höhen-Griff zieht den Griff
    shouldIgnore: (e) => hitsDraggable(stageRef.current, e.clientX, e.clientY)
  })
  const stageRef = useRef<Konva.Stage>(null)
  const vp = applyViewNet(base, view)

  // Kamerafahrt zu einem festen Blickwinkel (kürzester Weg); Ziehen und Tasten brechen sie ab
  const flightRef = useRef<(() => void) | null>(null)
  const stopFlight = () => {
    flightRef.current?.()
    flightRef.current = null
  }
  const flyTo = (target: number) => {
    stopFlight()
    const a0 = useUi.getState().netYaw
    let d = (target - a0) % 360
    if (d > 180) d -= 360
    if (d < -180) d += 360
    if (Math.abs(d) < 0.5) return setYaw(target)
    flightRef.current = tween(Math.min(600, 250 + Math.abs(d) * 2), (k) => setYaw(k >= 1 ? target : a0 + d * k))
  }
  const flyRef = useRef(flyTo)
  flyRef.current = flyTo
  useEffect(() => stopFlight, [])

  // Drehen: waagerecht ziehen mit Maus/Stift auf freier Fläche (Finger nur, solange nicht hineingezoomt ist) – rundum, ohne Anschlag
  const zoomedRef = useRef(false)
  zoomedRef.current = view.z > 1.001
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let drag: { id: number; x: number; a0: number } | null = null
    const onDown = (e: PointerEvent) => {
      const ok = (e.pointerType === 'touch' && !zoomedRef.current) || (e.pointerType !== 'touch' && e.button === 0)
      if (!ok || drag || hitsDraggable(stageRef.current, e.clientX, e.clientY)) return
      stopFlight()
      drag = { id: e.pointerId, x: e.clientX, a0: useUi.getState().netYaw }
    }
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      // Das Feld folgt der Maus: nach rechts ziehen schiebt das Bild nach rechts
      setYaw(Math.round(drag.a0 - (e.clientX - drag.x) * 0.35))
    }
    const onUp = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) drag = null
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [ref, compact, setYaw])

  // Tastatur: 1–8 feste Blickwinkel rund ums Feld, Q/E drehen (Shift = schneller)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e)) return
      const ui = useUi.getState()
      if (ui.dialog || ui.teamsOpen || ui.settingsOpen) return
      const n = /^(?:Digit|Numpad)([1-8])$/.exec(e.code)
      if (n && !e.repeat) {
        e.preventDefault()
        flyRef.current(NET_ANGLES[Number(n[1]) - 1].yaw)
      } else if (e.code === 'KeyQ' || e.code === 'KeyE') {
        e.preventDefault()
        stopFlight()
        ui.setNetYaw(Math.round(ui.netYaw + (e.code === 'KeyE' ? 1 : -1) * (e.shiftKey ? 9 : 3)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Tippen ins Leere schließt Flugbahn- und Spieler-Karte
  useEmptyTapClose(ref, stageRef)
  // Nach einer Größenänderung alle Ebenen neu zeichnen
  useEffect(() => {
    const id = requestAnimationFrame(() => stageRef.current?.batchDraw())
    return () => cancelAnimationFrame(id)
  }, [size.width, size.height])

  // Zurücksetzen: Zoom weg und zurück zum Standard (frontal von A)
  const resetAll = () => {
    reset()
    flyTo(0)
  }

  // Nach Tiefe zeichnen (Maler-Algorithmus): vom Betrachter am weitesten entfernt zuerst.
  // Der Betrachter steht hinter der eigenen Grundlinie; „Nähe“ = Abstand zur Grundlinie des Betrachters.
  const byDepth = (a: CourtPlayerView, b: CourtPlayerView) => netDepth(vp, b.x, b.y) - netDepth(vp, a.x, a.y)
  const far = players.filter((p) => !isNearSide(vp, p.x)).sort(byDepth)
  const near = players.filter((p) => isNearSide(vp, p.x)).sort(byDepth)

  return (
    <>
      <div className="canvas-host" ref={ref}>
        {size.width > 0 && (
          <Stage ref={stageRef} width={size.width} height={size.height}>
            <Layer listening={false}>
              <Floor vp={vp} />
              {showPlayers && far.map((p) => <PlayerFigure key={p.key} vp={vp} p={p} dim />)}
              <Net vp={vp} netHeight={netHeight} />
              {showPlayers && near.map((p) => <PlayerFigure key={p.key} vp={vp} p={p} />)}
            </Layer>
            {/* Flugbahnen (projiziert auf die Netzebene), Höhen-Griffe und Ball */}
            <Layer name="trajectories">
              <NetTrajectories vp={vp} />
            </Layer>
          </Stage>
        )}
      </div>
      {compact ? (
        <>
          {/* Kompakte Leiste im Pop-up: Spieler, Tauschen, Minimieren */}
          <PipBar>
            <label className="pip-check">
              <input type="checkbox" checked={showPlayers} onChange={(e) => setShowPlayers(e.target.checked)} />
              Spieler
            </label>
          </PipBar>
          <Compass yaw={yaw} onReset={() => flyTo(0)} compact />
        </>
      ) : (
        <>
          <label className="pane-check">
            <input type="checkbox" checked={showPlayers} onChange={(e) => setShowPlayers(e.target.checked)} />
            Spieler
          </label>
          <Compass yaw={yaw} onReset={() => flyTo(0)} />
          <ViewControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetAll} lead={<ViewSwapButton />}>
            <NamesButton />
          </ViewControls>
        </>
      )}
    </>
  )
}

/** Boden: Feld als Linie (Ausdehnung je nach Drehung), Ecken des Feldes als Markierung, Umgebung gedämpft */
export function Floor({ vp }: { vp: NetViewport }) {
  const L = COURT.halfLength
  const W = COURT.halfWidth
  const lw = Math.max(1.5, COURT.lineWidth * vp.scale)
  const corners = [
    [-L, -W],
    [L, -W],
    [L, W],
    [-L, W]
  ].map(([x, y]) => netProject(vp, x, y, 0).px)
  const outer = netHalfExtent(vp, L + COURT.freeZone, W + COURT.freeZone) + 2
  const gy = vp.groundY
  return (
    <>
      <Line points={[vp.originX - outer * vp.scale, gy, vp.originX + outer * vp.scale, gy]} stroke={COLORS.lineDim} strokeWidth={1.5} />
      <Line points={[Math.min(...corners), gy, Math.max(...corners), gy]} stroke={COLORS.line} strokeWidth={lw * 1.6} lineCap="butt" />
      {corners.map((px, i) => (
        <Line key={i} points={[px, gy, px, gy - 0.12 * vp.scale]} stroke={COLORS.line} strokeWidth={lw} />
      ))}
    </>
  )
}

/** Netz (in der Ebene x = 0, mit der Ansicht gedreht): Pfosten, Netzfläche mit Maschen, Bänder, Seitenbänder und rot-weiße Antennen */
export function Net({ vp, netHeight }: { vp: NetViewport; netHeight: number }) {
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
  // Maschen nur zeichnen, wenn sie (auch schräg betrachtet) mindestens 3 px auseinander liegen
  if (step * s * Math.abs(netProject(vp, 0, 1, 0).px - netProject(vp, 0, 0, 0).px) / s >= 3) {
    for (let y = -half; y <= half + 1e-9; y += step)
      mesh.push(<Line key={`v${y.toFixed(2)}`} points={[...P(y, bottom), ...P(y, top)]} stroke={COLORS.netMesh} strokeWidth={1} opacity={0.22} />)
    for (let z = bottom; z <= top + 1e-9; z += step)
      mesh.push(<Line key={`h${z.toFixed(2)}`} points={[...P(-half, z), ...P(half, z)]} stroke={COLORS.netMesh} strokeWidth={1} opacity={0.22} />)
  }

  return (
    <>
      {/* Pfosten */}
      {[-postY, postY].map((y) => (
        <Line key={y} points={[...P(y, 0), ...P(y, top + 0.1)]} stroke={COLORS.post} strokeWidth={Math.max(3, 2 * COURT.postRadius * s)} lineCap="round" />
      ))}
      {/* Abspannseile oben und unten vom Netz zu den Pfosten, unauffällig grau wie die Pfosten */}
      {[-1, 1].flatMap((d) => [
        <Line key={`ct${d}`} points={[...P(d * half, top - 0.035), ...P(d * postY, top - 0.035)]} stroke={COLORS.rope} strokeWidth={Math.max(1.2, 0.012 * s)} />,
        <Line key={`cb${d}`} points={[...P(d * half, bottom), ...P(d * postY, bottom)]} stroke={COLORS.rope} strokeWidth={Math.max(1.2, 0.012 * s)} />
      ])}
      {/* Netzfläche als leichter Schleier: Spieler dahinter stehen sichtbar hinter dem Netz */}
      <Line points={[...P(-half, bottom), ...P(half, bottom), ...P(half, top), ...P(-half, top)]} closed fill={COLORS.netMesh} opacity={0.16} />
      {mesh}
      {/* Netzoberkante (7 cm) und Unterkante */}
      <Line points={[...P(-half, top - 0.035), ...P(half, top - 0.035)]} stroke={COLORS.netTape} strokeWidth={Math.max(2, 0.07 * s)} />
      <Line points={[...P(-half, bottom), ...P(half, bottom)]} stroke={COLORS.netBand} strokeWidth={Math.max(1, 0.02 * s)} />
      {/* Seitenbänder (5 cm) über den Seitenlinien */}
      {[-1, 1].map((d) => (
        <Line
          key={`b${d}`}
          points={[...P(d * (COURT.halfWidth - COURT.sideBandWidth / 2), bottom), ...P(d * (COURT.halfWidth - COURT.sideBandWidth / 2), top)]}
          stroke={COLORS.netTape}
          strokeWidth={Math.max(2, COURT.sideBandWidth * s)}
        />
      ))}
      {/* Antennen: 80 cm rot-weiß über der Netzkante, oberstes Feld rot */}
      {[-1, 1].map((d) =>
        Array.from({ length: 8 }, (_, i) => (
          <Line
            key={`a${d}${i}`}
            points={[...P(d * (COURT.halfWidth + 0.01), top + i * 0.1), ...P(d * (COURT.halfWidth + 0.01), top + (i + 1) * 0.1)]}
            stroke={i % 2 === 1 ? '#d63230' : COLORS.antenna}
            strokeWidth={Math.max(2.5, 2 * COURT.antennaDisplayRadius * s)}
          />
        ))
      )}
    </>
  )
}

/**
 * Spieler als Säule in Trikotfarbe an seiner Breitenposition, der Kreis mit Kürzel und Nummer ist der Kopf.
 * Körper + Kopf ergeben zusammen genau die Körpergröße.
 */
export function PlayerFigure({ vp, p, dim = false }: { vp: NetViewport; p: CourtPlayerView & { lift?: number }; dim?: boolean }) {
  const showNames = useUi((st) => st.showNames)
  const marked = useLaeuferMarkers().get(p.key)
  const s = vp.scale
  // Im Sprung stehen die Füße um die Sprunghöhe über dem Boden
  const foot = netProject(vp, p.x, p.y, p.lift ?? 0)
  const w = BODY_WIDTH * s
  const headR = (HEAD_DIAMETER / 2) * s
  // Körper = echte Körpergröße, der Kopf (Schild) sitzt darüber
  const h = Math.max(0.2, p.height) * s
  // Der Kopf wächst nur für die Lesbarkeit über die echte Größe hinaus (min. 12 px Radius)
  const r = Math.max(12, headR)
  return (
    <Group opacity={dim ? 0.6 : 1}>
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
      <Circle x={foot.px} y={foot.py - h - r} radius={r} fill={p.jersey.fill} stroke={p.jersey.stroke} strokeWidth={2} />
      <Text x={foot.px - r} y={foot.py - h - r - r * 0.55} width={2 * r} align="center" text={p.role} fontSize={r * 0.62} fontStyle="bold" fill={p.jersey.text} />
      <Text x={foot.px - r} y={foot.py - h - r + r * 0.1} width={2 * r} align="center" text={String(p.number)} fontSize={r * 0.5} fill={p.jersey.text} />
      {marked && <LaeuferBadge x={foot.px + r * 0.85} y={foot.py - h - 2 * r + r * 0.2} n={marked.n} standIn={marked.standIn} h={Math.max(14, r * 0.7)} />}
      {showNames && p.name.trim() && (
        <Text
          x={foot.px - 80}
          y={foot.py - h - 2 * r - 18}
          width={160}
          align="center"
          text={p.name.trim()}
          fontSize={12}
          fontStyle="bold"
          fill={COLORS.text}
          shadowColor={COLORS.halo}
          shadowBlur={4}
          shadowOpacity={0.9}
        />
      )}
    </Group>
  )
}

/**
 * Kompass unten in der Mitte: kleine Draufsicht (A links, B rechts) mit dem Standpunkt des Betrachters,
 * daneben der Name des Blickwinkels. Antippen = zurück zum Standard (frontal von A).
 */
function Compass({ yaw, onReset, compact = false }: { yaw: number; onReset: () => void; compact?: boolean }) {
  const S = compact ? 30 : 36
  const c = S / 2
  const R = c - 3.5
  const th = (yaw * Math.PI) / 180
  // Betrachter steht der Blickrichtung entgegen; in der Draufsicht zeigt +y nach oben
  const vx = c - Math.cos(th) * R
  const vy = c + Math.sin(th) * R
  const cw = S * 0.5
  const ch = cw / 2
  const help = NET_KEY_HELP.map((k) => `${k.keys}: ${k.label}`).join('\n')
  return (
    <button className={`net-compass ${compact ? 'compact' : ''}`} onClick={onReset} title={`Zurück zu „Von A“ (0°)\n\n${help}`} aria-label={`Blickwinkel ${netYawLabel(yaw)} – zurück zu Von A`}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden="true">
        <circle cx={c} cy={c} r={R} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} />
        <rect x={c - cw / 2} y={c - ch / 2} width={cw} height={ch} rx={1} fill="none" stroke="currentColor" strokeOpacity={0.7} strokeWidth={1.2} />
        <line x1={c} y1={c - ch / 2 - 2} x2={c} y2={c + ch / 2 + 2} stroke="currentColor" strokeWidth={1.4} />
        <line x1={vx} y1={vy} x2={c + (vx - c) * 0.45} y2={c + (vy - c) * 0.45} stroke="var(--accent-ring)" strokeWidth={1.6} strokeLinecap="round" />
        <circle cx={vx} cy={vy} r={3.2} fill="var(--accent-ring)" />
      </svg>
      <span className="value">{netYawLabel(yaw)}</span>
    </button>
  )
}
