/**
 * Flugbahn-Physik (reine Logik, keine UI-Abhängigkeiten).
 *
 * Eine Flugbahn ist in der Draufsicht eine Gerade von start (x, y) nach end (x, y) – end ist der Schlagpunkt.
 * Im Profil (s = Distanz entlang der Geraden, z = Höhe) ist sie eine Wurfparabel ohne Luftwiderstand:
 *   z(s) = apexH − k · (s − sA)²
 * Sie geht durch (0, h0) und (D, h1); der Scheitel liegt dazwischen, der Schlagpunkt auf dem fallenden Ast.
 * Geschwindigkeit und Flugdauer folgen aus g = 9,81 m/s².
 */

export const G = 9.81
/** Scheitel mindestens so weit über Start und Schlagpunkt (m) – sonst wäre die Bahn eine Gerade (unendlich schnell). */
export const APEX_EPS = 0.05
/** Kürzeste Flugbahn (m); darunter gilt die Eingabe als Klick */
export const MIN_DIST = 0.2
export const START_H_MAX = 6
export const APEX_H_MAX = 15

export interface TrajectoryInput {
  start: { x: number; y: number; h: number }
  /** Schlagpunkt in der Draufsicht */
  end: { x: number; y: number }
  /** Absolute Scheitelhöhe */
  apexH: number
  /** Höhe des Schlagpunkts */
  hitH: number
}

export interface SolvedTrajectory {
  /** Distanz Start → Schlagpunkt (Draufsicht) */
  D: number
  /** Einheitsvektor Start → Schlagpunkt */
  dir: { dx: number; dy: number }
  h0: number
  h1: number
  apexH: number
  /** Parabelkonstante */
  k: number
  /** Distanz des Scheitels vom Start */
  sA: number
  /** Distanz, bei der der Ball den Boden erreicht */
  sGround: number
  /** Horizontale Geschwindigkeit (m/s) */
  vH: number
  /** Vertikale Startgeschwindigkeit (m/s) */
  vZ0: number
  /** Flugdauer bis zum Schlagpunkt (s) */
  tHit: number
  /** Flugdauer bis zum Bodenaufprall (s) */
  tGround: number
}

/** Klemmt die Eingabe auf physikalisch mögliche Werte (Scheitel über Start und Schlagpunkt, Höhen ≥ 0). */
export function clampInput(t: TrajectoryInput): TrajectoryInput {
  const h0 = Math.min(START_H_MAX, Math.max(0, t.start.h))
  const hitH = Math.max(0, t.hitH)
  const minApex = Math.max(h0, hitH) + APEX_EPS
  const apexH = Math.min(Math.max(APEX_H_MAX, minApex), Math.max(minApex, Number.isFinite(t.apexH) ? t.apexH : minApex))
  return { start: { ...t.start, h: h0 }, end: { ...t.end }, apexH, hitH }
}

/** Löst die Parabel aus Start, Scheitelhöhe und Schlagpunkt. */
export function solveTrajectory(input: TrajectoryInput): SolvedTrajectory {
  const t = clampInput(input)
  const ex = t.end.x - t.start.x
  const ey = t.end.y - t.start.y
  const rawD = Math.hypot(ex, ey)
  const D = Math.max(MIN_DIST, rawD)
  const dir = rawD > 1e-9 ? { dx: ex / rawD, dy: ey / rawD } : { dx: 1, dy: 0 }
  const h0 = t.start.h
  const h1 = t.hitH
  const apexH = t.apexH
  const a0 = Math.sqrt(apexH - h0)
  const a1 = Math.sqrt(apexH - h1)
  const k = ((a0 + a1) / D) ** 2
  const sA = a0 / Math.sqrt(k)
  const sGround = sA + Math.sqrt(apexH / k)
  const vH = Math.sqrt(G / (2 * k))
  const vZ0 = Math.sqrt(2 * G * (apexH - h0))
  return { D, dir, h0, h1, apexH, k, sA, sGround, vH, vZ0, tHit: D / vH, tGround: sGround / vH }
}

/** Höhe bei Distanz s */
export function heightAt(sol: SolvedTrajectory, s: number): number {
  return sol.apexH - sol.k * (s - sol.sA) ** 2
}

/** Ballposition (Welt) zur Zeit t seit dem Abwurf; über tGround hinaus bleibt er am Boden. */
export function positionAt(
  sol: SolvedTrajectory,
  start: { x: number; y: number },
  t: number
): { x: number; y: number; z: number } {
  const s = Math.min(sol.sGround, Math.max(0, t * sol.vH))
  return { x: start.x + sol.dir.dx * s, y: start.y + sol.dir.dy * s, z: Math.max(0, heightAt(sol, s)) }
}

/** Punkt auf der Bahn bei Distanz s (Welt) */
export function pointAt(sol: SolvedTrajectory, start: { x: number; y: number }, s: number) {
  return { x: start.x + sol.dir.dx * s, y: start.y + sol.dir.dy * s, z: Math.max(0, heightAt(sol, s)) }
}

/** Abtastpunkte der Bahn von s0 bis s1 */
export function sampleTrajectory(
  sol: SolvedTrajectory,
  start: { x: number; y: number },
  s0: number,
  s1: number,
  n = 48
): { x: number; y: number; z: number }[] {
  const out = []
  for (let i = 0; i <= n; i++) out.push(pointAt(sol, start, s0 + ((s1 - s0) * i) / n))
  return out
}

/** Kleinste erlaubte Schlagpunkt-Distanz (knapp hinter dem Scheitel) */
export function minHitDist(sol: SolvedTrajectory): number {
  return sol.sA + Math.sqrt(APEX_EPS / sol.k)
}

/**
 * Schlagpunkt entlang der (festen) Parabel verschieben: neue Distanz s wird auf den fallenden Ast geklemmt.
 * Gibt die neue Eingabe zurück (Ende wandert in gleicher Richtung, Höhe = z(s)).
 */
export function moveHitAlongParabola(input: TrajectoryInput, s: number): TrajectoryInput {
  const sol = solveTrajectory(input)
  const sc = Math.min(sol.sGround, Math.max(minHitDist(sol), MIN_DIST, s))
  return {
    start: { ...input.start },
    end: { x: input.start.x + sol.dir.dx * sc, y: input.start.y + sol.dir.dy * sc },
    apexH: sol.apexH,
    hitH: Math.max(0, heightAt(sol, sc))
  }
}

/**
 * Projiziert einen Bildschirmpunkt auf den fallenden Ast: sucht die Distanz s, deren projizierter Punkt
 * dem Zeiger am nächsten liegt. `project` bildet Weltpunkte auf Bildschirm-Pixel ab.
 */
export function projectToFallingBranch(
  sol: SolvedTrajectory,
  start: { x: number; y: number },
  project: (p: { x: number; y: number; z: number }) => { px: number; py: number },
  px: number,
  py: number
): number {
  const lo = Math.max(MIN_DIST, minHitDist(sol))
  const hi = sol.sGround
  if (hi <= lo) return lo
  const N = 200
  let best = lo
  let bestD = Infinity
  for (let i = 0; i <= N; i++) {
    const s = lo + ((hi - lo) * i) / N
    const p = project(pointAt(sol, start, s))
    const d = (p.px - px) ** 2 + (p.py - py) ** 2
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

/** Neue Flugbahn mit Standardhöhen: Scheitel = Start + Offset, mindestens 0,3 m über dem Schlagpunkt. */
export function newTrajectory(
  start: { x: number; y: number },
  end: { x: number; y: number },
  defaults: { startH: number; hitH: number; apexOffset: number }
): TrajectoryInput {
  const apexH = Math.max(defaults.startH + defaults.apexOffset, defaults.hitH + 0.3)
  return clampInput({ start: { ...start, h: defaults.startH }, end, apexH, hitH: defaults.hitH })
}

/**
 * Koppelt das Zuspiel an die Annahme: Zuspiel-Start = Schlagpunkt der Annahme (Lage und Höhe).
 * Das Zuspiel behält Ziel, Schlagpunkthöhe und Scheitel (der Scheitel wird bei Bedarf angehoben).
 */
export function coupleTrajectories<T extends { annahme?: TrajectoryInput; zuspiel?: TrajectoryInput }>(tr: T): T {
  const a = tr.annahme
  const z = tr.zuspiel
  if (!a || !z) return tr
  const start = { x: a.end.x, y: a.end.y, h: a.hitH }
  if (z.start.x === start.x && z.start.y === start.y && z.start.h === start.h) return tr
  return { ...tr, zuspiel: clampInput({ ...z, start }) }
}
