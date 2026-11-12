import { Arrow, Circle, Group, Layer, Line } from 'react-konva'
import type Konva from 'konva'
import type { CourtSide, Vec2 } from '@shared/types'
import { topToWorld, worldToTop, type TopViewport } from '@renderer/core/geometry/transform'
import { clampToArea } from '@renderer/core/lineup/lineup'
import { pathCurve } from '@renderer/core/motion/motion'
import { usePlay } from '@renderer/store/playStore'
import { usePathsHidden } from '@renderer/store/playbackStore'
import { useCourtPlayers } from '@renderer/store/selectors'
import { COLORS } from '@renderer/theme/colors'
import { Handle } from './TrajectoryLayer'

/**
 * Laufwege in der Draufsicht: gestrichelte, glatte Kurve vom Platz des Spielers mit Pfeil und blassem Ziel-Kreis.
 * Beim gewählten Spieler lassen sich die Punkte des Weges an Griffen verschieben.
 */
export function PathLayer({ vp, interactive, stroke }: { vp: TopViewport; interactive: boolean; stroke?: Vec2[] | null }) {
  const players = useCourtPlayers()
  const selected = usePlay((s) => s.selectedPlayer)
  const setPath = usePlay((s) => s.setPath)
  const hidden = usePathsHidden()
  const P = (p: Vec2) => {
    const q = worldToTop(vp, p.x, p.y)
    return [q.px, q.py]
  }
  const r = Math.max(10, 0.3 * vp.scale)

  const dragPoint = (side: CourtSide, playerId: string, i: number) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const c = usePlay.getState().sides[side].players.find((p) => p.playerId === playerId)
    if (!c?.path) return
    const w = topToWorld(vp, e.target.x(), e.target.y())
    const q = clampToArea(w.x, w.y)
    const points = c.path.points.map((p, k) => (k === i ? q : p))
    setPath(side, playerId, { ...c.path, points })
    const px = worldToTop(vp, q.x, q.y)
    e.target.position({ x: px.px, y: px.py })
  }

  return (
    <Layer listening={interactive}>
      {!hidden &&
        players.map((p) => {
          const path = p.court.path
          if (!path || path.points.length === 0) return null
          const isSel = selected?.side === p.side && selected.playerId === p.playerId
          const { poly } = pathCurve(p.court, path)
          const pts = poly.flatMap(P)
          const end = poly[poly.length - 1]
          const color = isSel ? COLORS.accent : p.jersey.fill
          return (
            <Group key={p.key} listening={false}>
              {/* Kontur, damit dunkle Teamfarben auf dem Boden sichtbar bleiben */}
              <Line points={pts} stroke="#000" strokeWidth={5} opacity={0.35} lineCap="round" lineJoin="round" />
              <Arrow
                points={pts}
                stroke={color}
                fill={color}
                strokeWidth={isSel ? 3 : 2.5}
                dash={[10, 7]}
                pointerLength={10}
                pointerWidth={10}
                lineCap="round"
                lineJoin="round"
              />
              <Circle x={P(end)[0]} y={P(end)[1]} radius={r} stroke={color} strokeWidth={1.5} dash={[4, 4]} opacity={0.7} />
            </Group>
          )
        })}
      {/* Griffe des gewählten Laufwegs */}
      {interactive &&
        !hidden &&
        selected &&
        players
          .filter((p) => p.side === selected.side && p.playerId === selected.playerId && p.court.path)
          .flatMap((p) =>
            p.court.path!.points.map((q, i) => {
              const [x, y] = P(q)
              return <Handle key={`${p.key}-${i}`} x={x} y={y} onDrag={dragPoint(p.side, p.playerId, i)} hollow={i < p.court.path!.points.length - 1} />
            })
          )}
      {/* Strich beim Zeichnen */}
      {stroke && stroke.length > 1 && (
        <Line points={stroke.flatMap(P)} stroke={COLORS.accent} strokeWidth={3} dash={[8, 6]} lineCap="round" lineJoin="round" listening={false} />
      )}
    </Layer>
  )
}
