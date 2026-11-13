import * as THREE from 'three'
import { BALL_RADIUS, sampleTrajectory } from '@renderer/core/physics/trajectory'
import { worldToThree } from '@renderer/core/geometry/transform'
import type { Timeline } from '@renderer/core/timeline/timeline'
import { COLORS } from '@renderer/theme/colors'
import type { TrajectoryView } from '@renderer/store/selectors'
import type { BallType, TrajectoryType } from '@shared/types'
import { createVolleyballMesh } from './ballModel'
import { attackPoints, solveAttack, type AttackInput } from '@renderer/core/physics/attack'

/**
 * Drall in Umdrehungen pro Sekunde (Rückwärtsdrall). Eine Annahme mit den Unterarmen dreht deutlich,
 * ein sauberes Pritschen fast gar nicht. Rein optisch – die Flugbahn rechnet ohne Magnus-Effekt.
 */
const SPIN_RPS: Record<TrajectoryType, number> = { annahme: 1.4, zuspiel: 0.35 }

function curve(points: { x: number; y: number; z: number }[]): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...worldToThree(p.x, p.y, p.z))))
}

/** Flugbahnen als Röhren in der Standardfarbe; der Verlauf nach dem Schlagpunkt optional blass. */
export function buildTrajectories(list: TrajectoryView[], showAfterHit: boolean, selected: string | null, schlag?: AttackInput | null): THREE.Group {
  const g = new THREE.Group()
  g.name = 'trajectories'
  if (schlag) {
    // Schlag: Bahn aus der Simulation (Drall biegt sie), Zielpunkt als Kugel
    const sol = solveAttack(schlag)
    const isSel = selected === 'schlag'
    g.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve(attackPoints(sol, 0, sol.tHit, 64)), 96, isSel ? 0.035 : 0.025, 10, false),
        new THREE.MeshBasicMaterial({ color: COLORS.trajectory })
      )
    )
    if (showAfterHit && sol.tGround > sol.tHit + 0.01) {
      g.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(curve(attackPoints(sol, sol.tHit, sol.tGround, 24)), 32, 0.018, 8, false),
          new THREE.MeshBasicMaterial({ color: COLORS.trajectory, transparent: true, opacity: 0.3, depthWrite: false })
        )
      )
    }
    const end = attackPoints(sol, sol.tHit, sol.tHit, 1)[0]
    const mark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: COLORS.trajectory }))
    mark.position.set(...worldToThree(end.x, end.y, Math.max(0.06, end.z)))
    g.add(mark)
  }
  for (const tv of list) {
    const { sol, input } = tv
    const isSel = selected === tv.type
    const main = new THREE.Mesh(
      new THREE.TubeGeometry(curve(sampleTrajectory(sol, input.start, 0, sol.D, 64)), 96, isSel ? 0.035 : 0.025, 10, false),
      new THREE.MeshBasicMaterial({ color: COLORS.trajectory, transparent: tv.type === 'annahme', opacity: tv.type === 'annahme' ? 0.8 : 1 })
    )
    g.add(main)
    if (showAfterHit && sol.sGround > sol.D + 0.05) {
      const rest = new THREE.Mesh(
        new THREE.TubeGeometry(curve(sampleTrajectory(sol, input.start, sol.D, sol.sGround, 32)), 48, 0.018, 8, false),
        new THREE.MeshBasicMaterial({ color: COLORS.trajectory, transparent: true, opacity: 0.3, depthWrite: false })
      )
      g.add(rest)
    }
    // Schlagpunkt-Markierung und Bodenschatten der Geraden (Draufsicht-Linie)
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 12),
      new THREE.MeshBasicMaterial({ color: COLORS.trajectory })
    )
    hit.position.set(...worldToThree(input.end.x, input.end.y, input.hitH))
    g.add(hit)
    const shadow = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...worldToThree(input.start.x, input.start.y, 0.004)),
        new THREE.Vector3(...worldToThree(input.end.x, input.end.y, 0.004))
      ]),
      new THREE.LineDashedMaterial({ color: COLORS.trajectory, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.45 })
    )
    shadow.computeLineDistances()
    g.add(shadow)
  }
  return g
}

/** Ball (offizieller Durchmesser, 18 Panels) mit Bodenschatten */
export function buildBall(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'ball'
  const ball = createVolleyballMesh()
  ball.name = 'sphere'
  g.add(ball)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(BALL_RADIUS * 1.1, 24),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.45, depthWrite: false })
  )
  shadow.name = 'shadow'
  shadow.rotation.x = -Math.PI / 2
  g.add(shadow)
  g.visible = false
  return g
}

const _axis = new THREE.Vector3()
const _q = new THREE.Quaternion()

/**
 * Lage des Balls zur Zeit t: Jede Flugbahn dreht ihn um die waagrechte Achse quer zur Flugrichtung
 * (Rückwärtsdrall); die Drehungen der vorherigen Flugbahnen bleiben erhalten, so springt der Ball nie.
 */
export function ballOrientation(tl: Timeline<BallType>, t: number, out = new THREE.Quaternion()): THREE.Quaternion {
  out.identity()
  for (const seg of tl.segments) {
    if (t <= seg.t0) break
    const local = Math.min(t, seg.t1) - seg.t0
    if (seg.asol) {
      // Schlag: echter Drall (Topspin/Backspin, Seitendrall) um seine Achse
      if (seg.asol.spinRate === 0) continue
      const a = seg.asol.spinAxis
      _axis.set(...worldToThree(a.x, a.y, a.z)).normalize()
      _q.setFromAxisAngle(_axis, seg.asol.spinRate * local)
    } else {
      const { dx, dy } = seg.sol!.dir
      // Achse links der Flugrichtung; negative Drehung = Oberseite läuft nach hinten (Rückwärtsdrall)
      _axis.set(...worldToThree(-dy, dx, 0)).normalize()
      _q.setFromAxisAngle(_axis, -2 * Math.PI * SPIN_RPS[seg.type as TrajectoryType] * local)
    }
    out.premultiply(_q)
  }
  return out
}

export function placeBall(g: THREE.Group, p: { x: number; y: number; z: number } | null, orientation?: THREE.Quaternion): void {
  g.visible = !!p
  if (!p) return
  const sphere = g.getObjectByName('sphere')!
  sphere.position.set(...worldToThree(p.x, p.y, Math.max(BALL_RADIUS, p.z)))
  if (orientation) sphere.quaternion.copy(orientation)
  g.getObjectByName('shadow')!.position.set(...worldToThree(p.x, p.y, 0.006))
}
