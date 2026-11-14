import { Circle, Group, Layer, Line, Text } from 'react-konva'
import type Konva from 'konva'
import { topToWorld, worldToTop, type TopViewport } from '@renderer/core/geometry/transform'
import { clampToArea } from '@renderer/core/lineup/lineup'
import { useCourtPlayers, useLaeuferMarkers, type CourtPlayerView } from '@renderer/store/selectors'
import { usePlay } from '@renderer/store/playStore'
import { useUi } from '@renderer/store/settingsStore'
import { usePlayback, useScene } from '@renderer/store/playbackStore'
import { planAt } from '@renderer/core/motion/plan'
import { COLORS } from '@renderer/theme/colors'
import { LaeuferBadge } from './LaeuferBadge'

/** Name der Konva-Gruppen, über die man Spieler beim Treffertest erkennt. */
export const PLAYER_NODE_NAME = 'player'

/** Mindestradius in Pixeln, damit Spieler mit dem Finger gut greifbar sind. */
const MIN_RADIUS_PX = 22
/** Radius in Metern (Schulterbreite etwa) */
const RADIUS_M = 0.38

/**
 * Spieler als Kreise mit Kürzel und Rückennummer, frei ziehbar mit Maus, Stift und Finger
 * (der Finger muss direkt auf dem Spieler aufsetzen; daneben verschiebt er die Ansicht).
 */
export function PlayersLayer({ vp, interactive = true }: { vp: TopViewport; interactive?: boolean }) {
  const players = useCourtPlayers()
  const movePlayer = usePlay((s) => s.movePlayer)
  const showNames = useUi((s) => s.showNames)
  const selectPlayer = usePlay((s) => s.selectPlayer)
  const selected = usePlay((s) => s.selectedPlayer)
  const markers = useLaeuferMarkers()
  const r = Math.max(MIN_RADIUS_PX, RADIUS_M * vp.scale)
  // Nur wenn sich jemand bewegt (Laufweg, Sprung, gekoppelter Ballkontakt, Block), der Uhr folgen – sonst kein Neuzeichnen pro Bild
  const scene = useScene()
  const moving = [...scene.plans.values()].some((p) => p.path || p.legs.length > 0 || p.jumps.length > 0)
  const t = usePlayback((s) => (moving ? s.t : 0))

  const onDrag = (p: CourtPlayerView) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const w = topToWorld(vp, node.x(), node.y())
    const c = clampToArea(w.x, w.y)
    movePlayer(p.side, p.playerId, c.x, c.y)
    // Position aus dem Store (der Libero bleibt mit Regeln hinter der 3-m-Linie)
    const now = usePlay.getState().sides[p.side].players.find((q) => q.playerId === p.playerId) ?? c
    const px = worldToTop(vp, now.x, now.y)
    node.position({ x: px.px, y: px.py })
  }
  // Verschieben gilt für den Platz in der Grundstellung: läuft die Animation, erst zurück an den Anfang
  const toStart = () => {
    if (usePlayback.getState().t === 0 && !usePlayback.getState().playing) return
    usePlayback.getState().pause()
    usePlayback.setState({ t: 0 })
  }

  return (
    <Layer listening={interactive}>
      {players.map((p) => {
        const plan = scene.plans.get(p.key)
        const at = moving && plan ? planAt(plan, t) : { x: p.x, y: p.y, z: 0 }
        const pos = worldToTop(vp, at.x, at.y)
        const colors = p.jersey
        const isSel = selected?.side === p.side && selected.playerId === p.playerId
        // Im Sprung: etwas größer, Schatten weiter weg
        const lift = 1 + at.z * 0.45
        return (
          <Group
            key={p.key}
            name={PLAYER_NODE_NAME}
            x={pos.px}
            y={pos.py}
            scaleX={lift}
            scaleY={lift}
            draggable
            dragDistance={3}
            onPointerDown={toStart}
            onClick={() => selectPlayer({ side: p.side, playerId: p.playerId })}
            onTap={() => selectPlayer({ side: p.side, playerId: p.playerId })}
            onDragMove={onDrag(p)}
            onDragEnd={onDrag(p)}
            onMouseEnter={(e) => setCursor(e, 'grab')}
            onMouseLeave={(e) => setCursor(e, '')}
          >
            {isSel && <Circle radius={r + 4} stroke={COLORS.accent} strokeWidth={2.5} listening={false} />}
            {p.court.block &&
              (() => {
                // Blocker: Balken (die Hände) auf der Netzseite des Spielers
                const a = worldToTop({ ...vp, originX: 0, originY: 0 }, p.side === 'A' ? 1 : -1, 0)
                const n = Math.hypot(a.px, a.py) || 1
                const ux = a.px / n
                const uy = a.py / n
                const d = r + 5
                const w = r * 0.85
                return <Line points={[ux * d - uy * w, uy * d + ux * w, ux * d + uy * w, uy * d - ux * w]} stroke={colors.stroke} strokeWidth={6} lineCap="round" shadowColor="#000" shadowBlur={4} shadowOpacity={0.6} listening={false} />
              })()}
            <Circle
              radius={r}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={2}
              shadowColor="#000"
              shadowBlur={6 + at.z * 30}
              shadowOffsetY={at.z * 18}
              shadowOpacity={0.5}
            />
            <Text
              text={p.role}
              x={-r}
              y={-r * 0.55}
              width={2 * r}
              align="center"
              fontSize={r * 0.62}
              fontStyle="bold"
              fill={colors.text}
              listening={false}
            />
            <Text
              text={String(p.number)}
              x={-r}
              y={r * 0.12}
              width={2 * r}
              align="center"
              fontSize={r * 0.5}
              fill={colors.text}
              opacity={0.85}
              listening={false}
            />
            {markers.has(p.key) && (
              // Läufer-Abzeichen oben rechts am Bezugs-Steller
              <LaeuferBadge x={r * 0.8} y={-r * 0.8} n={markers.get(p.key)!.n} standIn={markers.get(p.key)!.standIn} h={Math.max(15, r * 0.6)} />
            )}
            {showNames && p.name.trim() && (
              // Name unter dem Spieler, immer aufrecht
              <Text
                text={p.name.trim()}
                x={-80}
                y={r + 3}
                width={160}
                align="center"
                fontSize={Math.max(11, Math.min(15, r * 0.48))}
                fontStyle="bold"
                fill={COLORS.text}
                shadowColor="#000"
                shadowBlur={4}
                shadowOpacity={0.9}
                listening={false}
              />
            )}
          </Group>
        )
      })}
    </Layer>
  )
}

function setCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
  const container = e.target.getStage()?.container()
  if (container) container.style.cursor = cursor
}

/** Liegt unter dem Zeiger ein ziehbares Objekt (Spieler oder Griff)? Für die Gestenerkennung der Ansicht. */
export function hitsDraggable(stage: Konva.Stage | null, clientX: number, clientY: number): boolean {
  if (!stage) return false
  const rect = stage.container().getBoundingClientRect()
  const shape = stage.getIntersection({ x: clientX - rect.left, y: clientY - rect.top })
  return !!shape?.findAncestor(`.${PLAYER_NODE_NAME}, .handle`)
}
