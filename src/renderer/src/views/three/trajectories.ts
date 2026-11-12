import * as THREE from 'three'
import { sampleTrajectory } from '@renderer/core/physics/trajectory'
import { worldToThree } from '@renderer/core/geometry/transform'
import { COLORS } from '@renderer/theme/colors'
import type { TrajectoryView } from '@renderer/store/selectors'

const BALL_R = 0.105

function curve(points: { x: number; y: number; z: number }[]): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...worldToThree(p.x, p.y, p.z))))
}

/** Flugbahnen als Röhren in der Standardfarbe; der Verlauf nach dem Schlagpunkt optional blass. */
export function buildTrajectories(list: TrajectoryView[], showAfterHit: boolean, selected: string | null): THREE.Group {
  const g = new THREE.Group()
  g.name = 'trajectories'
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

/** Ball mit Bodenschatten */
export function buildBall(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'ball'
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 28, 20),
    new THREE.MeshStandardMaterial({ color: '#f4efe4', emissive: COLORS.trajectory, emissiveIntensity: 0.25, roughness: 0.6 })
  )
  ball.name = 'sphere'
  g.add(ball)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(BALL_R * 1.1, 24),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.45, depthWrite: false })
  )
  shadow.name = 'shadow'
  shadow.rotation.x = -Math.PI / 2
  g.add(shadow)
  g.visible = false
  return g
}

export function placeBall(g: THREE.Group, p: { x: number; y: number; z: number } | null): void {
  g.visible = !!p
  if (!p) return
  g.getObjectByName('sphere')!.position.set(...worldToThree(p.x, p.y, p.z))
  g.getObjectByName('shadow')!.position.set(...worldToThree(p.x, p.y, 0.006))
}
