/**
 * Schlag (Angriff): Der Ball startet am Schlagpunkt des Zuspiels mit einer gewählten Abschlaggeschwindigkeit
 * und Drall. Gesucht werden Abschlagwinkel (Höhe) und Richtung, sodass er am Ziel auf dem Boden ankommt.
 * Der höchste Punkt ergibt sich daraus.
 *
 * Finte: Der Angreifer tippt den Ball nur leicht über den Block. Vorgegeben ist die Bogenhöhe über dem
 * Schlagpunkt; Abfluggeschwindigkeit und Winkel ergeben sich (ohne Drall).
 *
 * Kräfte (3D): Schwerkraft, Luftwiderstand (quadratisch, wie bei Annahme/Zuspiel) und Magnus-Kraft durch Drall:
 *   a = −g·ẑ − K·|v|·v + K_M·(ω × v)
 * Topspin drückt den Ball nach unten (steiler, kürzer), Backspin trägt ihn, Seitendrall lenkt ihn seitlich ab.
 * Der Drall bleibt während des kurzen Flugs konstant (Achse fest im Raum, bezogen auf die Schlagrichtung).
 *
 * Lösung (Schießverfahren): Für eine Richtung wird der flachere der beiden möglichen Winkel per Bisektion so
 * gesucht, dass die Weite stimmt; danach wird die Richtung um die seitliche Abweichung korrigiert (wenige Runden).
 * Ist das Ziel mit dieser Geschwindigkeit nicht erreichbar, fliegt der Ball mit dem Winkel größter Weite (zu kurz).
 */
import { AIR_DENSITY, BALL_MASS, BALL_RADIUS, DRAG_K, G } from './trajectory'

/** Magnus-Beiwert: Auftrieb C_L ≈ r·ω/v (Spin-Parameter) → a = ½·ρ·A·r/m · (ω × v) */
export const MAGNUS_K = (0.5 * AIR_DENSITY * Math.PI * BALL_RADIUS ** 2 * BALL_RADIUS) / BALL_MASS

export const ATTACK_SPEED = { default: 70 / 3.6, min: 20 / 3.6, max: 130 / 3.6 } as const
/** Drall in Umdrehungen pro Sekunde */
export const SPIN_MAX = 10
/** Finte: Bogenhöhe über dem Schlagpunkt (m) */
export const FINTE_ARC = { default: 0.6, min: 0.1, max: 3 } as const
/** Finte: Ziel so weit hinter dem Netz, wenn man von einem harten Angriff umschaltet (m) */
export const FINTE_DEPTH = 2.5

export interface AttackInput {
  start: { x: number; y: number; h: number }
  /** Ziel in der Draufsicht */
  end: { x: number; y: number }
  /** Finte: Tipp über den Block, Bogenhöhe arc über dem Schlagpunkt */
  finte?: boolean
  arc?: number
  /** Abschlaggeschwindigkeit in m/s (nur Angriff) */
  speed: number
  /** Topspin in U/s (negativ = Backspin) */
  topspin: number
  /** Seitendrall in U/s (positiv = Rechtsdrall: rechts getroffen, der Ball kurvt nach links aus Sicht des Angreifers) */
  sidespin: number
}

export interface SolvedAttack {
  /** Abtastung vom Abschlag bis zum Boden */
  t: Float64Array
  x: Float64Array
  y: Float64Array
  z: Float64Array
  /** Zeit bis zum Ziel (Boden) */
  tHit: number
  /** Zeit bis zum Boden */
  tGround: number
  /** Index der Abtastung am Ziel */
  iHit: number
  /** Abschlagwinkel (Grad, negativ = nach unten) */
  elevation: number
  /** Höchster Punkt der Flugbahn */
  apexH: number
  /** Ziel mit dieser Geschwindigkeit erreicht? Sonst landet der Ball zu kurz bzw. zu weit */
  reachable: boolean
  /** Tatsächlicher Zielpunkt (bei nicht erreichbarem Ziel weicht er ab) */
  landing: { x: number; y: number }
  /** Drallachse (Welt, Einheitsvektor) und Winkelgeschwindigkeit (rad/s) – für die Drehung des Balls */
  spinAxis: { x: number; y: number; z: number }
  spinRate: number
  /** Richtung Start → Ziel (Draufsicht) */
  dir: { dx: number; dy: number }
  /** Abfluggeschwindigkeit (m/s) – bei der Finte berechnet */
  speed: number
}

type V3 = [number, number, number]

const STEP_LEN = 0.04
const DT_MAX = 1 / 400
const T_MAX = 6
const THETA_MIN = (-80 * Math.PI) / 180
const THETA_MAX = (75 * Math.PI) / 180

/** Drall als Vektor (rad/s) in Weltkoordinaten, bezogen auf die Richtung zum Ziel */
function spinVector(dir: { dx: number; dy: number }, topspin: number, sidespin: number): V3 {
  // links der Flugrichtung = (−dy, dx, 0); oben = (0, 0, 1)
  const wt = 2 * Math.PI * topspin
  const ws = 2 * Math.PI * sidespin
  // Rechtsdrall (rechts getroffen): die rechte Seite dreht nach vorn → Drehung gegen den Uhrzeigersinn (von oben),
  // die Magnus-Kraft ω × v zeigt nach links – der Ball kurvt nach links
  return [-dir.dy * wt, dir.dx * wt, ws]
}

function accel(v: V3, w: V3): V3 {
  const sp = Math.hypot(v[0], v[1], v[2])
  const k = DRAG_K * sp
  // ω × v
  const cx = w[1] * v[2] - w[2] * v[1]
  const cy = w[2] * v[0] - w[0] * v[2]
  const cz = w[0] * v[1] - w[1] * v[0]
  return [-k * v[0] + MAGNUS_K * cx, -k * v[1] + MAGNUS_K * cy, -G - k * v[2] + MAGNUS_K * cz]
}

interface Flight {
  /** Erste fallende Kreuzung der Zielhöhe (oder Ende) */
  hit: { x: number; y: number; t: number; i: number } | null
  apexZ: number
  t: number[]
  p: V3[]
}

/** Fliegt vom Start mit Anfangsgeschwindigkeit v0 (Vektor); zeichnet optional auf (bis zum Boden). */
function fly(s: V3, v0: V3, w: V3, endH: number, record: boolean): Flight {
  let p: V3 = [...s]
  let v: V3 = [...v0]
  let t = 0
  let apexZ = p[2]
  const ts = [0]
  const ps: V3[] = [[...p]]
  let hit: Flight['hit'] = null
  while (t < T_MAX) {
    const sp = Math.hypot(v[0], v[1], v[2])
    const dt = Math.min(DT_MAX, STEP_LEN / Math.max(sp, 1e-6))
    // RK4 für Ort und Geschwindigkeit
    const a1 = accel(v, w)
    const v2: V3 = [v[0] + (a1[0] * dt) / 2, v[1] + (a1[1] * dt) / 2, v[2] + (a1[2] * dt) / 2]
    const a2 = accel(v2, w)
    const v3: V3 = [v[0] + (a2[0] * dt) / 2, v[1] + (a2[1] * dt) / 2, v[2] + (a2[2] * dt) / 2]
    const a3 = accel(v3, w)
    const v4: V3 = [v[0] + a3[0] * dt, v[1] + a3[1] * dt, v[2] + a3[2] * dt]
    const a4 = accel(v4, w)
    const np: V3 = [
      p[0] + (dt / 6) * (v[0] + 2 * v2[0] + 2 * v3[0] + v4[0]),
      p[1] + (dt / 6) * (v[1] + 2 * v2[1] + 2 * v3[1] + v4[1]),
      p[2] + (dt / 6) * (v[2] + 2 * v2[2] + 2 * v3[2] + v4[2])
    ]
    const nv: V3 = [
      v[0] + (dt / 6) * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]),
      v[1] + (dt / 6) * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]),
      v[2] + (dt / 6) * (a1[2] + 2 * a2[2] + 2 * a3[2] + a4[2])
    ]
    const nt = t + dt
    // Zielhöhe fallend erreicht
    if (!hit && nv[2] < 0 && p[2] >= endH && np[2] < endH) {
      const f = (p[2] - endH) / (p[2] - np[2])
      hit = { x: p[0] + f * (np[0] - p[0]), y: p[1] + f * (np[1] - p[1]), t: t + f * dt, i: ts.length }
      if (!record) return { hit, apexZ, t: ts, p: ps }
    }
    if (np[2] <= 0) {
      const f = p[2] / Math.max(1e-12, p[2] - np[2])
      if (record) {
        ts.push(t + f * dt)
        ps.push([p[0] + f * (np[0] - p[0]), p[1] + f * (np[1] - p[1]), 0])
      }
      if (!hit) hit = { x: p[0] + f * (np[0] - p[0]), y: p[1] + f * (np[1] - p[1]), t: t + f * dt, i: ts.length - 1 }
      return { hit, apexZ, t: ts, p: ps }
    }
    p = np
    v = nv
    t = nt
    apexZ = Math.max(apexZ, p[2])
    if (record) {
      ts.push(t)
      ps.push([...p])
    }
  }
  return { hit, apexZ, t: ts, p: ps }
}

const velocity = (speed: number, theta: number, az: number): V3 => [
  speed * Math.cos(theta) * Math.cos(az),
  speed * Math.cos(theta) * Math.sin(az),
  speed * Math.sin(theta)
]

const cache = new Map<string, SolvedAttack>()
const CACHE_MAX = 32

/** Klemmt die Eingabe auf sinnvolle Werte */
export function clampAttack(a: AttackInput): AttackInput {
  const fin = (v: number, d: number) => (Number.isFinite(v) ? v : d)
  return {
    start: { ...a.start, h: Math.min(6, Math.max(0, fin(a.start.h, 3))) },
    end: { ...a.end },
    ...(a.finte ? { finte: true } : {}),
    ...(a.arc !== undefined ? { arc: Math.min(FINTE_ARC.max, Math.max(FINTE_ARC.min, fin(a.arc, FINTE_ARC.default))) } : {}),
    speed: Math.min(ATTACK_SPEED.max, Math.max(ATTACK_SPEED.min, fin(a.speed, ATTACK_SPEED.default))),
    topspin: Math.min(SPIN_MAX, Math.max(-SPIN_MAX, fin(a.topspin, 0))),
    sidespin: Math.min(SPIN_MAX, Math.max(-SPIN_MAX, fin(a.sidespin, 0)))
  }
}

export function solveAttack(input: AttackInput): SolvedAttack {
  const a = clampAttack(input)
  const key = JSON.stringify(a)
  const c = cache.get(key)
  if (c) return c

  const S: V3 = [a.start.x, a.start.y, a.start.h]
  const ex = a.end.x - a.start.x
  const ey = a.end.y - a.start.y
  const D = Math.max(0.3, Math.hypot(ex, ey))
  const dir = D > 1e-9 && Math.hypot(ex, ey) > 1e-9 ? { dx: ex / Math.hypot(ex, ey), dy: ey / Math.hypot(ex, ey) } : { dx: 1, dy: 0 }
  const w = a.finte ? ([0, 0, 0] as V3) : spinVector(dir, a.topspin, a.sidespin)
  const baseAz = Math.atan2(dir.dy, dir.dx)
  if (a.finte) {
    const sol = solveFinte(S, dir, D, a.arc ?? FINTE_ARC.default)
    cache.set(key, sol)
    return sol
  }

  // Weite (entlang der Zielrichtung) und seitliche Abweichung eines Versuchs
  const shoot = (theta: number, az: number) => {
    const f = fly(S, velocity(a.speed, theta, az), w, 0, false)
    if (!f.hit) return { along: -Infinity, side: 0 }
    const hx = f.hit.x - S[0]
    const hy = f.hit.y - S[1]
    return { along: hx * dir.dx + hy * dir.dy, side: -hx * dir.dy + hy * dir.dx }
  }

  let az = baseAz
  let theta = 0
  let reachable = true
  for (let round = 0; round < 4; round++) {
    // Winkel größter Weite (grob abtasten, dann fein)
    let best = THETA_MIN
    let bestR = -Infinity
    for (let th = THETA_MIN; th <= THETA_MAX + 1e-9; th += (5 * Math.PI) / 180) {
      const r = shoot(th, az).along
      if (r > bestR) {
        bestR = r
        best = th
      }
    }
    let lo = Math.max(THETA_MIN, best - (5 * Math.PI) / 180)
    let hi = Math.min(THETA_MAX, best + (5 * Math.PI) / 180)
    for (let i = 0; i < 18; i++) {
      const m1 = lo + (hi - lo) / 3
      const m2 = hi - (hi - lo) / 3
      if (shoot(m1, az).along < shoot(m2, az).along) lo = m1
      else hi = m2
    }
    const thetaMax = (lo + hi) / 2
    const maxRange = shoot(thetaMax, az).along
    const minRange = shoot(THETA_MIN, az).along
    if (D >= maxRange) {
      theta = thetaMax
      reachable = false
    } else if (D <= minRange) {
      theta = THETA_MIN
      reachable = false
    } else {
      // flachere Lösung: Weite steigt von THETA_MIN bis zum Winkel größter Weite
      let a0 = THETA_MIN
      let a1 = thetaMax
      for (let i = 0; i < 40; i++) {
        const mid = (a0 + a1) / 2
        if (shoot(mid, az).along < D) a0 = mid
        else a1 = mid
      }
      theta = (a0 + a1) / 2
      reachable = true
    }
    const side = shoot(theta, az).side
    if (Math.abs(side) < 0.005) break
    az -= Math.atan2(side, D)
  }

  const f = fly(S, velocity(a.speed, theta, az), w, 0, true)
  return finish(f, a.end, reachable, theta, w, dir, a.speed, key)
}

/** Lösung aus einem aufgezeichneten Flug zusammenstellen und zwischenspeichern */
function finish(f: Flight, end: { x: number; y: number }, reachable: boolean, theta: number, w: V3, dir: { dx: number; dy: number }, speed: number, key: string | null): SolvedAttack {
  const n = f.t.length
  const T = new Float64Array(n)
  const X = new Float64Array(n)
  const Y = new Float64Array(n)
  const Z = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    T[i] = f.t[i]
    X[i] = f.p[i][0]
    Y[i] = f.p[i][1]
    Z[i] = f.p[i][2]
  }
  const hit = f.hit ?? { x: X[n - 1], y: Y[n - 1], t: T[n - 1], i: n - 1 }
  if (reachable && Math.hypot(hit.x - end.x, hit.y - end.y) > 0.15) reachable = false
  const wl = Math.hypot(w[0], w[1], w[2])
  const sol: SolvedAttack = {
    t: T,
    x: X,
    y: Y,
    z: Z,
    tHit: hit.t,
    tGround: T[n - 1],
    iHit: Math.min(n - 1, hit.i),
    elevation: (theta * 180) / Math.PI,
    apexH: f.apexZ,
    reachable,
    landing: { x: hit.x, y: hit.y },
    spinAxis: wl > 0 ? { x: w[0] / wl, y: w[1] / wl, z: w[2] / wl } : { x: 0, y: 0, z: 1 },
    spinRate: wl,
    dir,
    speed
  }
  if (key !== null) {
    cache.set(key, sol)
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!)
  }
  return sol
}

/**
 * Finte: senkrechte Abfluggeschwindigkeit aus der Bogenhöhe, waagerechte per Bisektion aus der Weite.
 * Der Luftwiderstand drückt den Scheitel etwas – zwei Korrekturrunden heben ihn auf die gewünschte Höhe.
 */
function solveFinte(S: V3, dir: { dx: number; dy: number }, D: number, arc: number): SolvedAttack {
  const w: V3 = [0, 0, 0]
  const target = S[2] + arc
  let vz = Math.sqrt(2 * G * arc)
  let vh = 0
  let f: Flight | null = null
  for (let round = 0; round < 3; round++) {
    let lo = 0.05
    let hi = 40
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      const r = fly(S, [mid * dir.dx, mid * dir.dy, vz], w, 0, false)
      const along = r.hit ? (r.hit.x - S[0]) * dir.dx + (r.hit.y - S[1]) * dir.dy : -Infinity
      if (along < D) lo = mid
      else hi = mid
    }
    vh = (lo + hi) / 2
    f = fly(S, [vh * dir.dx, vh * dir.dy, vz], w, 0, true)
    const miss = target - f.apexZ
    if (Math.abs(miss) < 0.005) break
    vz = Math.sqrt(Math.max(0.01, vz * vz + 2 * G * miss))
  }
  const end = { x: S[0] + dir.dx * D, y: S[1] + dir.dy * D }
  return finish(f!, end, true, Math.atan2(vz, vh), w, dir, Math.hypot(vh, vz), null)
}

/** Ballposition zur Zeit t seit dem Abschlag (geklemmt auf die Abtastung) */
export function attackPositionAt(sol: SolvedAttack, t: number): { x: number; y: number; z: number } {
  const n = sol.t.length
  if (t <= 0) return { x: sol.x[0], y: sol.y[0], z: sol.z[0] }
  if (t >= sol.t[n - 1]) return { x: sol.x[n - 1], y: sol.y[n - 1], z: sol.z[n - 1] }
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (sol.t[mid] <= t) lo = mid
    else hi = mid
  }
  const f = (t - sol.t[lo]) / Math.max(1e-12, sol.t[hi] - sol.t[lo])
  return {
    x: sol.x[lo] + (sol.x[hi] - sol.x[lo]) * f,
    y: sol.y[lo] + (sol.y[hi] - sol.y[lo]) * f,
    z: sol.z[lo] + (sol.z[hi] - sol.z[lo]) * f
  }
}

/** Punkte der Bahn zwischen den Zeiten t0 und t1 (Welt) */
export function attackPoints(sol: SolvedAttack, t0: number, t1: number, n = 64): { x: number; y: number; z: number }[] {
  const out = []
  for (let i = 0; i <= n; i++) out.push(attackPositionAt(sol, t0 + ((t1 - t0) * i) / n))
  return out
}

/** Geht der Ball über das Netz? null = er kreuzt die Netzebene nicht. */
export function netClearance(sol: SolvedAttack, netHeight: number): number | null {
  for (let i = 1; i <= sol.iHit && i < sol.t.length; i++) {
    if (Math.sign(sol.x[i - 1]) !== Math.sign(sol.x[i]) && sol.x[i - 1] !== 0) {
      const f = sol.x[i - 1] / (sol.x[i - 1] - sol.x[i])
      const z = sol.z[i - 1] + f * (sol.z[i] - sol.z[i - 1])
      return z - BALL_RADIUS - netHeight
    }
  }
  return null
}

/** Abgetastete Bewegung (Zeit ab Beginn, Weltposition) */
export interface Track {
  t: Float64Array
  x: Float64Array
  y: Float64Array
  z: Float64Array
  /** Drehung des Balls seit Beginn (Quaternion x, y, z, w je Abtastung, Welt) – fehlt = dreht nicht */
  q?: Float64Array
}

/** Stoßzahl Ball–Hallenboden (senkrecht) und verbleibender Anteil der waagerechten Geschwindigkeit je Aufprall */
export const BOUNCE_RESTITUTION = 0.62
export const BOUNCE_FRICTION = 0.78
/** Rollreibung (m/s²), sobald der Ball nicht mehr springt */
const ROLL_DECEL = 0.6

/**
 * Abprall nach dem Schlag: Der Ball springt vom Aufprallpunkt weiter (Stoßzahl, Reibung beim Aufprall,
 * Luftwiderstand), wird mit jedem Aufprall flacher und rollt schließlich aus. Dauer in Sekunden.
 * null, wenn der Ball am Ziel nicht den Boden berührt (Zielhöhe über 0).
 */
export function bounceTrack(sol: SolvedAttack, duration: number): Track | null {
  if (duration <= 0) return null
  const n = sol.t.length
  const i = Math.max(1, Math.min(n - 1, sol.iHit))
  const dt0 = Math.max(1e-6, sol.t[i] - sol.t[i - 1])
  let v: V3 = [(sol.x[i] - sol.x[i - 1]) / dt0, (sol.y[i] - sol.y[i - 1]) / dt0, (sol.z[i] - sol.z[i - 1]) / dt0]
  let p: V3 = [sol.landing.x, sol.landing.y, 0]
  // Erster Aufprall
  v = [v[0] * BOUNCE_FRICTION, v[1] * BOUNCE_FRICTION, Math.abs(v[2]) * BOUNCE_RESTITUTION]
  const ts = [0]
  const ps: V3[] = [[...p]]
  let t = 0
  let rolling = v[2] < 0.3
  const dt = 1 / 240
  while (t < duration) {
    if (rolling) {
      const sp = Math.hypot(v[0], v[1])
      const ns = Math.max(0, sp - ROLL_DECEL * dt)
      if (sp > 0) v = [(v[0] / sp) * ns, (v[1] / sp) * ns, 0]
      p = [p[0] + v[0] * dt, p[1] + v[1] * dt, 0]
    } else {
      const sp = Math.hypot(v[0], v[1], v[2])
      const k = DRAG_K * sp
      v = [v[0] - k * v[0] * dt, v[1] - k * v[1] * dt, v[2] + (-G - k * v[2]) * dt]
      p = [p[0] + v[0] * dt, p[1] + v[1] * dt, p[2] + v[2] * dt]
      if (p[2] <= 0) {
        p[2] = 0
        v = [v[0] * BOUNCE_FRICTION, v[1] * BOUNCE_FRICTION, -v[2] * BOUNCE_RESTITUTION]
        if (v[2] < 0.3) rolling = true
      }
    }
    t += dt
    ts.push(t)
    ps.push([...p])
  }
  const m = ts.length
  const track: Track = { t: new Float64Array(m), x: new Float64Array(m), y: new Float64Array(m), z: new Float64Array(m) }
  for (let k = 0; k < m; k++) {
    track.t[k] = ts[k]
    track.x[k] = ps[k][0]
    track.y[k] = ps[k][1]
    track.z[k] = ps[k][2]
  }
  return track
}

/** Position auf einer abgetasteten Bewegung zur Zeit t (geklemmt) */
export function trackPositionAt(tr: Track, t: number): { x: number; y: number; z: number } {
  const n = tr.t.length
  if (t <= 0) return { x: tr.x[0], y: tr.y[0], z: tr.z[0] }
  if (t >= tr.t[n - 1]) return { x: tr.x[n - 1], y: tr.y[n - 1], z: tr.z[n - 1] }
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (tr.t[mid] <= t) lo = mid
    else hi = mid
  }
  const f = (t - tr.t[lo]) / Math.max(1e-12, tr.t[hi] - tr.t[lo])
  return { x: tr.x[lo] + (tr.x[hi] - tr.x[lo]) * f, y: tr.y[lo] + (tr.y[hi] - tr.y[lo]) * f, z: tr.z[lo] + (tr.z[hi] - tr.z[lo]) * f }
}

/** Neuer Schlag vom Schlagpunkt des Zuspiels (oder frei) zum Ziel auf dem Boden */
export function newAttack(start: { x: number; y: number; h: number }, end: { x: number; y: number }): AttackInput {
  return clampAttack({ start, end, speed: ATTACK_SPEED.default, topspin: 0, sidespin: 0 })
}
