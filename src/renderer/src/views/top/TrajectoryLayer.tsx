import { Arrow, Circle, Group, Layer, Line, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import { TRAJECTORY_LABELS } from '@shared/types'
import { topToWorld, worldToTop, type TopViewport } from '@renderer/core/geometry/transform'
import { clampToArea } from '@renderer/core/lineup/lineup'
import { BALL_RADIUS, pointAt } from '@renderer/core/physics/trajectory'
import { BALL_COLORS, COLORS } from '@renderer/theme/colors'
import { usePlay } from '@renderer/store/playStore'
import { useBall, usePathsHidden } from '@renderer/store/playbackStore'
import { useVisibleTrajectories, type TrajectoryView } from '@renderer/store/selectors'
import { attackPoints, solveAttack } from '@renderer/core/physics/attack'

/** Name der ziehbaren Griffe (Treffertest für die Gestenerkennung) */
export const HANDLE_NODE_NAME = 'handle'
/** Unsichtbarer Trefferradius der Griffe (px), damit Finger und Stift sie sicher treffen */
const HIT_R = 24

/**
 * Flugbahnen in der Draufsicht: immer eine Gerade von Start bis Schlagpunkt mit Pfeil,
 * optional der weitere Verlauf bis zum Boden gestrichelt. Griffe an Start und Ende verschieben die Bahn.
 */
export function TrajectoryLayer({
  vp,
  interactive,
  preview,
  showBall = true
}: {
  vp: TopViewport
  interactive: boolean
  showBall?: boolean
  preview: { a: { x: number; y: number }; b: { x: number; y: number } } | null
}) {
  const visible = useVisibleTrajectories()
  // „Nur Ball“ beim Abspielen: Linien, Beschriftungen und Griffe ausblenden
  const hidden = usePathsHidden()
  const list = hidden ? [] : visible
  const display = usePlay((s) => s.display)
  const schlagInput = usePlay((s) => (s.display.showSchlag && !hidden ? s.schlag : null))
  const coupledSchlag = usePlay((s) => !!s.trajectories.zuspiel)
  const setSchlag = usePlay((s) => s.setSchlag)
  const selected = usePlay((s) => s.selected)
  const select = usePlay((s) => s.select)
  const setTrajectory = usePlay((s) => s.setTrajectory)
  const ball = useBall()
  const P = (x: number, y: number) => {
    const p = worldToTop(vp, x, y)
    return [p.px, p.py]
  }

  const drag = (tv: TrajectoryView, which: 'start' | 'end') => (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const w = topToWorld(vp, node.x(), node.y())
    const c = clampToArea(w.x, w.y)
    const t = usePlay.getState().trajectories[tv.type]
    if (!t) return
    if (which === 'start') setTrajectory(tv.type, { ...t, start: { ...t.start, x: c.x, y: c.y } })
    else setTrajectory(tv.type, { ...t, end: { x: c.x, y: c.y } })
    const px = worldToTop(vp, c.x, c.y)
    node.position({ x: px.px, y: px.py })
  }

  return (
    <Layer listening={interactive}>
      {list.map((tv) => {
        const { input, sol, type } = tv
        const isSel = selected === type
        const width = isSel ? 4 : 3
        const opacity = type === 'annahme' ? 0.8 : 1
        const ground = pointAt(sol, input.start, sol.sGround)
        const mid = worldToTop(vp, (input.start.x + input.end.x) / 2, (input.start.y + input.end.y) / 2)
        return (
          <Group key={type} opacity={opacity}>
            {display.showAfterHit && (
              <Line
                points={[...P(input.end.x, input.end.y), ...P(ground.x, ground.y)]}
                stroke={COLORS.trajectory}
                strokeWidth={2}
                dash={[8, 6]}
                // Muster am Start verankert, damit die Striche beim Verschieben des Schlagpunkts stehen bleiben
                dashOffset={Math.hypot(P(input.end.x, input.end.y)[0] - P(input.start.x, input.start.y)[0], P(input.end.x, input.end.y)[1] - P(input.start.x, input.start.y)[1])}
                opacity={0.45}
                listening={false}
              />
            )}
            <Arrow
              points={[...P(input.start.x, input.start.y), ...P(input.end.x, input.end.y)]}
              stroke={COLORS.trajectory}
              fill={COLORS.trajectory}
              strokeWidth={width}
              pointerLength={12}
              pointerWidth={12}
              hitStrokeWidth={22}
              lineCap="round"
              shadowColor="#000"
              shadowBlur={isSel ? 10 : 4}
              shadowOpacity={0.6}
              onClick={() => select(type)}
              onTap={() => select(type)}
            />
            <Text
              x={mid.px - 40}
              y={mid.py - 22}
              width={80}
              align="center"
              text={TRAJECTORY_LABELS[type]}
              fontSize={12}
              fontStyle="bold"
              fill={COLORS.trajectory}
              listening={false}
            />
          </Group>
        )
      })}
      {schlagInput && (() => {
        // Schlag: Bahn aus der Simulation (mit Seitendrall gebogen), Pfeil zum Ziel
        const sol = solveAttack(schlagInput)
        const pts = attackPoints(sol, 0, sol.tHit, 48).flatMap((p) => P(p.x, p.y))
        const isSel = selected === 'schlag'
        const mid = attackPoints(sol, sol.tHit / 2, sol.tHit / 2, 1)[0]
        const midPx = worldToTop(vp, mid.x, mid.y)
        return (
          <Group>
            {display.showAfterHit && sol.tGround > sol.tHit + 0.01 && (
              <Line points={attackPoints(sol, sol.tHit, sol.tGround, 16).flatMap((p) => P(p.x, p.y))} stroke={COLORS.trajectory} strokeWidth={2} dash={[8, 6]} opacity={0.45} listening={false} />
            )}
            <Arrow
              points={pts}
              stroke={COLORS.trajectory}
              fill={COLORS.trajectory}
              strokeWidth={isSel ? 4 : 3}
              pointerLength={12}
              pointerWidth={12}
              hitStrokeWidth={22}
              lineCap="round"
              lineJoin="round"
              shadowColor="#000"
              shadowBlur={isSel ? 10 : 4}
              shadowOpacity={0.6}
              onClick={() => select('schlag')}
              onTap={() => select('schlag')}
            />
            {!sol.reachable && (
              // Ziel nicht erreichbar: geplantes Ziel als Kreuz, der Ball landet woanders
              <Text x={P(schlagInput.end.x, schlagInput.end.y)[0] - 6} y={P(schlagInput.end.x, schlagInput.end.y)[1] - 9} text="×" fontSize={18} fontStyle="bold" fill={COLORS.trajectory} listening={false} />
            )}
            <Text x={midPx.px - 40} y={midPx.py - 22} width={80} align="center" text="Schlag" fontSize={12} fontStyle="bold" fill={COLORS.trajectory} listening={false} />
          </Group>
        )
      })()}
      {interactive && schlagInput && (
        <Group>
          {!coupledSchlag && (
            <Handle
              {...xy(vp, schlagInput.start.x, schlagInput.start.y)}
              hollow
              onPick={() => select('schlag')}
              onDrag={(e) => {
                const w = topToWorld(vp, e.target.x(), e.target.y())
                const c = clampToArea(w.x, w.y)
                const s = usePlay.getState().schlag
                if (s) setSchlag({ ...s, start: { ...s.start, x: c.x, y: c.y } })
                e.target.position(xy(vp, c.x, c.y))
              }}
            />
          )}
          <Handle
            {...xy(vp, schlagInput.end.x, schlagInput.end.y)}
            onPick={() => select('schlag')}
            onDrag={(e) => {
              const w = topToWorld(vp, e.target.x(), e.target.y())
              const c = clampToArea(w.x, w.y)
              const s = usePlay.getState().schlag
              if (s) setSchlag({ ...s, end: { x: c.x, y: c.y } })
              e.target.position(xy(vp, c.x, c.y))
            }}
          />
        </Group>
      )}
      {/* Griffe über allen Linien (das Ende der Annahme liegt unter dem Start des Zuspiels) */}
      {interactive &&
        list.map((tv) => (
          <Group key={`h-${tv.type}`}>
            {!tv.coupled && (
              <Handle {...xy(vp, tv.input.start.x, tv.input.start.y)} onDrag={drag(tv, 'start')} onPick={() => select(tv.type)} hollow />
            )}
            <Handle {...xy(vp, tv.input.end.x, tv.input.end.y)} onDrag={drag(tv, 'end')} onPick={() => select(tv.type)} />
          </Group>
        ))}
      {preview && (
        <Arrow
          points={[...P(preview.a.x, preview.a.y), ...P(preview.b.x, preview.b.y)]}
          stroke={COLORS.trajectory}
          fill={COLORS.trajectory}
          strokeWidth={3}
          dash={[10, 6]}
          pointerLength={12}
          pointerWidth={12}
          opacity={0.8}
          listening={false}
        />
      )}
      {showBall && ball && <Ball {...xy(vp, ball.x, ball.y)} r={Math.max(6, BALL_RADIUS * vp.scale)} />}
    </Layer>
  )
}

const xy = (vp: TopViewport, x: number, y: number) => {
  const p = worldToTop(vp, x, y)
  return { x: p.px, y: p.py }
}

export function Ball({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <Circle x={x} y={y} radius={r} fill={BALL_COLORS.yellow} stroke={BALL_COLORS.blue} strokeWidth={2.5} shadowColor="#000" shadowBlur={6} shadowOpacity={0.6} listening={false} />
  )
}

/** Ziehbarer Griff: sichtbarer Punkt mit großer, unsichtbarer Trefferfläche */
export function Handle({
  x,
  y,
  onDrag,
  onPick,
  hollow = false,
  diamond = false,
  draggable = true
}: {
  x: number
  y: number
  onDrag: (e: Konva.KonvaEventObject<DragEvent>) => void
  onPick?: () => void
  hollow?: boolean
  /** Raute statt Kreis (Scheitel) */
  diamond?: boolean
  draggable?: boolean
}) {
  return (
    <Group
      name={HANDLE_NODE_NAME}
      x={x}
      y={y}
      draggable={draggable}
      dragDistance={2}
      onDragStart={onPick}
      onDragMove={onDrag}
      onDragEnd={onDrag}
      onPointerDown={onPick}
      onMouseEnter={(e) => setCursor(e, 'grab')}
      onMouseLeave={(e) => setCursor(e, '')}
    >
      <Circle radius={HIT_R} fill="rgba(0,0,0,0.001)" />
      {diamond ? (
        <Rect
          x={0}
          y={0}
          width={14}
          height={14}
          offsetX={7}
          offsetY={7}
          rotation={45}
          fill={COLORS.bgDeep}
          stroke={COLORS.trajectory}
          strokeWidth={3}
          shadowColor="#000"
          shadowBlur={6}
          shadowOpacity={0.7}
        />
      ) : (
      <Circle
        radius={8}
        fill={hollow ? COLORS.bgDeep : COLORS.trajectory}
        stroke={COLORS.trajectory}
        strokeWidth={3}
        shadowColor="#000"
        shadowBlur={6}
        shadowOpacity={0.7}
      />
      )}
    </Group>
  )
}

function setCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
  const container = e.target.getStage()?.container()
  if (container) container.style.cursor = cursor
}
