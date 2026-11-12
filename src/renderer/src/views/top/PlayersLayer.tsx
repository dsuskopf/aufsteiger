import { Circle, Group, Layer, Text } from 'react-konva'
import type Konva from 'konva'
import { topToWorld, worldToTop, type TopViewport } from '@renderer/core/geometry/transform'
import { clampToArea } from '@renderer/core/lineup/lineup'
import { useCourtPlayers, type CourtPlayerView } from '@renderer/store/selectors'
import { usePlay } from '@renderer/store/playStore'
import { useUi } from '@renderer/store/settingsStore'
import { COLORS } from '@renderer/theme/colors'

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
  const r = Math.max(MIN_RADIUS_PX, RADIUS_M * vp.scale)

  const onDrag = (p: CourtPlayerView) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const w = topToWorld(vp, node.x(), node.y())
    const c = clampToArea(w.x, w.y)
    movePlayer(p.side, p.playerId, c.x, c.y)
    const px = worldToTop(vp, c.x, c.y)
    node.position({ x: px.px, y: px.py })
  }

  return (
    <Layer listening={interactive}>
      {players.map((p) => {
        const pos = worldToTop(vp, p.x, p.y)
        const colors = p.jersey
        return (
          <Group
            key={p.key}
            name={PLAYER_NODE_NAME}
            x={pos.px}
            y={pos.py}
            draggable
            dragDistance={3}
            onDragMove={onDrag(p)}
            onDragEnd={onDrag(p)}
            onMouseEnter={(e) => setCursor(e, 'grab')}
            onMouseLeave={(e) => setCursor(e, '')}
          >
            <Circle
              radius={r}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={2}
              shadowColor="#000"
              shadowBlur={6}
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
