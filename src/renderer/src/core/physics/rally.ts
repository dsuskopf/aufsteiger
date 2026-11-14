/**
 * Ballwechsel: reiht die Ballflüge (Annahme, Zuspiel, Schlag) aneinander und prüft, ob der Ball unterwegs
 * das Netz, eine Antenne oder einen Blocker trifft. Dann endet der Flug dort, und der Ball prallt ab:
 * Er fliegt frei weiter (Schwerkraft, Luftwiderstand, Magnus-Kraft durch Drall), springt auf dem Boden –
 * wo die Reibung seinen Drall verändert – und rollt aus.
 * Alle Ballkontakte werden als Ereignisse gemeldet (für Geräusche, Kamera-Wackeln, Effekte, Zeitleiste).
 *
 * Blocker sind keine gedachten Flächen, sondern ihre echten Arme, Hände und der Kopf zur jeweiligen Zeit
 * (Kapseln aus der Körperhaltung). Ob und wie der Ball abprallt, folgt allein aus Flugbahn und Trefferfläche:
 * Richtung der Fläche am Treffpunkt, Bewegung der Hände und Stoßzahl.
 */
import { COURT } from '../geometry/court'
import { buildTimeline, segmentPosition, type Segment, type Timeline, type TimelineItem } from '../timeline/timeline'
import { BOUNCE_RESTITUTION, MAGNUS_K, type Track } from './attack'
import { BALL_RADIUS, DRAG_K, G } from './trajectory'

type V3 = [number, number, number]
type P3 = { x: number; y: number; z: number }

/** Art eines Ballkontakts */
export type BallEventKind = 'annahme' | 'zuspiel' | 'schlag' | 'block' | 'netz' | 'netzkante' | 'antenne' | 'boden'
/** Hindernis, an dem der Ball abprallt */
export type HitKind = 'block' | 'netz' | 'netzkante' | 'antenne'

export interface BallEvent {
  /** Zeit auf der Gesamtachse (s) */
  t: number
  kind: BallEventKind
  x: number
  y: number
  z: number
  /** Geschwindigkeit des Balls beim Kontakt (m/s) – Maß für die Härte */
  speed: number
  /** Blocker (Schlüssel „Seite:Spieler“), der den Ball berührt hat */
  by?: string
  /** Netzkontakt: Flugrichtung entlang des Feldes (+1 = von A nach B) – dorthin beult das Netz aus */
  dir?: number
  /** Schlag: es ist eine Finte (leiser, weicher Kontakt) */
  finte?: boolean
}

/**
 * Trefferfläche (Weltkoordinaten): Strecke a–b mit Radius r (Arm, Kopf) – oder, mit w, eine flache Platte:
 * die Strecke nach beiden Seiten um w verbreitert (w steht senkrecht auf a–b), mit r als halber Dicke (Hand).
 */
export interface Capsule {
  a: V3
  b: V3
  r: number
  /** Halbe Breite als Vektor (senkrecht zu a–b) – macht aus der Kapsel eine Platte */
  w?: V3
}
/** Trefferflächen eines Blockers */
export interface BlockerShape {
  key: string
  caps: Capsule[]
}
/** Trefferflächen eines Blockers zur Zeit t (Gesamtachse); ball = wo der Ball dann ist (für die Blickrichtung) */
export type BlockerFn = (t: number, ball: P3) => BlockerShape | null

export type RallyType = 'annahme' | 'zuspiel' | 'schlag' | 'abprall'

export interface RallyInput {
  /** Ballflüge in Spielreihenfolge */
  items: TimelineItem<RallyType>[]
  netHeight: number
  blockers: BlockerFn[]
  /** Ball springt nach dem ersten Bodenkontakt weiter (sonst endet die Animation dort) */
  bounce: boolean
  /** Dauer des Abpralls nach dem ersten Bodenkontakt (s) */
  bounceDuration: number
}

export interface Rally {
  timeline: Timeline<RallyType>
  events: BallEvent[]
  /** Hat der Ball Netz oder Block getroffen: der abgebrochene Flug und der Weg danach bis zum Boden */
  deflection: { type: RallyType; kind: HitKind; points: P3[] } | null
  /** Fehler im Ballwechsel (z. B. Antenne berührt) */
  fault: { t: number; reason: 'antenne' } | null
}

/**
 * Drall der Annahme und des Zuspiels (Umdrehungen pro Sekunde, Rückwärtsdrall): Unterarme drehen den Ball deutlich,
 * ein sauberes Pritschen kaum. Für die Flugbahn selbst zählt er nicht (dort rechnet die Parabel), wohl aber für
 * das Aussehen und für alles nach einem Abprall.
 */
export const SPIN_RPS = { annahme: 1.4, zuspiel: 0.35 } as const

const STEP = 1 / 300

interface Collision {
  /** Zeit seit Beginn des Flugs (s) */
  t: number
  kind: HitKind
  p: V3
  vIn: V3
  pOut: V3
  vOut: V3
  by?: string
}

/* ---------- Vektoren ---------- */
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const v3 = (p: P3): V3 => [p.x, p.y, p.z]

/** Nächster Punkt der Strecke a–b zu p und seine Lage u (0 = a, 1 = b) */
function closestOnSegment(p: V3, a: V3, b: V3): { q: V3; u: number } {
  const ab = sub(b, a)
  const l2 = dot(ab, ab)
  const u = l2 > 1e-12 ? Math.min(1, Math.max(0, dot(sub(p, a), ab) / l2)) : 0
  return { q: [a[0] + ab[0] * u, a[1] + ab[1] * u, a[2] + ab[2] * u], u }
}

/* ---------- Antenne und Netz ---------- */

/** Lage der Antennen (Abstand der Achse von der Feldmitte) und ihr Radius */
export const ANTENNA_Y = COURT.halfWidth + COURT.antennaPocketRadius
const ANTENNA_R = COURT.antennaPocketRadius

/**
 * Trifft der Ball eine Antenne? Sie steht senkrecht über der Seitenlinie, vom unteren Netzrand bis 80 cm über die
 * Netzkante. Berührt der Ball sie, ist das ein Fehler. Die Antenne ist ein biegsamer Glasfaserstab: Sie gibt nach,
 * der Ball fliegt fast ungehindert weiter – etwas langsamer und um wenige Grad von der Stange weg abgelenkt.
 * Je mittiger der Treffer, desto mehr Tempo verliert er.
 */
export function antennaHit(y: number, z: number, v: V3, netHeight: number): Omit<Collision, 't'> | null {
  const side = Math.sign(y) || 1
  const dy = y - side * ANTENNA_Y
  const reach = BALL_RADIUS + ANTENNA_R
  if (Math.abs(dy) >= reach) return null
  if (z < netHeight - COURT.netBandDepth - BALL_RADIUS || z > netHeight + COURT.antennaHeightAboveNet + BALL_RADIUS * 0.5) return null
  const dir = Math.sign(v[0]) || 1
  const sp = len(v)
  // 0 = streift nur, 1 = voll getroffen
  const k = 1 - Math.abs(dy) / reach
  const away = Math.sign(dy) || side
  const keep = 1 - 0.15 * k
  return {
    kind: 'antenne',
    p: [0, y, z],
    vIn: v,
    // Der Stab biegt sich weg: Der Ball fliegt an Ort und Stelle weiter
    pOut: [dir * 0.004, y + away * 0.004, z],
    vOut: [v[0] * keep, v[1] * keep + away * sp * 0.035 * (0.5 + k), v[2] * keep]
  }
}

/** Trifft ein Ball, der die Netzebene (x = 0) bei (y, z) mit Geschwindigkeit v durchquert, Antenne oder Netz? */
export function netHit(y: number, z: number, v: V3, netHeight: number): Omit<Collision, 't'> | null {
  // Unterhalb der Netzkante fängt innerhalb der Antennen das Netz den Ball; darüber und außen zählt die Antenne
  if (z > netHeight - 0.02 || Math.abs(y) >= ANTENNA_Y) {
    const ant = antennaHit(y, z, v, netHeight)
    if (ant) return ant
  }
  // Außerhalb der Antennen hängt das Netz nur noch an den Seilen: kein Netzkontakt
  if (Math.abs(y) > ANTENNA_Y) return null
  // Darüber (auch knapp) oder unter dem Netz hindurch
  if (z > netHeight + BALL_RADIUS * 0.85) return null
  if (z < netHeight - COURT.netBandDepth - BALL_RADIUS * 0.5) return null
  const dir = Math.sign(v[0]) || 1
  const p: V3 = [0, y, z]
  if (z >= netHeight - 0.02) {
    // Netzkante: Der Ball streift das Band, verliert Tempo, hüpft kurz auf und fällt auf die andere Seite
    return {
      kind: 'netzkante',
      p,
      vIn: v,
      pOut: [dir * BALL_RADIUS * 0.6, y, netHeight + BALL_RADIUS * 0.9],
      vOut: [v[0] * 0.3, v[1] * 0.6, Math.max(v[2] * 0.2, 0) + 0.9 + 0.035 * Math.abs(v[0])]
    }
  }
  // Maschen: Das Netz gibt nach und schluckt fast alles – der Ball fällt auf der eigenen Seite herunter
  return {
    kind: 'netz',
    p,
    vIn: v,
    pOut: [-dir * (BALL_RADIUS + 0.02), y, z],
    vOut: [-v[0] * 0.09, v[1] * 0.25, Math.min(v[2], 0) * 0.3 - 0.3]
  }
}

/* ---------- Block ---------- */

/** Stoßzahl Ball–Hände (die Arme sind gespannt, geben aber etwas nach) und Reibung entlang der Hand */
export const BLOCK_RESTITUTION = 0.5
const BLOCK_TANGENT = 0.72

/** Abstand des Balls zur nächsten Trefferfläche eines Blockers (negativ = Berührung) */
interface Contact {
  gap: number
  key: string
  cap: number
  /** Lage des Treffpunkts auf der Fläche: entlang a–b (0–1) und quer (−1 – 1) */
  u: number
  s: number
  q: V3
  r: number
}
/** Nächster Punkt einer Trefferfläche zu p */
function closestOnCap(p: V3, c: Capsule): { q: V3; u: number; s: number } {
  const { q, u } = closestOnSegment(p, c.a, c.b)
  if (!c.w) return { q, u, s: 0 }
  const wl2 = dot(c.w, c.w)
  const s = wl2 > 1e-12 ? Math.min(1, Math.max(-1, dot(sub(p, q), c.w) / wl2)) : 0
  return { q: [q[0] + c.w[0] * s, q[1] + c.w[1] * s, q[2] + c.w[2] * s], u, s }
}
/** Derselbe Punkt der Fläche (u, s) – z. B. kurz vorher, um die Bewegung der Hand zu bestimmen */
function pointOnCap(c: Capsule, u: number, s: number): V3 {
  const w = c.w ?? [0, 0, 0]
  return [c.a[0] + (c.b[0] - c.a[0]) * u + w[0] * s, c.a[1] + (c.b[1] - c.a[1]) * u + w[1] * s, c.a[2] + (c.b[2] - c.a[2]) * u + w[2] * s]
}
function nearest(shape: BlockerShape, p: V3): Contact | null {
  let best: Contact | null = null
  shape.caps.forEach((c, i) => {
    const { q, u, s } = closestOnCap(p, c)
    const gap = len(sub(p, q)) - BALL_RADIUS - c.r
    if (!best || gap < best.gap) best = { gap, key: shape.key, cap: i, u, s, q, r: c.r }
  })
  return best
}

/**
 * Abprall an einer Trefferfläche: Normale vom Treffpunkt zur Ballmitte, relative Geschwindigkeit zur Hand
 * (die Hände drücken nach oben und über das Netz), Stoßzahl senkrecht zur Fläche, Reibung entlang.
 * Fingerspitzen von unten getroffen → Ball steigt und fliegt weiter; Handflächen frontal → zurück und nach unten;
 * Außenkante → seitlich weg. Alles folgt aus der Geometrie.
 */
export function blockBounce(p: V3, v: V3, q: V3, vHand: V3): { n: V3; v: V3 } {
  let n = sub(p, q)
  const l = len(n)
  n = l > 1e-9 ? [n[0] / l, n[1] / l, n[2] / l] : [-v[0] / (len(v) || 1), -v[1] / (len(v) || 1), -v[2] / (len(v) || 1)]
  const vr = sub(v, vHand)
  const vn = dot(vr, n)
  if (vn >= 0) return { n, v }
  const t: V3 = [vr[0] - vn * n[0], vr[1] - vn * n[1], vr[2] - vn * n[2]]
  return {
    n,
    v: [
      t[0] * BLOCK_TANGENT - BLOCK_RESTITUTION * vn * n[0] + vHand[0],
      t[1] * BLOCK_TANGENT - BLOCK_RESTITUTION * vn * n[1] + vHand[1],
      t[2] * BLOCK_TANGENT - BLOCK_RESTITUTION * vn * n[2] + vHand[2]
    ]
  }
}

/** Erster Treffer (Netz, Antenne oder Blocker) entlang eines Flugs; null, wenn der Ball frei durchkommt */
function findCollision(posAt: (t: number) => P3, duration: number, t0: number, netHeight: number, blockers: BlockerFn[]): Collision | null {
  const n = Math.max(1, Math.ceil(duration / STEP))
  // Kleinster Abstand zu allen Blockern zur Zeit t (seit Flugbeginn)
  const contactAt = (t: number): Contact | null => {
    const ball = posAt(t)
    const p = v3(ball)
    let best: Contact | null = null
    for (const fn of blockers) {
      const shape = fn(t0 + t, ball)
      const c = shape ? nearest(shape, p) : null
      if (c && (!best || c.gap < best.gap)) best = c
    }
    return best
  }
  let prev = posAt(0)
  // Steckt der Ball schon am Anfang in einem Blocker (z. B. Start im Arm), zählt erst das erneute Berühren
  let armed = (contactAt(0)?.gap ?? Infinity) > 0
  for (let i = 1; i <= n; i++) {
    const t = Math.min(duration, i * STEP)
    const tPrev = Math.min(duration, (i - 1) * STEP)
    const dt = t - tPrev
    if (dt <= 0) break
    const cur = posAt(t)
    const v: V3 = [(cur.x - prev.x) / dt, (cur.y - prev.y) / dt, (cur.z - prev.z) / dt]
    let best: Collision | null = null

    // Netz und Antennen: beim Durchqueren der Netzebene
    const a = prev.x
    const b = cur.x
    if (a !== 0 && a * b <= 0 && a !== b) {
      const f = a / (a - b)
      const hit = netHit(prev.y + f * (cur.y - prev.y), prev.z + f * (cur.z - prev.z), v, netHeight)
      if (hit) best = { ...hit, t: tPrev + f * dt }
    }

    // Blocker: erste Berührung genau bestimmen (Bisektion zwischen den Schritten)
    if (blockers.length) {
      const c = contactAt(t)
      const gap = c?.gap ?? Infinity
      if (!armed && gap > 0) armed = true
      if (armed && c && gap <= 0) {
        let lo = tPrev
        let hi = t
        for (let k = 0; k < 14; k++) {
          const mid = (lo + hi) / 2
          if ((contactAt(mid)?.gap ?? Infinity) <= 0) hi = mid
          else lo = mid
        }
        const tc = hi
        if (!best || tc < best.t) {
          const ball = posAt(tc)
          const p = v3(ball)
          const hitC = contactAt(tc)!
          // Ballgeschwindigkeit und Geschwindigkeit der Hand am Treffpunkt (gleiche Stelle der Kapsel kurz davor)
          const h = 0.004
          const pb = v3(posAt(Math.max(0, tc - h)))
          const vBall: V3 = [(p[0] - pb[0]) / h, (p[1] - pb[1]) / h, (p[2] - pb[2]) / h]
          let vHand: V3 = [0, 0, 0]
          const fn = blockers.find((f) => f(t0 + tc, ball)?.key === hitC.key)
          const before = fn?.(t0 + tc - 0.01, posAt(Math.max(0, tc - 0.01)))
          const capB = before?.caps[hitC.cap]
          if (capB) {
            const qb = pointOnCap(capB, hitC.u, hitC.s)
            vHand = [(hitC.q[0] - qb[0]) / 0.01, (hitC.q[1] - qb[1]) / 0.01, (hitC.q[2] - qb[2]) / 0.01]
          }
          const out = blockBounce(p, vBall, hitC.q, vHand)
          const d = BALL_RADIUS + hitC.r + 0.002
          best = {
            t: tc,
            kind: 'block',
            by: hitC.key,
            p: [hitC.q[0] + out.n[0] * hitC.r, hitC.q[1] + out.n[1] * hitC.r, hitC.q[2] + out.n[2] * hitC.r],
            vIn: vBall,
            pOut: [hitC.q[0] + out.n[0] * d, hitC.q[1] + out.n[1] * d, hitC.q[2] + out.n[2] * d],
            vOut: out.v
          }
        }
      }
    }
    if (best) return best
    prev = cur
  }
  return null
}

/* ---------- Freier Flug mit Drall ---------- */

/** Reibungszahl Ball–Hallenboden */
export const FLOOR_FRICTION = 0.55
/** Rollwiderstand (m/s²), sobald der Ball rollt */
const ROLL_DECEL = 0.6
/** Hohlkugel: Trägheitsmoment I = 2/3·m·r² → Anteil der Masse, der beim Abbremsen des Rutschens wirkt */
const SLIP_MASS = 1 / (1 + 3 / 2)
const FLIGHT_DT = 1 / 240
const FLIGHT_MAX = 8

/** Quaternion (x, y, z, w): q = d · q */
function rotate(q: number[], w: V3, dt: number): void {
  const om = len(w)
  const ang = om * dt
  if (ang < 1e-9) return
  const s = Math.sin(ang / 2) / om
  const dx = w[0] * s
  const dy = w[1] * s
  const dz = w[2] * s
  const dw = Math.cos(ang / 2)
  const [x, y, z, ww] = q
  q[0] = dw * x + dx * ww + dy * z - dz * y
  q[1] = dw * y - dx * z + dy * ww + dz * x
  q[2] = dw * z + dx * y - dy * x + dz * ww
  q[3] = dw * ww - dx * x - dy * y - dz * z
}

/**
 * Bodenkontakt mit Drall (Impulsmodell): senkrecht die Stoßzahl, waagerecht Reibung am Berührpunkt.
 * Der Berührpunkt rutscht mit u = v + ω × (−r·ẑ). Die Reibung (höchstens μ·Normalimpuls) bremst dieses Rutschen –
 * bis der Ball rollt – und ändert dabei Tempo und Drall: Topspin springt flacher und schneller weiter,
 * Rückwärtsdrall wird gebremst oder springt sogar zurück, Seitendrall lenkt ab. Der Drall um die senkrechte Achse
 * verliert etwas.
 */
export function floorBounce(v: V3, w: V3): { v: V3; w: V3 } {
  const R = BALL_RADIUS
  const impact = Math.max(0, -v[2])
  const vz = impact * BOUNCE_RESTITUTION
  const ux = v[0] - R * w[1]
  const uy = v[1] + R * w[0]
  const us = Math.hypot(ux, uy)
  let vx = v[0]
  let vy = v[1]
  const nw: V3 = [w[0], w[1], w[2] * 0.85]
  if (us > 1e-6) {
    const J = Math.min(FLOOR_FRICTION * (1 + BOUNCE_RESTITUTION) * impact, SLIP_MASS * us)
    const dvx = (-J * ux) / us
    const dvy = (-J * uy) / us
    vx += dvx
    vy += dvy
    nw[0] += (3 / (2 * R)) * dvy
    nw[1] -= (3 / (2 * R)) * dvx
  }
  return { v: [vx, vy, vz], w: nw }
}

/**
 * Freier Flug nach einem Abprall: Schwerkraft, Luftwiderstand und Magnus-Kraft, Aufspringen auf dem Boden
 * (Stoßzahl, Reibung, Drall), Rutschen und Ausrollen – und das Netz bleibt ein Hindernis.
 * Endet `duration` Sekunden nach dem ersten Bodenkontakt (ohne `bounce` direkt beim ersten Bodenkontakt).
 * Die Spur enthält die Drehung des Balls (Quaternion je Abtastung, seit Beginn), damit er sichtbar richtig rollt.
 */
export function freeFlight(
  p0: V3,
  v0: V3,
  w0: V3,
  opt: { netHeight: number; bounce: boolean; duration: number }
): { track: Track; events: BallEvent[]; tFloor: number | null } {
  const R = BALL_RADIUS
  let p: V3 = [...p0]
  let v: V3 = [...v0]
  let w: V3 = [...w0]
  const q = [0, 0, 0, 1]
  let t = 0
  let rolling = false
  let tFloor: number | null = null
  const ts = [0]
  const ps: V3[] = [[...p]]
  const qs: number[] = [...q]
  const events: BallEvent[] = []
  const dt = FLIGHT_DT
  while (t < FLIGHT_MAX) {
    if (rolling) {
      const ux = v[0] - R * w[1]
      const uy = v[1] + R * w[0]
      const us = Math.hypot(ux, uy)
      if (us > 0.01) {
        // Rutscht noch: Gleitreibung bringt Tempo und Drall zusammen
        const dv = Math.min(FLOOR_FRICTION * G * dt, us * SLIP_MASS)
        const dvx = (-dv * ux) / us
        const dvy = (-dv * uy) / us
        v = [v[0] + dvx, v[1] + dvy, 0]
        w = [w[0] + (3 / (2 * R)) * dvy, w[1] - (3 / (2 * R)) * dvx, w[2]]
      } else {
        // Rollt: Rollwiderstand, Drall passt genau zum Tempo
        const sp = Math.hypot(v[0], v[1])
        const ns = Math.max(0, sp - ROLL_DECEL * dt)
        v = sp > 0 ? [(v[0] / sp) * ns, (v[1] / sp) * ns, 0] : [0, 0, 0]
        w = [-v[1] / R, v[0] / R, w[2]]
      }
      w[2] *= Math.exp(-2 * dt)
      p = [p[0] + v[0] * dt, p[1] + v[1] * dt, 0]
    } else {
      const sp = len(v)
      const k = DRAG_K * sp
      const m = cross3(w, v)
      v = [
        v[0] + (-k * v[0] + MAGNUS_K * m[0]) * dt,
        v[1] + (-k * v[1] + MAGNUS_K * m[1]) * dt,
        v[2] + (-G - k * v[2] + MAGNUS_K * m[2]) * dt
      ]
      const np: V3 = [p[0] + v[0] * dt, p[1] + v[1] * dt, p[2] + v[2] * dt]
      // Netz im Weg?
      if (p[0] !== 0 && p[0] * np[0] < 0) {
        const f = p[0] / (p[0] - np[0])
        const hit = netHit(p[1] + f * (np[1] - p[1]), p[2] + f * (np[2] - p[2]), v, opt.netHeight)
        if (hit) {
          events.push({ t: t + f * dt, kind: hit.kind, x: hit.p[0], y: hit.p[1], z: hit.p[2], speed: len(v), dir: Math.sign(v[0]) || 1 })
          np[0] = hit.pOut[0]
          np[1] = hit.pOut[1]
          np[2] = hit.pOut[2]
          v = [...hit.vOut]
          w = scaleSpin(w, hit.kind)
        }
      }
      p = np
      if (p[2] <= 0) {
        const impact = Math.abs(v[2])
        p[2] = 0
        if (impact > 0.6) events.push({ t: t + dt, kind: 'boden', x: p[0], y: p[1], z: 0, speed: len(v) })
        const b = floorBounce(v, w)
        v = b.v
        w = b.w
        if (tFloor === null) tFloor = t + dt
        if (v[2] < 0.3) {
          rolling = true
          v[2] = 0
        }
      }
    }
    rotate(q, w, dt)
    t += dt
    ts.push(t)
    ps.push([...p])
    qs.push(q[0], q[1], q[2], q[3])
    if (tFloor !== null && (!opt.bounce || t >= tFloor + opt.duration)) break
  }
  const n = ts.length
  const track: Track = { t: new Float64Array(n), x: new Float64Array(n), y: new Float64Array(n), z: new Float64Array(n), q: Float64Array.from(qs) }
  for (let i = 0; i < n; i++) {
    track.t[i] = ts[i]
    track.x[i] = ps[i][0]
    track.y[i] = ps[i][1]
    track.z[i] = ps[i][2]
  }
  return { track, events, tFloor }
}

/** Wie viel Drall nach einem Hindernis bleibt */
function scaleSpin(w: V3, kind: HitKind): V3 {
  const k = kind === 'block' ? 0.35 : kind === 'netz' ? 0.2 : kind === 'netzkante' ? 0.5 : 0.6
  return [w[0] * k, w[1] * k, w[2] * k]
}

/** Drall eines Flugs (Welt, rad/s): Schlag aus der Simulation, Annahme/Zuspiel als Rückwärtsdrall quer zur Flugrichtung */
export function spinOf(seg: Segment<string>): V3 {
  if (seg.asol) {
    const a = seg.asol.spinAxis
    return [a.x * seg.asol.spinRate, a.y * seg.asol.spinRate, a.z * seg.asol.spinRate]
  }
  if (seg.sol && (seg.type === 'annahme' || seg.type === 'zuspiel')) {
    const { dx, dy } = seg.sol.dir
    const rate = -2 * Math.PI * SPIN_RPS[seg.type]
    return [-dy * rate, dx * rate, 0]
  }
  return [0, 0, 0]
}

/** Abfluggeschwindigkeit eines Flugs (m/s) */
function launchSpeed(seg: Segment<RallyType>): number {
  if (seg.sol) return Math.hypot(seg.sol.vH, seg.sol.vZ0)
  if (seg.asol) return seg.asol.speed
  return 0
}

/** Baut den Ballwechsel: Flüge nacheinander, mit Netz-, Antennen- und Blockkontakt, Abprall und Ereignissen. */
export function buildRally(input: RallyInput): Rally {
  const base = buildTimeline(input.items)
  const segments: Segment<RallyType>[] = []
  const events: BallEvent[] = []
  let deflection: Rally['deflection'] = null
  let fault: Rally['fault'] = null
  const flightOpt = { netHeight: input.netHeight, bounce: input.bounce, duration: input.bounceDuration }

  const append = (type: RallyType, p: V3, v: V3, w: V3, t0: number, kind?: HitKind) => {
    const ff = freeFlight(p, v, w, flightOpt)
    const T = ff.track.t[ff.track.t.length - 1]
    if (T > 1e-6) segments.push({ type: 'abprall', track: ff.track, t0, t1: t0 + T })
    for (const e of ff.events) {
      events.push({ ...e, t: t0 + e.t })
      if (e.kind === 'antenne' && !fault) fault = { t: t0 + e.t, reason: 'antenne' }
    }
    if (kind) {
      // Weg nach dem Treffer bis zum ersten Bodenkontakt (zum Zeichnen)
      const end = ff.tFloor ?? T
      const points: P3[] = []
      for (let i = 0; i < ff.track.t.length && ff.track.t[i] <= end + 1e-9; i += 4) points.push({ x: ff.track.x[i], y: ff.track.y[i], z: ff.track.z[i] })
      deflection = { type, kind, points }
    }
  }

  for (const seg of base.segments) {
    const start = segmentPosition(seg, 0)
    events.push({ t: seg.t0, kind: seg.type as BallEventKind, ...start, speed: launchSpeed(seg), ...(seg.attack?.finte ? { finte: true } : {}) })
    const dur = seg.t1 - seg.t0
    const col = findCollision((t) => segmentPosition(seg, t), dur, seg.t0, input.netHeight, seg.type === 'schlag' ? input.blockers : [])
    if (col) {
      const tc = seg.t0 + col.t
      segments.push({ ...seg, t1: tc })
      events.push({ t: tc, kind: col.kind, x: col.p[0], y: col.p[1], z: col.p[2], speed: len(col.vIn), dir: Math.sign(col.vIn[0]) || 1, ...(col.by ? { by: col.by } : {}) })
      if (col.kind === 'antenne' && !fault) fault = { t: tc, reason: 'antenne' }
      append(seg.type, col.pOut, col.vOut, scaleSpin(spinOf(seg), col.kind), tc, col.kind)
      // Der Ball ist aus dem Spiel: spätere Flüge finden nicht mehr statt
      break
    }
    segments.push(seg)
    // Schlag auf den Boden: Aufprall und Abprall (mit dem Drall des Schlags)
    if (seg.type === 'schlag' && seg.asol) {
      const a = seg.asol
      const i = Math.max(1, Math.min(a.t.length - 1, a.iHit))
      const dt = Math.max(1e-6, a.t[i] - a.t[i - 1])
      const v: V3 = [(a.x[i] - a.x[i - 1]) / dt, (a.y[i] - a.y[i - 1]) / dt, Math.min(-0.01, (a.z[i] - a.z[i - 1]) / dt)]
      append('schlag', [a.landing.x, a.landing.y, 0], v, spinOf(seg), seg.t1)
    }
  }
  events.sort((a, b) => a.t - b.t)
  const total = segments.length ? segments[segments.length - 1].t1 : 0
  return { timeline: { segments, total }, events, deflection, fault }
}
