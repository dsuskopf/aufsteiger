import { SKETCH_LIMITS, type SketchStroke } from '@shared/types'

/** Abstand eines Punkts zur Strecke a–b */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const k = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + k * dx), py - (ay + k * dy))
}

/**
 * Strich ausdünnen (Ramer-Douglas-Peucker, ohne Rekursion): Punkte, die weniger als eps von der Linie
 * ihrer Nachbarn abweichen, fallen weg. Die Form bleibt, die Datei wird klein. Punkte als flache Liste x, y, …
 */
export function simplifyStroke(points: number[], eps: number): number[] {
  const n = points.length >> 1
  if (n <= 2) return points.slice(0, n * 2)
  const keep = new Uint8Array(n)
  keep[0] = keep[n - 1] = 1
  const stack: [number, number][] = [[0, n - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    let worst = -1
    let worstD = eps
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment(points[2 * i], points[2 * i + 1], points[2 * a], points[2 * a + 1], points[2 * b], points[2 * b + 1])
      if (d > worstD) {
        worstD = d
        worst = i
      }
    }
    if (worst > 0) {
      keep[worst] = 1
      stack.push([a, worst], [worst, b])
    }
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[2 * i], points[2 * i + 1])
  return out
}

/** Fertiger Strich zum Speichern: ausgedünnt, auf Zentimeter gerundet, höchstens SKETCH_LIMITS.points Punkte */
export function finishStroke(points: number[], eps = 0.015): number[] {
  let out = simplifyStroke(points, eps)
  // Sehr lange Striche gröber ausdünnen statt abschneiden
  for (let e = eps * 2; out.length > SKETCH_LIMITS.points * 2 && e < 1; e *= 2) out = simplifyStroke(points, e)
  return out.slice(0, SKETCH_LIMITS.points * 2).map((v) => Math.round(v * 100) / 100)
}

/** Trifft der Radierer (Kreis um x, y) den Strich? Die Strichbreite zählt mit. */
export function hitsStroke(stroke: SketchStroke, x: number, y: number, radius: number): boolean {
  const p = stroke.points
  const reach = radius + stroke.width / 2
  if (p.length === 2) return Math.hypot(p[0] - x, p[1] - y) <= reach
  for (let i = 0; i + 3 < p.length; i += 2) if (distToSegment(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= reach) return true
  return false
}
