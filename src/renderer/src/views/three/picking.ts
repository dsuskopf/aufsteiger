import * as THREE from 'three'
import type { Attack, BallType, CourtSide, Trajectory, TrajectoryType } from '@shared/types'
import { threeToWorld, worldToThree } from '@renderer/core/geometry/transform'
import { clampToArea } from '@renderer/core/lineup/lineup'
import { startsAtPlayer } from '@renderer/core/motion/couple'
import { segmentPosition, type Timeline } from '@renderer/core/timeline/timeline'
import { usePlay } from '@renderer/store/playStore'
import { COLORS } from '@renderer/theme/colors'

/**
 * Anklicken und Ziehen in der 3D-Ansicht: Spieler, Flugbahnen und ihre Griffe (Start und Ziel), Laufweg-Enden.
 * Jedes anklickbare Objekt trägt in userData.pick, was es ist. Gezogen wird auf einer waagerechten Ebene in der
 * Höhe des Objekts (Spieler am Boden, Griffe in ihrer Höhe) – so bleibt das Objekt unter dem Finger.
 */
export type Pick =
  | { kind: 'player'; side: CourtSide; playerId: string }
  | { kind: 'flight'; type: BallType }
  | { kind: 'handle'; type: BallType; which: 'start' | 'end'; x: number; y: number; h: number }
  | { kind: 'pathEnd'; side: CourtSide; playerId: string; x: number; y: number }

/** Lässt sich das Objekt ziehen? (Flugbahnen selbst nur antippen) */
export const draggable = (p: Pick) => p.kind !== 'flight'

const ghost = new THREE.MeshBasicMaterial({ visible: false })

/** Darf der Start dieses Ballwegs frei verschoben werden? (Nicht, wenn er an einem Spieler oder am vorigen Ballweg hängt) */
function startMovable(type: BallType): boolean {
  const s = usePlay.getState()
  if (startsAtPlayer(type, s, s.contacts, s.sides)) return false
  if (type === 'zuspiel') return !s.trajectories.annahme
  if (type === 'schlag') return !s.trajectories.zuspiel
  return true
}

/**
 * Trefferflächen der Ballwege: unsichtbare, dicke Röhren entlang der Bahn (antippen wählt sie) und Griffe an Start
 * und Ziel (ziehen verschiebt sie). Die Griffe des gewählten Ballwegs sind sichtbar.
 */
export function buildPickables(timeline: Timeline<string>, flights: { type: BallType; start: { x: number; y: number; h: number }; end: { x: number; y: number }; endH: number }[], selected: string | null): THREE.Group {
  const g = new THREE.Group()
  g.name = 'pickables'
  const handleGeo = new THREE.SphereGeometry(1, 16, 12)
  for (const f of flights) {
    const seg = timeline.segments.find((s) => s.type === f.type)
    if (seg) {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 24; i++) {
        const p = segmentPosition(seg, ((seg.t1 - seg.t0) * i) / 24)
        pts.push(new THREE.Vector3(...worldToThree(p.x, p.y, p.z)))
      }
      const fat = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.14, 6, false), ghost)
      fat.userData.pick = { kind: 'flight', type: f.type } satisfies Pick
      g.add(fat)
    }
    const isSel = selected === f.type
    const handle = (which: 'start' | 'end', x: number, y: number, h: number) => {
      const pick: Pick = { kind: 'handle', type: f.type, which, x, y, h }
      // Große, unsichtbare Trefferfläche – mit Finger und Stift gut zu treffen
      const hit = new THREE.Mesh(handleGeo, ghost)
      hit.scale.setScalar(0.28)
      hit.position.set(...worldToThree(x, y, h))
      hit.userData.pick = pick
      g.add(hit)
      if (!isSel) return
      // Sichtbar beim gewählten Ballweg: Ziel voll, Start hohl (wie in der Draufsicht)
      const dot = new THREE.Mesh(handleGeo, new THREE.MeshBasicMaterial({ color: which === 'end' ? COLORS.trajectory : COLORS.bgDeep, depthTest: false, transparent: true }))
      dot.scale.setScalar(0.085)
      dot.position.copy(hit.position)
      dot.renderOrder = 6
      g.add(dot)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 32), new THREE.MeshBasicMaterial({ color: COLORS.trajectory, depthTest: false, transparent: true }))
      ring.position.copy(hit.position)
      ring.userData.billboard = true
      ring.renderOrder = 7
      g.add(ring)
    }
    if (startMovable(f.type)) handle('start', f.start.x, f.start.y, f.start.h)
    handle('end', f.end.x, f.end.y, f.endH)
  }
  return g
}

/** Ringe der Griffe zur Kamera drehen (sie sollen von jeder Seite rund aussehen) */
export function faceCamera(g: THREE.Object3D | null, camera: THREE.Camera): void {
  g?.traverse((o) => {
    if (o.userData.billboard) o.quaternion.copy(camera.quaternion)
  })
}

const RANK: Record<Pick['kind'], number> = { handle: 0, pathEnd: 1, player: 2, flight: 3 }

/** Was liegt unter dem Zeiger? Griffe vor Laufweg-Enden vor Spielern vor Flugbahnen, sonst das Nächste. */
export function pickAt(raycaster: THREE.Raycaster, layers: (THREE.Object3D | null)[]): { pick: Pick; point: THREE.Vector3 } | null {
  let best: { pick: Pick; point: THREE.Vector3; rank: number; dist: number } | null = null
  for (const layer of layers) {
    if (!layer || !layer.visible) continue
    for (const h of raycaster.intersectObject(layer, true)) {
      let o: THREE.Object3D | null = h.object
      while (o && !o.userData.pick) o = o.parent
      if (!o) continue
      const pick = o.userData.pick as Pick
      const rank = RANK[pick.kind]
      if (!best || rank < best.rank || (rank === best.rank && h.distance < best.dist)) best = { pick, point: h.point, rank, dist: h.distance }
    }
  }
  return best && { pick: best.pick, point: best.point }
}

const _plane = new THREE.Plane()
const _up = new THREE.Vector3(0, 1, 0)
const _hit = new THREE.Vector3()

/** Punkt (Welt x, y) auf der waagerechten Ebene in Höhe h unter dem Zeiger; null, wenn der Strahl sie nicht trifft */
export function groundPoint(raycaster: THREE.Raycaster, h: number): { x: number; y: number } | null {
  _plane.set(_up, -h)
  const p = raycaster.ray.intersectPlane(_plane, _hit)
  if (!p) return null
  const w = threeToWorld(p.x, p.y, p.z)
  return { x: w.x, y: w.y }
}

/** Höhe, auf der gezogen wird, und Lage des Objekts beim Greifen */
export function dragAnchor(pick: Pick): { h: number; x: number; y: number } | null {
  const s = usePlay.getState()
  if (pick.kind === 'handle') return { h: pick.h, x: pick.x, y: pick.y }
  if (pick.kind === 'pathEnd') return { h: 0, x: pick.x, y: pick.y }
  if (pick.kind === 'player') {
    const c = s.sides[pick.side].players.find((p) => p.playerId === pick.playerId)
    return c ? { h: 0, x: c.x, y: c.y } : null
  }
  return null
}

/** Gezogenes Objekt an die neue Stelle (Welt x, y) setzen */
export function applyDrag(pick: Pick, x: number, y: number): void {
  const play = usePlay.getState()
  const c = clampToArea(x, y)
  if (pick.kind === 'player') return play.movePlayer(pick.side, pick.playerId, c.x, c.y)
  if (pick.kind === 'pathEnd') {
    const p = play.sides[pick.side].players.find((q) => q.playerId === pick.playerId)
    if (!p?.path || p.path.points.length === 0) return
    const points = [...p.path.points]
    points[points.length - 1] = c
    return play.setPath(pick.side, pick.playerId, { ...p.path, points })
  }
  if (pick.kind !== 'handle') return
  if (pick.type === 'schlag') {
    const a = play.schlag
    if (!a) return
    const next: Attack = pick.which === 'start' ? { ...a, start: { ...a.start, x: c.x, y: c.y } } : { ...a, end: { x: c.x, y: c.y } }
    return play.setSchlag(next)
  }
  const t = play.trajectories[pick.type as TrajectoryType]
  if (!t) return
  const next: Trajectory = pick.which === 'start' ? { ...t, start: { ...t.start, x: c.x, y: c.y } } : { ...t, end: { x: c.x, y: c.y } }
  play.setTrajectory(pick.type as TrajectoryType, next)
}

/** Tippen auf ein Objekt wählt es (Ballweg oder Spieler) */
export function selectPick(pick: Pick | null): void {
  const play = usePlay.getState()
  if (!pick) {
    if (play.selected) play.select(null)
    if (play.selectedPlayer) play.selectPlayer(null)
    return
  }
  if (pick.kind === 'flight' || pick.kind === 'handle') play.select(pick.type)
  else play.selectPlayer({ side: pick.side, playerId: pick.playerId })
}
