import { Group, Line, Text } from 'react-konva'
import type Konva from 'konva'
import { TRAJECTORY_LABELS } from '@shared/types'
import { netProject, pxToNet, type NetViewport } from '@renderer/core/geometry/transform'
import {
  BALL_RADIUS,
  moveHitAlongParabola,
  pointAt,
  projectToHitBranches,
  sampleTrajectory,
  solveTrajectory
} from '@renderer/core/physics/trajectory'
import { COLORS } from '@renderer/theme/colors'
import { usePlay } from '@renderer/store/playStore'
import { useBall, usePathsHidden } from '@renderer/store/playbackStore'
import { useVisibleTrajectories, type TrajectoryView } from '@renderer/store/selectors'
import { attackPoints, solveAttack } from '@renderer/core/physics/attack'
import { Ball, Handle } from '../top/TrajectoryLayer'

/**
 * Flugbahnen in der Netzansicht (seitliche Parallelprojektion, mit der Ansicht drehbar) mit den Höhen-Griffen:
 *  - Start (hohler Punkt): senkrecht ziehen = Starthöhe
 *  - Scheitel (Raute): senkrecht ziehen = Scheitelhöhe; nie unter Start/Schlagpunkt
 *  - Schlagpunkt: nur entlang der Parabel, auf dem steigenden oder fallenden Ast; das Ende in der Draufsicht wandert mit
 */
export function NetTrajectories({ vp, interactive = true, showBall = true }: { vp: NetViewport; interactive?: boolean; showBall?: boolean }) {
  const visible = useVisibleTrajectories()
  // „Nur Ball“ beim Abspielen: Bahnen und Griffe ausblenden
  const hidden = usePathsHidden()
  const list = hidden ? [] : visible
  const schlagInput = usePlay((s) => (!hidden ? s.schlag : null))
  const selected = usePlay((s) => s.selected)
  const select = usePlay((s) => s.select)
  const setTrajectory = usePlay((s) => s.setTrajectory)
  const ball = useBall()

  const pts = (tv: TrajectoryView, s0: number, s1: number) =>
    sampleTrajectory(tv.sol, tv.input.start, s0, s1, 64).flatMap((p) => {
      const q = netProject(vp, p.x, p.y, p.z)
      return [q.px, q.py]
    })
  const at = (x: number, y: number, z: number) => {
    const p = netProject(vp, x, y, z)
    return { x: p.px, y: p.py }
  }
  const current = (tv: TrajectoryView) => usePlay.getState().trajectories[tv.type]

  const dragStart = (tv: TrajectoryView) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const t = current(tv)
    if (!t) return
    const z = pxToNet(vp, e.target.x(), e.target.y()).z
    setTrajectory(tv.type, { ...t, start: { ...t.start, h: z } })
    const s = usePlay.getState().trajectories[tv.type]!
    e.target.position(at(s.start.x, s.start.y, s.start.h))
  }
  const dragApex = (tv: TrajectoryView) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const t = current(tv)
    if (!t) return
    setTrajectory(tv.type, { ...t, apexH: pxToNet(vp, e.target.x(), e.target.y()).z })
    const n = usePlay.getState().trajectories[tv.type]!
    const sol = solveTrajectory(n)
    const a = pointAt(sol, n.start, sol.sA)
    e.target.position(at(a.x, a.y, sol.apexH))
  }
  const dragHit = (tv: TrajectoryView) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const t = current(tv)
    if (!t) return
    const s = projectToHitBranches(solveTrajectory(t), t.start, (p) => netProject(vp, p.x, p.y, p.z), e.target.x(), e.target.y())
    const next = moveHitAlongParabola(t, s)
    setTrajectory(tv.type, next)
    e.target.position(at(next.end.x, next.end.y, next.hitH))
  }

  return (
    <>
      {list.map((tv) => {
        const { sol, input, type } = tv
        const isSel = selected === type
        const apex = pointAt(sol, input.start, sol.sA)
        const label = at(apex.x, apex.y, apex.z)
        return (
          <Group key={type} opacity={type === 'annahme' ? 0.8 : 1}>
            {sol.rising && (
              // Schlagpunkt vor dem Scheitel: Weg bis zum Scheitel angedeutet, damit der Scheitel-Griff auf der Bahn liegt
              <Line points={pts(tv, sol.D, sol.sA)} stroke={COLORS.trajectory} strokeWidth={2} dash={[3, 6]} opacity={0.4} listening={false} />
            )}
            <Line
              points={pts(tv, 0, sol.D)}
              stroke={COLORS.trajectory}
              strokeWidth={isSel ? 4 : 3}
              lineCap="round"
              lineJoin="round"
              hitStrokeWidth={22}
              shadowColor="#000"
              shadowBlur={isSel ? 10 : 4}
              shadowOpacity={0.6}
              onClick={() => select(type)}
              onTap={() => select(type)}
            />
            <Text x={label.x - 40} y={label.y - 30} width={80} align="center" text={TRAJECTORY_LABELS[type]} fontSize={12} fontStyle="bold" fill={COLORS.trajectory} listening={false} />
          </Group>
        )
      })}
      {schlagInput && (() => {
        const sol = solveAttack(schlagInput)
        const proj = (ps: { x: number; y: number; z: number }[]) => ps.flatMap((p) => { const q = netProject(vp, p.x, p.y, p.z); return [q.px, q.py] })
        const isSel = selected === 'schlag'
        const top = attackPoints(sol, 0, sol.tHit, 64).reduce((a, b) => (b.z > a.z ? b : a))
        const label = at(top.x, top.y, top.z)
        return (
          <Group>
            <Line
              points={proj(attackPoints(sol, 0, sol.tHit, 64))}
              stroke={COLORS.trajectory}
              strokeWidth={isSel ? 4 : 3}
              lineCap="round"
              lineJoin="round"
              hitStrokeWidth={22}
              shadowColor="#000"
              shadowBlur={isSel ? 10 : 4}
              shadowOpacity={0.6}
              onClick={() => select('schlag')}
              onTap={() => select('schlag')}
            />
            <Text x={label.x - 40} y={label.y - 22} width={80} align="center" text="Schlag" fontSize={12} fontStyle="bold" fill={COLORS.trajectory} listening={false} />
          </Group>
        )
      })()}
      {/* Griffe über allen Linien, damit keine Bahn einen Griff verdeckt (Annahme-Schlagpunkt = Zuspiel-Start) */}
      {interactive &&
        list.map((tv) => {
          const { sol, input, type } = tv
          const apex = pointAt(sol, input.start, sol.sA)
          return (
            <Group key={`h-${type}`}>
              {!tv.coupled && <Handle {...at(input.start.x, input.start.y, input.start.h)} onDrag={dragStart(tv)} onPick={() => select(type)} hollow />}
              <Handle {...at(apex.x, apex.y, apex.z)} onDrag={dragApex(tv)} onPick={() => select(type)} diamond />
              <Handle {...at(input.end.x, input.end.y, input.hitH)} onDrag={dragHit(tv)} onPick={() => select(type)} />
            </Group>
          )
        })}
      {showBall && ball && <Ball {...at(ball.x, ball.y, ball.z)} r={Math.max(6, BALL_RADIUS * vp.scale)} />}
    </>
  )
}


/** Länge eines Linienzugs [x0, y0, x1, y1, …] in Pixeln */
export function polyLength(pts: number[]): number {
  let len = 0
  for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1])
  return len
}
