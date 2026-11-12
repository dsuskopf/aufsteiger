import type { CourtPlayer, Jump, PlaySide, RunPath, Vec2 } from '@shared/types'
import { G } from '../physics/trajectory'

/**
 * Laufwege und Sprünge der Spieler (reine Logik).
 * Ein Laufweg beginnt immer am Platz des Spielers und läuft als glatte Kurve (Catmull-Rom) durch seine Punkte.
 * Zeichnen und Animation nutzen dieselbe abgetastete Kurve; die Bewegung läuft mit gleichmäßigem Tempo
 * entlang der Bogenlänge.
 */

export const RUN_SPEED = { default: 4, min: 1, max: 8 } as const
export const JUMP_HEIGHT = { default: 0.6, min: 0.2, max: 1.1 } as const
/** Höchstens so viele Punkte pro Laufweg (nach dem Vereinfachen) */
export const MAX_PATH_POINTS = 8
const SAMPLES_PER_SEG = 16

/** Glatte Kurve durch alle Punkte (uniformes Catmull-Rom), als dichter Linienzug */
export function splinePolyline(start: Vec2, points: Vec2[]): Vec2[] {
  const P = [start, ...points]
  if (P.length < 2) return [start]
  const out: Vec2[] = [{ x: P[0].x, y: P[0].y }]
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)]
    const p1 = P[i]
    const p2 = P[i + 1]
    const p3 = P[Math.min(P.length - 1, i + 2)]
    for (let k = 1; k <= SAMPLES_PER_SEG; k++) {
      const t = k / SAMPLES_PER_SEG
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) })
    }
  }
  return out
}

/** Kumulierte Bogenlänge eines Linienzugs */
export function arcLengths(poly: Vec2[]): number[] {
  const L = [0]
  for (let i = 1; i < poly.length; i++) L.push(L[i - 1] + Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y))
  return L
}

/** Punkt bei Bogenlänge d (geklemmt) */
export function pointAtLength(poly: Vec2[], L: number[], d: number): Vec2 {
  if (poly.length === 1 || d <= 0) return poly[0]
  const total = L[L.length - 1]
  if (d >= total) return poly[poly.length - 1]
  let lo = 0
  let hi = L.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (L[mid] <= d) lo = mid
    else hi = mid
  }
  const seg = L[hi] - L[lo]
  const f = seg > 0 ? (d - L[lo]) / seg : 0
  return { x: poly[lo].x + (poly[hi].x - poly[lo].x) * f, y: poly[lo].y + (poly[hi].y - poly[lo].y) * f }
}

/** Kurve eines Laufwegs (Start = Platz des Spielers) mit Längentabelle – zwischengespeichert */
const cache = new WeakMap<RunPath, { key: string; poly: Vec2[]; L: number[] }>()
export function pathCurve(start: Vec2, path: RunPath): { poly: Vec2[]; L: number[]; length: number } {
  const key = `${start.x}|${start.y}`
  let c = cache.get(path)
  if (!c || c.key !== key) {
    const poly = splinePolyline(start, path.points)
    c = { key, poly, L: arcLengths(poly) }
    cache.set(path, c)
  }
  return { poly: c.poly, L: c.L, length: c.L[c.L.length - 1] }
}

/** Ende des Laufwegs in Sekunden (Verzögerung + Länge / Tempo) */
export function pathEnd(start: Vec2, path: RunPath): number {
  return path.delay + pathCurve(start, path).length / Math.max(0.1, path.speed)
}

/** Flugzeit eines Sprungs mit Steighöhe h (s) */
export const jumpAirtime = (h: number) => 2 * Math.sqrt((2 * h) / G)
/** Zeit vom Absprung bis zum höchsten Punkt */
export const jumpRise = (h: number) => Math.sqrt((2 * h) / G)

/** Höhe der Füße über dem Boden zur Zeit t (senkrechter Wurf) */
export function jumpZ(jump: Jump | undefined, t: number): number {
  if (!jump) return 0
  const dt = t - jump.at
  const T = jumpAirtime(jump.height)
  if (dt <= 0 || dt >= T) return 0
  const v0 = Math.sqrt(2 * G * jump.height)
  return Math.max(0, v0 * dt - 0.5 * G * dt * dt)
}

/** Position eines Spielers zur Zeit t (am Boden: x, y; z = Sprunghöhe) */
export function playerAt(c: CourtPlayer, t: number): { x: number; y: number; z: number } {
  let p: Vec2 = c
  if (c.path && c.path.points.length > 0) {
    const curve = pathCurve(c, c.path)
    const d = Math.max(0, t - c.path.delay) * c.path.speed
    p = pointAtLength(curve.poly, curve.L, d)
  }
  return { x: p.x, y: p.y, z: jumpZ(c.jump, t) }
}

/** Dauer aller Bewegungen (Laufwege und Sprünge) beider Seiten */
export function motionDuration(sides: PlaySide[]): number {
  let end = 0
  for (const s of sides)
    for (const c of s.players) {
      if (c.path && c.path.points.length > 0) end = Math.max(end, pathEnd(c, c.path))
      if (c.jump) end = Math.max(end, c.jump.at + jumpAirtime(c.jump.height))
    }
  return end
}

/** Linienzug vereinfachen (Ramer-Douglas-Peucker), Toleranz in Metern */
export function simplify(points: Vec2[], eps: number): Vec2[] {
  if (points.length <= 2) return points
  const a = points[0]
  const b = points[points.length - 1]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1e-9
  let maxD = -1
  let idx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = Math.abs(dy * (points[i].x - a.x) - dx * (points[i].y - a.y)) / len
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD <= eps) return [a, b]
  const left = simplify(points.slice(0, idx + 1), eps)
  const right = simplify(points.slice(idx), eps)
  return [...left.slice(0, -1), ...right]
}

/**
 * Freihand-Strich → Laufweg-Punkte (ohne Start): vereinfachen, bis höchstens MAX_PATH_POINTS übrig sind.
 * Gibt null zurück, wenn der Strich zu kurz ist.
 */
export function strokeToPath(stroke: Vec2[]): Vec2[] | null {
  if (stroke.length < 2) return null
  const total = arcLengths(stroke)
  if (total[total.length - 1] < 0.5) return null
  let eps = 0.12
  let pts = simplify(stroke, eps)
  while (pts.length - 1 > MAX_PATH_POINTS && eps < 3) {
    eps *= 1.5
    pts = simplify(stroke, eps)
  }
  return pts.slice(1).map((p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 }))
}
