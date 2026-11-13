import * as THREE from 'three'
import { BALL_RADIUS, sampleTrajectory } from '@renderer/core/physics/trajectory'
import { worldToThree } from '@renderer/core/geometry/transform'
import { segmentPosition, type Timeline } from '@renderer/core/timeline/timeline'
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

/**
 * Flugbahnen als Röhren in der Standardfarbe (bis zum Schlagpunkt bzw. Ziel).
 * opacity (0,1–1) macht sie durchscheinend, damit Spieler und Ball dahinter sichtbar bleiben (Einstellung).
 */
export function buildTrajectories(list: TrajectoryView[], selected: string | null, schlag?: AttackInput | null, opacity = 1): THREE.Group {
  const g = new THREE.Group()
  g.name = 'trajectories'
  const mat = (base = 1) => {
    const o = Math.min(1, Math.max(0.05, base * opacity))
    return new THREE.MeshBasicMaterial({ color: COLORS.trajectory, transparent: o < 1, opacity: o, depthWrite: o >= 1 })
  }
  /**
   * Röhre als zwei Meshes: noch zu fliegender Teil (normal) und schon geflogener Teil (blass).
   * Welcher Abschnitt jeweils gezeichnet wird, setzt updateTrajectoryProgress() über drawRange.
   */
  const tube = (type: BallType, points: { x: number; y: number; z: number }[], radius: number, base = 1) => {
    const geo = new THREE.TubeGeometry(curve(points), TUBULAR, radius, RADIAL, false)
    const future = new THREE.Mesh(geo, mat(base))
    const past = new THREE.Mesh(geo.clone(), mat(base * PAST_FACTOR))
    past.name = 'past'
    past.geometry.setDrawRange(0, 0)
    past.visible = false
    const holder = new THREE.Group()
    holder.name = 'tube'
    const cum = [0]
    for (let i = 1; i < points.length; i++)
      cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y, points[i].z - points[i - 1].z))
    holder.userData = { type, points, cum, future, past }
    holder.add(future, past)
    return holder
  }
  if (schlag) {
    // Schlag: Bahn aus der Simulation (Drall biegt sie), Zielpunkt als Kugel
    const sol = solveAttack(schlag)
    const isSel = selected === 'schlag'
    g.add(tube('schlag', attackPoints(sol, 0, sol.tHit, 64), isSel ? 0.035 : 0.025))
    const end = attackPoints(sol, sol.tHit, sol.tHit, 1)[0]
    const mark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), mat())
    mark.position.set(...worldToThree(end.x, end.y, Math.max(0.06, end.z)))
    g.add(mark)
  }
  for (const tv of list) {
    const { sol, input } = tv
    const isSel = selected === tv.type
    g.add(tube(tv.type, sampleTrajectory(sol, input.start, 0, sol.D, 64), isSel ? 0.035 : 0.025, tv.type === 'annahme' ? 0.8 : 1))
    // Schlagpunkt-Markierung und Bodenschatten der Geraden (Draufsicht-Linie)
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), mat())
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

const TUBULAR = 96
const RADIAL = 10
/** Deckkraft des schon geflogenen Teils relativ zur Bahn */
const PAST_FACTOR = 0.25
/** Lücke in der Bahn rund um den Ball (m), damit die Linie ihn nicht berührt */
const BALL_GAP = 0.22

/**
 * Während der Wiedergabe: Der schon geflogene Teil jeder Bahn wird blass, um den Ball bleibt eine kleine Lücke.
 * Am Anfang (t = 0) und am Ende sind alle Bahnen wieder normal.
 */
export function updateTrajectoryProgress(group: THREE.Object3D | null, tl: Timeline<BallType | 'abprall'>, t: number, total: number): void {
  if (!group) return
  const running = t > 1e-6 && t < total - 1e-6
  const idx = RADIAL * 6
  for (const holder of group.children) {
    if (holder.name !== 'tube') continue
    const { type, points, cum, future, past } = holder.userData as {
      type: BallType
      points: { x: number; y: number; z: number }[]
      cum: number[]
      future: THREE.Mesh
      past: THREE.Mesh
    }
    const total = cum[cum.length - 1] || 1
    const seg = tl.segments.find((s) => s.type === type)
    let f0 = 0 // Ende des blassen Teils (Anteil)
    let f1 = 0 // Beginn des normalen Teils
    if (running && seg) {
      if (t >= seg.t1) f0 = f1 = 1
      else if (t > seg.t0) {
        const p = segmentPosition(seg, t - seg.t0)
        const a = arcAt(points, cum, p)
        f0 = Math.max(0, (a - BALL_GAP) / total)
        f1 = Math.min(1, (a + BALL_GAP) / total)
      }
    }
    const k0 = Math.floor(f0 * TUBULAR)
    const k1 = Math.ceil(f1 * TUBULAR)
    past.visible = k0 > 0
    past.geometry.setDrawRange(0, k0 * idx)
    future.visible = k1 < TUBULAR
    future.geometry.setDrawRange(k1 * idx, Math.max(0, (TUBULAR - k1) * idx))
  }
}

/** Bogenlänge des Punkts auf dem Linienzug, der p am nächsten liegt */
function arcAt(points: { x: number; y: number; z: number }[], cum: number[], p: { x: number; y: number; z: number }): number {
  let best = 0
  let bestD = Infinity
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dz = b.z - a.z
    const l2 = dx * dx + dy * dy + dz * dz || 1e-12
    const u = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / l2))
    const d = (a.x + dx * u - p.x) ** 2 + (a.y + dy * u - p.y) ** 2 + (a.z + dz * u - p.z) ** 2
    if (d < bestD) {
      bestD = d
      best = cum[i - 1] + (cum[i] - cum[i - 1]) * u
    }
  }
  return best
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
export function ballOrientation(tl: Timeline<BallType | 'abprall'>, t: number, out = new THREE.Quaternion()): THREE.Quaternion {
  out.identity()
  for (const seg of tl.segments) {
    if (t <= seg.t0) break
    const local = Math.min(t, seg.t1) - seg.t0
    // Abprall: keine eigene Drehung (der Ball behält die Lage nach dem Schlag)
    if (seg.track) continue
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
