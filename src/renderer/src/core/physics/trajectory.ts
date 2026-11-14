/**
 * Flugbahn-Physik (reine Logik, keine UI-Abhängigkeiten).
 *
 * Eine Flugbahn ist in der Draufsicht eine Gerade von start (x, y) nach end (x, y) – end ist der Schlagpunkt.
 * Im Profil (s = Distanz entlang der Geraden, z = Höhe) fliegt der Ball unter Schwerkraft UND Luftwiderstand
 * (quadratisch in der Geschwindigkeit, Werte eines offiziellen Hallenballs):
 *   ds/dt = vs,  dz/dt = vz,  dvs/dt = −K·|v|·vs,  dvz/dt = −g − K·|v|·vz
 * Dadurch wird der Ball horizontal langsamer und fällt steiler, als er steigt – wie ein echter Volleyball.
 *
 * Lösung: Am Scheitel ist vz = 0, unbekannt ist nur die horizontale Geschwindigkeit u dort. Von diesem Zustand aus
 * wird rückwärts bis zur Starthöhe und vorwärts bis zur Schlagpunkthöhe integriert; u wird so gesucht, dass beide
 * Äste zusammen genau die Distanz D ergeben. Die Bahn geht damit exakt durch Start, Scheitel und Schlagpunkt.
 * Liegt der Schlagpunkt auf dem steigenden Ast (rising), wird er vor dem Scheitel getroffen: dann ist D der Abstand
 * zwischen Start und dem Punkt der Schlagpunkthöhe auf dem steigenden Ast, der Scheitel liegt dahinter.
 * Geschwindigkeit und Flugdauer ergeben sich daraus, es gibt keine manuelle Geschwindigkeit.
 */

export const G = 9.81

/** Offizieller Hallenball (FIVB): Umfang 65–67 cm, Masse 260–280 g – jeweils der Mittelwert. */
export const BALL_CIRCUMFERENCE = 0.66
export const BALL_MASS = 0.27
export const BALL_RADIUS = BALL_CIRCUMFERENCE / (2 * Math.PI)
/** Luftdichte in der Halle (~20 °C, kg/m³) */
export const AIR_DENSITY = 1.204
/** Widerstandsbeiwert eines Volleyballs im Bereich normaler Pass-/Zuspielgeschwindigkeiten (gemessen ca. 0,4–0,5). */
export const DRAG_COEFF = 0.45
/** K = ½ · ρ · c_w · A / m  (1/m) */
export const DRAG_K = (0.5 * AIR_DENSITY * DRAG_COEFF * Math.PI * BALL_RADIUS ** 2) / BALL_MASS

/** Scheitel mindestens so weit über Start und Schlagpunkt (m) – sonst wäre die Bahn eine Gerade (unendlich schnell). */
export const APEX_EPS = 0.05
/** Schlagpunkt auf dem steigenden Ast mindestens so weit über dem Start (m) */
export const RISE_EPS = 0.02
/** Kürzeste Flugbahn (m); darunter gilt die Eingabe als Klick */
export const MIN_DIST = 0.2
export const START_H_MAX = 6
export const APEX_H_MAX = 15

/** Integrationsschritt: höchstens 1/600 s und höchstens 4 cm Flugweg pro Schritt */
const DT_MAX = 1 / 600
const STEP_LEN = 0.04
/** Darüber gilt eine Bahn als unspielbar schnell (m/s) – schützt die Rückwärts-Integration */
const V_LIMIT = 400
const MAX_STEPS = 200_000

export interface TrajectoryInput {
  start: { x: number; y: number; h: number }
  /** Schlagpunkt in der Draufsicht */
  end: { x: number; y: number }
  /** Absolute Scheitelhöhe */
  apexH: number
  /** Höhe des Schlagpunkts */
  hitH: number
  /** Schlagpunkt auf dem steigenden Ast (vor dem Scheitel); Standard: fallender Ast */
  rising?: boolean
}

/** Dicht abgetastete Bahn vom Abwurf bis zum Bodenaufprall (Zeit ab Abwurf, Distanz ab Start). */
export interface TrajectorySamples {
  t: Float64Array
  s: Float64Array
  z: Float64Array
  vs: Float64Array
  vz: Float64Array
  /** Index des Scheitels */
  iApex: number
}

export interface SolvedTrajectory {
  /** Distanz Start → Schlagpunkt (Draufsicht) */
  D: number
  /** Einheitsvektor Start → Schlagpunkt */
  dir: { dx: number; dy: number }
  h0: number
  h1: number
  apexH: number
  /** Schlagpunkt liegt auf dem steigenden Ast (Scheitel hinter dem Schlagpunkt) */
  rising: boolean
  /** Distanz des Scheitels vom Start */
  sA: number
  /** Distanz, bei der der Ball den Boden erreicht */
  sGround: number
  /** Horizontale Abfluggeschwindigkeit (m/s) */
  vH: number
  /** Vertikale Abfluggeschwindigkeit (m/s) */
  vZ0: number
  /** Geschwindigkeit am Schlagpunkt (m/s) */
  vHit: number
  /** Zeit bis zum Scheitel (s) */
  tApex: number
  /** Flugdauer bis zum Schlagpunkt (s) */
  tHit: number
  /** Flugdauer bis zum Bodenaufprall (s) */
  tGround: number
  samples: TrajectorySamples
}

// ---------------------------------------------------------------------------------------------
// Integration

type State = [s: number, z: number, vs: number, vz: number]

function deriv(st: State): State {
  const [, , vs, vz] = st
  const kv = DRAG_K * Math.hypot(vs, vz)
  return [vs, vz, -kv * vs, -G - kv * vz]
}

function rk4(st: State, dt: number): State {
  const k1 = deriv(st)
  const a: State = [st[0] + (dt / 2) * k1[0], st[1] + (dt / 2) * k1[1], st[2] + (dt / 2) * k1[2], st[3] + (dt / 2) * k1[3]]
  const k2 = deriv(a)
  const b: State = [st[0] + (dt / 2) * k2[0], st[1] + (dt / 2) * k2[1], st[2] + (dt / 2) * k2[2], st[3] + (dt / 2) * k2[3]]
  const k3 = deriv(b)
  const c: State = [st[0] + dt * k3[0], st[1] + dt * k3[1], st[2] + dt * k3[2], st[3] + dt * k3[3]]
  const k4 = deriv(c)
  return [
    st[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    st[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    st[2] + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    st[3] + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3])
  ]
}

interface Branch {
  /** Zustände inkl. exaktem Endpunkt auf der Zielhöhe; t relativ zum Scheitel */
  t: number[]
  st: State[]
  ok: boolean
}

/**
 * Integriert vom Scheitel (s = 0, z = H, vs = u, vz = 0) vorwärts (sign = 1) oder rückwärts (sign = −1),
 * bis die Höhe targetZ erreicht ist. Der letzte Zustand wird linear auf targetZ interpoliert.
 */
function integrateFromApex(u: number, H: number, sign: 1 | -1, targetZ: number, record: boolean): Branch {
  let st: State = [0, H, u, 0]
  let t = 0
  const ts = [0]
  const sts: State[] = [st]
  if (targetZ >= H) return { t: ts, st: sts, ok: true }
  for (let i = 0; i < MAX_STEPS; i++) {
    const v = Math.hypot(st[2], st[3])
    if (v > V_LIMIT) return { t: ts, st: sts, ok: false }
    const dt = Math.min(DT_MAX, STEP_LEN / Math.max(v, 1e-9))
    const next = rk4(st, sign * dt)
    const tn = t + sign * dt
    if (next[1] <= targetZ) {
      const f = (st[1] - targetZ) / (st[1] - next[1])
      const end: State = [
        st[0] + f * (next[0] - st[0]),
        targetZ,
        st[2] + f * (next[2] - st[2]),
        st[3] + f * (next[3] - st[3])
      ]
      if (record) {
        ts.push(t + f * (tn - t))
        sts.push(end)
      } else {
        ts[0] = t + f * (tn - t)
        sts[0] = end
      }
      return { t: ts, st: sts, ok: true }
    }
    st = next
    t = tn
    if (record) {
      ts.push(t)
      sts.push(st)
    }
  }
  return { t: ts, st: sts, ok: false }
}

/**
 * Horizontale Distanz Start → Schlagpunkt für die Scheitelgeschwindigkeit u:
 * fallend = beide Äste (Start → Scheitel → Schlagpunkt), steigend = Start → Schlagpunkthöhe auf dem steigenden Ast.
 */
function spanFor(u: number, h0: number, H: number, h1: number, rising: boolean): number {
  const up = integrateFromApex(u, H, -1, h0, false)
  if (!up.ok) return Infinity
  if (rising) {
    const up1 = integrateFromApex(u, H, -1, h1, false)
    if (!up1.ok) return Infinity
    return -up.st[up.st.length - 1][0] + up1.st[up1.st.length - 1][0]
  }
  const down = integrateFromApex(u, H, 1, h1, false)
  if (!down.ok) return Infinity
  const sUp = -up.st[up.st.length - 1][0]
  const sDown = down.st[down.st.length - 1][0]
  return sUp + sDown
}

/** Sucht u mit spanFor(u) = D (monoton steigend in u): Klammer aufweiten, dann Illinois-Verfahren. */
function solveApexSpeed(D: number, h0: number, H: number, h1: number, rising: boolean): number {
  // Startwert aus der Lösung ohne Luft
  const a0 = Math.sqrt(H - h0)
  const a1 = Math.sqrt(H - h1)
  const kVac = ((rising ? Math.max(1e-6, a0 - a1) : a0 + a1) / D) ** 2
  let hi = Math.sqrt(G / (2 * kVac))
  let lo = 0
  let flo = -D
  let fhi = spanFor(hi, h0, H, h1, rising) - D
  for (let i = 0; i < 60 && fhi < 0; i++) {
    lo = hi
    flo = fhi
    hi *= 1.6
    fhi = spanFor(hi, h0, H, h1, rising) - D
  }
  let side = 0
  for (let i = 0; i < 80; i++) {
    let x: number
    if (!Number.isFinite(fhi)) x = (lo + hi) / 2
    else x = (lo * fhi - hi * flo) / (fhi - flo)
    if (!(x > lo && x < hi)) x = (lo + hi) / 2
    const fx = spanFor(x, h0, H, h1, rising) - D
    if (Math.abs(fx) < 1e-9 || hi - lo < 1e-12) return x
    if (fx > 0) {
      hi = x
      fhi = fx
      if (side === 1) flo /= 2
      side = 1
    } else {
      lo = x
      flo = fx
      if (side === -1 && Number.isFinite(fhi)) fhi /= 2
      side = -1
    }
  }
  return (lo + hi) / 2
}

// ---------------------------------------------------------------------------------------------
// Lösen (mit Zwischenspeicher – die Bahn wird pro Frame mehrfach gebraucht)

type Profile = Omit<SolvedTrajectory, 'dir'>

const cache = new Map<string, Profile>()
const CACHE_MAX = 96

function solveProfile(D: number, h0: number, H: number, h1: number, rising: boolean): Profile {
  const key = `${D}|${h0}|${H}|${h1}|${rising ? 1 : 0}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const u = solveApexSpeed(D, h0, H, h1, rising)
  const up = integrateFromApex(u, H, -1, h0, true)
  const down = integrateFromApex(u, H, 1, 0, true)
  const nUp = up.t.length
  const n = nUp + down.t.length - 1
  const t = new Float64Array(n)
  const s = new Float64Array(n)
  const z = new Float64Array(n)
  const vs = new Float64Array(n)
  const vz = new Float64Array(n)
  const tLaunch = up.t[nUp - 1]
  const sLaunch = up.st[nUp - 1][0]
  // Aufsteigender Ast rückwärts gespeichert → umdrehen
  for (let i = 0; i < nUp; i++) {
    const j = nUp - 1 - i
    t[i] = up.t[j] - tLaunch
    s[i] = up.st[j][0] - sLaunch
    z[i] = up.st[j][1]
    vs[i] = up.st[j][2]
    vz[i] = up.st[j][3]
  }
  for (let i = 1; i < down.t.length; i++) {
    const k = nUp - 1 + i
    t[k] = down.t[i] - tLaunch
    s[k] = down.st[i][0] - sLaunch
    z[k] = down.st[i][1]
    vs[k] = down.st[i][2]
    vz[k] = down.st[i][3]
  }
  // Exakte Randwerte (gegen Rundung)
  s[0] = 0
  z[0] = h0
  z[n - 1] = 0
  const samples: TrajectorySamples = { t, s, z, vs, vz, iApex: nUp - 1 }
  const tHit = timeAtDist(samples, D)
  const iHit = segmentIndex(s, D)
  const fHit = s[iHit + 1] > s[iHit] ? (D - s[iHit]) / (s[iHit + 1] - s[iHit]) : 0
  const vHit = Math.hypot(lerp(vs[iHit], vs[iHit + 1], fHit), lerp(vz[iHit], vz[iHit + 1], fHit))
  const p: Profile = {
    D,
    h0,
    h1,
    apexH: H,
    rising,
    sA: s[nUp - 1],
    sGround: s[n - 1],
    vH: vs[0],
    vZ0: vz[0],
    vHit,
    tApex: t[nUp - 1],
    tHit,
    tGround: t[n - 1],
    samples
  }
  cache.set(key, p)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!)
  return p
}

/**
 * Klemmt die Eingabe auf physikalisch mögliche Werte (Scheitel über Start und Schlagpunkt, Höhen ≥ 0).
 * Auf dem steigenden Ast liegt der Schlagpunkt zusätzlich über dem Start.
 */
export function clampInput(t: TrajectoryInput): TrajectoryInput {
  const h0 = Math.min(START_H_MAX, Math.max(0, Number.isFinite(t.start.h) ? t.start.h : 0))
  const rising = !!t.rising
  let hitH = Math.max(0, Number.isFinite(t.hitH) ? t.hitH : 0)
  if (rising) hitH = Math.max(hitH, h0 + RISE_EPS)
  const minApex = Math.max(h0, hitH) + APEX_EPS
  const apexH = Math.min(Math.max(APEX_H_MAX, minApex), Math.max(minApex, Number.isFinite(t.apexH) ? t.apexH : minApex))
  const out: TrajectoryInput = { start: { ...t.start, h: h0 }, end: { ...t.end }, apexH, hitH }
  if (rising) out.rising = true
  return out
}

/** Löst die Flugbahn aus Start, Scheitelhöhe und Schlagpunkt. */
export function solveTrajectory(input: TrajectoryInput): SolvedTrajectory {
  const t = clampInput(input)
  const ex = t.end.x - t.start.x
  const ey = t.end.y - t.start.y
  const rawD = Math.hypot(ex, ey)
  const D = Math.max(MIN_DIST, rawD)
  const dir = rawD > 1e-9 ? { dx: ex / rawD, dy: ey / rawD } : { dx: 1, dy: 0 }
  return { ...solveProfile(D, t.start.h, t.apexH, t.hitH, !!t.rising), dir }
}

// ---------------------------------------------------------------------------------------------
// Abfragen

const lerp = (a: number, b: number, f: number) => a + (b - a) * f

/** Index i mit arr[i] ≤ x < arr[i+1] (geklemmt auf 0 … n−2); arr ist aufsteigend. */
function segmentIndex(arr: Float64Array, x: number): number {
  let lo = 0
  let hi = arr.length - 1
  if (x <= arr[0]) return 0
  if (x >= arr[hi]) return Math.max(0, hi - 1)
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (arr[mid] <= x) lo = mid
    else hi = mid
  }
  return lo
}

/** Kubische Hermite-Interpolation von p mit Ableitungen m auf einem Intervall der Länge h */
function hermite(p0: number, p1: number, m0: number, m1: number, h: number, f: number): number {
  const f2 = f * f
  const f3 = f2 * f
  return (2 * f3 - 3 * f2 + 1) * p0 + (f3 - 2 * f2 + f) * h * m0 + (-2 * f3 + 3 * f2) * p1 + (f3 - f2) * h * m1
}

function timeAtDist(sm: TrajectorySamples, s: number): number {
  const i = segmentIndex(sm.s, s)
  const ds = sm.s[i + 1] - sm.s[i]
  const f = ds > 0 ? (s - sm.s[i]) / ds : 0
  return lerp(sm.t[i], sm.t[i + 1], f)
}

/** Höhe bei Distanz s (außerhalb der Bahn linear fortgesetzt) */
export function heightAt(sol: SolvedTrajectory, s: number): number {
  const { s: S, z: Z, vs: VS, vz: VZ } = sol.samples
  const n = S.length
  if (s <= 0) return Z[0] + (s * VZ[0]) / VS[0]
  if (s >= S[n - 1]) return Z[n - 1] + ((s - S[n - 1]) * VZ[n - 1]) / VS[n - 1]
  const i = segmentIndex(S, s)
  const h = S[i + 1] - S[i]
  if (h <= 0) return Z[i]
  return hermite(Z[i], Z[i + 1], VZ[i] / VS[i], VZ[i + 1] / VS[i + 1], h, (s - S[i]) / h)
}

/** Distanz auf dem fallenden Ast, bei der der Ball die Höhe h erreicht (h zwischen Boden und Scheitel). */
export function distAtHeightFalling(sol: SolvedTrajectory, h: number): number {
  const { s: S, z: Z, iApex } = sol.samples
  const n = S.length
  if (h >= Z[iApex]) return S[iApex]
  if (h <= 0) return S[n - 1]
  // z fällt hinter dem Scheitel streng monoton
  let lo = iApex
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (Z[mid] >= h) lo = mid
    else hi = mid
  }
  const dz = Z[lo] - Z[hi]
  return dz > 0 ? lerp(S[lo], S[hi], (Z[lo] - h) / dz) : S[lo]
}

/** Distanz auf dem steigenden Ast, bei der der Ball die Höhe h erreicht (h zwischen Start und Scheitel). */
export function distAtHeightRising(sol: SolvedTrajectory, h: number): number {
  const { s: S, z: Z, iApex } = sol.samples
  if (h >= Z[iApex]) return S[iApex]
  if (h <= Z[0]) return 0
  // z steigt bis zum Scheitel streng monoton
  let lo = 0
  let hi = iApex
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (Z[mid] <= h) lo = mid
    else hi = mid
  }
  const dz = Z[hi] - Z[lo]
  return dz > 0 ? lerp(S[lo], S[hi], (h - Z[lo]) / dz) : S[lo]
}

/** Profilzustand (Distanz, Höhe, Geschwindigkeit) zur Zeit t seit dem Abwurf */
export function stateAt(sol: SolvedTrajectory, t: number): { s: number; z: number; vs: number; vz: number } {
  const { t: T, s: S, z: Z, vs: VS, vz: VZ } = sol.samples
  const n = T.length
  if (t <= 0) return { s: 0, z: Z[0], vs: VS[0], vz: VZ[0] }
  if (t >= T[n - 1]) return { s: S[n - 1], z: 0, vs: 0, vz: 0 }
  const i = segmentIndex(T, t)
  const h = T[i + 1] - T[i]
  const f = h > 0 ? (t - T[i]) / h : 0
  return {
    s: hermite(S[i], S[i + 1], VS[i], VS[i + 1], h, f),
    z: Math.max(0, hermite(Z[i], Z[i + 1], VZ[i], VZ[i + 1], h, f)),
    vs: lerp(VS[i], VS[i + 1], f),
    vz: lerp(VZ[i], VZ[i + 1], f)
  }
}

/** Ballposition (Welt) zur Zeit t seit dem Abwurf; über tGround hinaus bleibt er am Boden. */
export function positionAt(
  sol: SolvedTrajectory,
  start: { x: number; y: number },
  t: number
): { x: number; y: number; z: number } {
  const st = stateAt(sol, t)
  return { x: start.x + sol.dir.dx * st.s, y: start.y + sol.dir.dy * st.s, z: st.z }
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

/** Kleinste erlaubte Schlagpunkt-Distanz auf dem fallenden Ast (knapp hinter dem Scheitel) */
export function minHitDist(sol: SolvedTrajectory): number {
  return distAtHeightFalling(sol, sol.apexH - APEX_EPS)
}

/**
 * Erlaubte Bereiche für den Schlagpunkt entlang der Bahn (Distanz ab Start): steigender Ast (knapp über dem Start
 * bis knapp vor dem Scheitel) und fallender Ast (knapp hinter dem Scheitel bis zum Boden). Am Scheitel bleibt eine
 * kleine Lücke, dort wäre die Bahn nicht eindeutig bestimmt.
 */
export function hitRanges(sol: SolvedTrajectory): { rising: [number, number] | null; falling: [number, number] } {
  const r0 = Math.max(MIN_DIST, distAtHeightRising(sol, sol.h0 + RISE_EPS))
  const r1 = distAtHeightRising(sol, sol.apexH - APEX_EPS)
  const f0 = Math.max(MIN_DIST, minHitDist(sol))
  return { rising: r1 > r0 ? [r0, r1] : null, falling: [f0, Math.max(f0, sol.sGround)] }
}

/** Klemmt eine Distanz auf den nächsten erlaubten Schlagpunkt (steigend oder fallend). */
function clampHitDist(sol: SolvedTrajectory, s: number): { s: number; rising: boolean } {
  const { rising, falling } = hitRanges(sol)
  const fs = Math.min(falling[1], Math.max(falling[0], s))
  if (!rising) return { s: fs, rising: false }
  const rs = Math.min(rising[1], Math.max(rising[0], s))
  return Math.abs(rs - s) < Math.abs(fs - s) ? { s: rs, rising: true } : { s: fs, rising: false }
}

/**
 * Schlagpunkt entlang der (festen) Bahn verschieben – auf dem steigenden wie auf dem fallenden Ast.
 * Gibt die neue Eingabe zurück (Ende wandert in gleicher Richtung, Höhe = z(s), Ast je nach Lage zum Scheitel).
 */
export function moveHitAlongParabola(input: TrajectoryInput, s: number): TrajectoryInput {
  const sol = solveTrajectory(input)
  const c = clampHitDist(sol, s)
  const out: TrajectoryInput = {
    start: { ...input.start },
    end: { x: input.start.x + sol.dir.dx * c.s, y: input.start.y + sol.dir.dy * c.s },
    apexH: sol.apexH,
    hitH: Math.max(0, heightAt(sol, c.s))
  }
  if (c.rising) out.rising = true
  return out
}

/** Schlagpunkt auf eine Höhe setzen, auf dem gewünschten Ast (Bahn bleibt gleich, nur der Schlagpunkt wandert). */
export function setHitHeight(input: TrajectoryInput, h: number, rising: boolean): TrajectoryInput {
  const sol = solveTrajectory(input)
  const { rising: r } = hitRanges(sol)
  if (rising && r) {
    const hc = Math.min(sol.apexH - APEX_EPS, Math.max(sol.h0 + RISE_EPS, h))
    return moveHitAlongParabola(input, Math.min(r[1], Math.max(r[0], distAtHeightRising(sol, hc))))
  }
  const hc = Math.min(sol.apexH - APEX_EPS, Math.max(0, h))
  return moveHitAlongParabola(input, Math.max(minHitDist(sol), distAtHeightFalling(sol, hc)))
}

/** Höchste einstellbare Höhe des Schlagpunkts (m) */
export const HIT_H_MAX = 4.5

/**
 * Höhe des Schlagpunkts ändern, ohne dass er sich verschiebt: Start und Ziel bleiben, wo sie sind; die Kurve
 * dazwischen passt sich an (ihr höchster Punkt wandert). Der Scheitel bleibt gleich hoch und wird nur angehoben,
 * wenn er sonst nicht mehr über dem Schlagpunkt läge. Auf dem steigenden Ast bleibt der Schlagpunkt über dem Start.
 */
export function setHitHeightFixed(input: TrajectoryInput, h: number, rising = !!input.rising): TrajectoryInput {
  const lo = rising ? input.start.h + RISE_EPS : 0
  const hitH = Math.min(HIT_H_MAX, Math.max(lo, Number.isFinite(h) ? h : input.hitH))
  const out: TrajectoryInput = {
    start: { ...input.start },
    end: { ...input.end },
    apexH: Math.max(input.apexH, Math.max(input.start.h, hitH) + APEX_EPS),
    hitH
  }
  if (rising) out.rising = true
  return clampInput(out)
}

/**
 * Projiziert einen Bildschirmpunkt auf die Bahn (beide Äste, ohne die Lücke am Scheitel): sucht die Distanz s,
 * deren projizierter Punkt dem Zeiger am nächsten liegt. `project` bildet Weltpunkte auf Bildschirm-Pixel ab.
 */
export function projectToHitBranches(
  sol: SolvedTrajectory,
  start: { x: number; y: number },
  project: (p: { x: number; y: number; z: number }) => { px: number; py: number },
  px: number,
  py: number
): number {
  const { rising, falling } = hitRanges(sol)
  const ranges = rising ? [rising, falling] : [falling]
  const N = 200
  let best = falling[0]
  let bestD = Infinity
  for (const [lo, hi] of ranges) {
    for (let i = 0; i <= N; i++) {
      const s = lo + ((hi - lo) * i) / N
      const p = project(pointAt(sol, start, s))
      const d = (p.px - px) ** 2 + (p.py - py) ** 2
      if (d < bestD) {
        bestD = d
        best = s
      }
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
  // Ein steigender Schlagpunkt des Zuspiels muss deutlich über dem (neuen) Start liegen, sonst wird er zum fallenden
  // (sonst entstünde eine fast flache, unrealistisch schnelle Bahn)
  const next: TrajectoryInput = { ...z, start }
  if (next.rising && next.hitH < start.h + 0.1) delete next.rising
  return { ...tr, zuspiel: clampInput(next) }
}
