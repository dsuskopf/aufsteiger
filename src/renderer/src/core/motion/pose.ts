/**
 * Körperhaltung der Spielerfigur zu jedem Zeitpunkt (reine Logik, ohne Three.js).
 *
 * Die Haltung ist eine reine Funktion der Zeit – so stimmt sie beim Abspielen, beim Ziehen an der Zeitleiste
 * und Bild für Bild. Sie setzt sich zusammen aus: Grundhaltung (bereit) bzw. Lauf, Sprung (Ausholen, Flug, Landung)
 * und den Aktionen am Ball (Bagger, Pritschen, Schlag, Block). Hände und Füße werden als Ziele vorgegeben,
 * Ellbogen und Knie ergeben sich daraus (Zwei-Gelenk-Kinematik) – so greifen die Hände wirklich zum Ball.
 *
 * Lokales Koordinatensystem der Figur: x nach vorn, y nach oben, z nach rechts; Ursprung zwischen den Füßen.
 */
import { BALL_RADIUS } from '../physics/trajectory'
import { BLOCK_FORWARD, BODY, REACH_BLOCK } from './body'
import { jumpAirtime } from './motion'
import { mixAngle, planAt, planRun, type PlayerAction, type PlayerPlan } from './plan'

export type V3 = [number, number, number]

/** Haltung als Ziele (Meter, lokal) */
interface Pose {
  pelvisX: number
  pelvisY: number
  /** Oberkörper nach vorn geneigt (rad) */
  lean: number
  /** Schulterachse verdreht (rad, positiv = rechte Schulter zurück) */
  twist: number
  handL: V3
  handR: V3
  /** Richtung, in die der Ellbogen ausweicht */
  poleL: V3
  poleR: V3
  /** Handflächen zeigen in diese Richtung */
  palmL: V3
  palmR: V3
  footL: V3
  footR: V3
}

/** Fertige Figur: Lage in der Welt und Gelenke im lokalen System */
export interface Skeleton {
  /** Welt: x, y am Boden, z = Höhe der Füße (Sprung), yaw = Blickrichtung */
  root: { x: number; y: number; z: number; yaw: number }
  H: number
  pelvis: V3
  chest: V3
  head: V3
  shoulderL: V3
  shoulderR: V3
  elbowL: V3
  elbowR: V3
  wristL: V3
  wristR: V3
  handL: V3
  handR: V3
  palmL: V3
  palmR: V3
  hipL: V3
  hipR: V3
  kneeL: V3
  kneeR: V3
  footL: V3
  footR: V3
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const mix = (a: number, b: number, k: number) => a + (b - a) * k
const mix3 = (a: V3, b: V3, k: number): V3 => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)]
/** Weicher Übergang 0 → 1 zwischen a und b */
const ss = (a: number, b: number, x: number) => {
  const u = clamp((x - a) / (b - a), 0, 1)
  return u * u * (3 - 2 * u)
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const norm = (a: V3): V3 => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

function mixPose(a: Pose, b: Pose, k: number): Pose {
  if (k <= 0) return a
  if (k >= 1) return b
  return {
    pelvisX: mix(a.pelvisX, b.pelvisX, k),
    pelvisY: mix(a.pelvisY, b.pelvisY, k),
    lean: mix(a.lean, b.lean, k),
    twist: mix(a.twist, b.twist, k),
    handL: mix3(a.handL, b.handL, k),
    handR: mix3(a.handR, b.handR, k),
    poleL: mix3(a.poleL, b.poleL, k),
    poleR: mix3(a.poleR, b.poleR, k),
    palmL: mix3(a.palmL, b.palmL, k),
    palmR: mix3(a.palmR, b.palmR, k),
    footL: mix3(a.footL, b.footL, k),
    footR: mix3(a.footR, b.footR, k)
  }
}

/** Zwei-Gelenk-Kinematik: Lage des mittleren Gelenks (Ellbogen/Knie) und des erreichbaren Endpunkts */
export function twoBone(root: V3, target: V3, l1: number, l2: number, pole: V3): { mid: V3; end: V3 } {
  let d = sub(target, root)
  let dist = len(d)
  if (dist < 1e-6) {
    d = [0, -1, 0]
    dist = 1e-6
  }
  const dir = mul(d, 1 / dist)
  const reach = clamp(dist, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4)
  const a = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
  // Ausweichrichtung senkrecht zur Verbindung
  let p = sub(pole, mul(dir, dot(pole, dir)))
  if (len(p) < 1e-6) p = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  p = norm(sub(p, mul(dir, dot(p, dir))))
  return { mid: add(add(root, mul(dir, a)), mul(p, h)), end: add(root, mul(dir, reach)) }
}

/** Bereit: leicht in den Knien, Arme locker vor dem Körper */
function ready(H: number): Pose {
  return {
    pelvisX: 0,
    pelvisY: 0.495 * H,
    lean: 0.22,
    twist: 0,
    handL: [0.2 * H, 0.5 * H, -0.12 * H],
    handR: [0.2 * H, 0.5 * H, 0.12 * H],
    poleL: [-0.4, -0.5, -0.8],
    poleR: [-0.4, -0.5, 0.8],
    palmL: [0.2, -0.6, 0.7],
    palmR: [0.2, -0.6, -0.7],
    footL: [0.02 * H, BODY.ankle * H, -0.115 * H],
    footR: [-0.02 * H, BODY.ankle * H, 0.115 * H]
  }
}

/** Lauf: Beine im Wechsel, Arme gegengleich; phase aus der gelaufenen Strecke */
function run(H: number, phase: number, amp: number): Pose {
  const s = Math.sin(phase)
  const c = Math.cos(phase)
  const stride = 0.21 * H * amp
  const lift = 0.13 * H * amp
  return {
    pelvisX: 0,
    pelvisY: (0.5 + 0.012 * Math.cos(2 * phase)) * H,
    lean: 0.2 + 0.14 * amp,
    twist: -0.18 * s * amp,
    handL: [(0.05 - 0.17 * s * amp) * H, (0.57 + 0.03 * Math.abs(s)) * H, -0.16 * H],
    handR: [(0.05 + 0.17 * s * amp) * H, (0.57 + 0.03 * Math.abs(s)) * H, 0.16 * H],
    poleL: [-0.8, -0.3, -0.5],
    poleR: [-0.8, -0.3, 0.5],
    palmL: [0, 0, 1],
    palmR: [0, 0, -1],
    footL: [stride * s, BODY.ankle * H + lift * Math.max(0, c), -0.07 * H],
    footR: [-stride * s, BODY.ankle * H + lift * Math.max(0, -c), 0.07 * H]
  }
}

/** Bagger (Annahme): Arme gestreckt zur Plattform unter dem Ball, tief in den Knien; s = Zeit seit dem Kontakt */
function bagger(base: Pose, H: number, B: V3, s: number): Pose {
  const pre = ss(-0.28, 0, s)
  const follow = ss(0, 0.3, s)
  const hx = B[0] + 0.06 + follow * 0.08
  const hy = Math.max(0.18, B[1] - BALL_RADIUS - 0.03 - (1 - pre) * 0.1 + follow * 0.15)
  const lean = 0.38
  const pelvisY = clamp(hy - 0.03 * H + 0.02, 0.3 * H, 0.5 * H)
  // Becken so weit zurück, dass die Arme fast gestreckt sind
  const arm = (BODY.upperArm + BODY.foreArm + BODY.palm) * H * 0.96
  const dy = pelvisY + Math.cos(lean) * BODY.spine * H - hy
  const dx = Math.sqrt(Math.max(0.01, arm * arm - dy * dy))
  const pelvisX = clamp(hx - dx - Math.sin(lean) * BODY.spine * H, -0.16 * H, 0.1 * H)
  return {
    ...base,
    pelvisX,
    pelvisY,
    lean,
    twist: 0,
    handL: [hx, hy, B[2] - 0.028 * H],
    handR: [hx, hy, B[2] + 0.028 * H],
    poleL: [-0.2, -1, -0.5],
    poleR: [-0.2, -1, 0.5],
    palmL: [0, 1, 0.2],
    palmR: [0, 1, -0.2],
    footL: [0.06 * H, BODY.ankle * H, -0.17 * H],
    footR: [-0.03 * H, BODY.ankle * H, 0.17 * H]
  }
}

/** Pritschen (Zuspiel): Hände über der Stirn, am Ball, dann in Spielrichtung gestreckt */
function pritschen(base: Pose, H: number, B: V3, s: number): Pose {
  const toBall = ss(-0.3, -0.02, s)
  const push = ss(0, 0.16, s)
  const preL: V3 = [0.11 * H, 1.03 * H, -0.075 * H]
  const preR: V3 = [0.11 * H, 1.03 * H, 0.075 * H]
  const atL: V3 = [B[0] - 0.035 + push * 0.14, B[1] - 0.05 + push * 0.2, B[2] - 0.095]
  const atR: V3 = [B[0] - 0.035 + push * 0.14, B[1] - 0.05 + push * 0.2, B[2] + 0.095]
  return {
    ...base,
    pelvisY: base.pelvisY + (0.02 * push - 0.03 * (1 - toBall)) * H,
    lean: -0.04,
    twist: 0,
    handL: mix3(preL, atL, toBall),
    handR: mix3(preR, atR, toBall),
    poleL: [0.3, -0.35, -1],
    poleR: [0.3, -0.35, 1],
    palmL: [0.55, 0.65, 0.5],
    palmR: [0.55, 0.65, -0.5]
  }
}

/** Schlag: Ausholen, beide Arme hoch, Schlagarm zurück, Treffen, Durchschwingen */
function schlag(base: Pose, H: number, B: V3, s: number): Pose {
  type Key = { s: number; lean: number; twist: number; L: V3; R: V3; poleR: V3; palmR: V3 }
  const keys: Key[] = [
    { s: -0.62, lean: 0.34, twist: 0, L: [-0.2 * H, 0.43 * H, -0.17 * H], R: [-0.2 * H, 0.43 * H, 0.17 * H], poleR: [-0.6, -0.4, 0.7], palmR: [0, 0, -1] },
    { s: -0.3, lean: -0.06, twist: 0.1, L: [0.17 * H, 1.17 * H, -0.1 * H], R: [0.04 * H, 1.14 * H, 0.14 * H], poleR: [0.2, -0.3, 1], palmR: [1, 0, 0] },
    { s: -0.12, lean: -0.16, twist: 0.5, L: [0.2 * H, 1.04 * H, -0.09 * H], R: [-0.15 * H, 1.0 * H, 0.18 * H], poleR: [-0.5, 0.35, 0.8], palmR: [0.9, 0.3, 0] },
    { s: 0, lean: 0.1, twist: -0.28, L: [0.13 * H, 0.64 * H, -0.15 * H], R: [B[0] - 0.07, B[1] + 0.01, B[2]], poleR: [-0.1, -0.1, 1], palmR: [1, -0.25, 0] },
    { s: 0.17, lean: 0.3, twist: -0.5, L: [0.05 * H, 0.5 * H, -0.16 * H], R: [0.27 * H, 0.52 * H, -0.02 * H], poleR: [-0.3, -0.5, 0.8], palmR: [0.3, -0.9, 0] },
    { s: 0.55, lean: base.lean, twist: 0, L: base.handL, R: base.handR, poleR: base.poleR, palmR: base.palmR }
  ]
  let i = 0
  while (i < keys.length - 2 && s > keys[i + 1].s) i++
  const a = keys[i]
  const b = keys[i + 1]
  const k = ss(a.s, b.s, s)
  return {
    ...base,
    lean: mix(a.lean, b.lean, k),
    twist: mix(a.twist, b.twist, k),
    handL: mix3(a.L, b.L, k),
    handR: mix3(a.R, b.R, k),
    poleL: [0.2, -0.4, -1],
    poleR: mix3(a.poleR, b.poleR, k),
    palmL: [0.6, 0, 0.6],
    palmR: mix3(a.palmR, b.palmR, k)
  }
}

/**
 * Finte: Ausholen wie zum Schlag, dann aber gestreckter Arm und nur ein Tippen mit den Fingern über den Block.
 * Der Oberkörper bleibt ruhig, kein Durchschwingen.
 */
function tip(base: Pose, H: number, B: V3, s: number): Pose {
  type Key = { s: number; lean: number; twist: number; L: V3; R: V3; palmR: V3 }
  const keys: Key[] = [
    { s: -0.62, lean: 0.3, twist: 0, L: [-0.2 * H, 0.43 * H, -0.17 * H], R: [-0.2 * H, 0.43 * H, 0.17 * H], palmR: [0, 0, -1] },
    { s: -0.3, lean: -0.06, twist: 0.1, L: [0.17 * H, 1.15 * H, -0.1 * H], R: [0.04 * H, 1.14 * H, 0.13 * H], palmR: [1, 0, 0] },
    { s: -0.08, lean: -0.04, twist: 0.12, L: [0.16 * H, 0.95 * H, -0.12 * H], R: [B[0] - 0.12, B[1] - 0.04, B[2]], palmR: [0.7, 0.7, 0] },
    { s: 0, lean: 0, twist: 0.05, L: [0.15 * H, 0.85 * H, -0.13 * H], R: [B[0] - 0.06, B[1] - 0.01, B[2]], palmR: [0.75, 0.65, 0] },
    { s: 0.14, lean: 0.06, twist: 0, L: [0.12 * H, 0.7 * H, -0.14 * H], R: [B[0] + 0.07, B[1] + 0.05, B[2]], palmR: [0.9, 0.2, 0] },
    { s: 0.5, lean: base.lean, twist: 0, L: base.handL, R: base.handR, palmR: base.palmR }
  ]
  let i = 0
  while (i < keys.length - 2 && s > keys[i + 1].s) i++
  const a = keys[i]
  const b = keys[i + 1]
  const k = ss(a.s, b.s, s)
  return {
    ...base,
    lean: mix(a.lean, b.lean, k),
    twist: mix(a.twist, b.twist, k),
    handL: mix3(a.L, b.L, k),
    handR: mix3(a.R, b.R, k),
    poleL: [0.2, -0.4, -1],
    poleR: [-0.2, -0.3, 1],
    palmL: [0.6, 0, 0.6],
    palmR: mix3(a.palmR, b.palmR, k)
  }
}

/** Block: Hände vor der Brust, dann beide Arme gestreckt nach oben und leicht über das Netz */
function block(base: Pose, H: number, s: number): Pose {
  const up = ss(-0.42, -0.14, s) * (1 - ss(0.16, 0.42, s))
  const lowL: V3 = [0.15 * H, 0.9 * H, -0.09 * H]
  const lowR: V3 = [0.15 * H, 0.9 * H, 0.09 * H]
  const highL: V3 = [BLOCK_FORWARD * H, REACH_BLOCK * H, -0.105 * H]
  const highR: V3 = [BLOCK_FORWARD * H, REACH_BLOCK * H, 0.105 * H]
  return {
    ...base,
    lean: mix(0.08, 0.02, up),
    twist: 0,
    handL: mix3(lowL, highL, up),
    handR: mix3(lowR, highR, up),
    poleL: [0.3, -0.3, -1],
    poleR: [0.3, -0.3, 1],
    palmL: [1, mix(0.2, -0.25, up), 0],
    palmR: [1, mix(0.2, -0.25, up), 0]
  }
}

/** Zeitfenster der Aktionen relativ zum Kontakt: [Beginn Einblenden, voll, Beginn Ausblenden, Ende] */
const WINDOW: Record<PlayerAction['kind'], [number, number, number, number]> = {
  annahme: [-0.5, -0.25, 0.25, 0.55],
  zuspiel: [-0.55, -0.3, 0.25, 0.5],
  schlag: [-0.95, -0.7, 0.4, 0.7],
  fake: [-0.95, -0.7, 0.4, 0.7],
  block: [-0.75, -0.5, 0.42, 0.7]
}

/** Wie stark die Aktion die Haltung zur Zeit t bestimmt (0–1) */
export function actionWeight(a: PlayerAction, t: number): number {
  const w = WINDOW[a.kind]
  const s = t - a.t
  return ss(w[0], w[1], s) * (1 - ss(w[2], w[3], s))
}

/** Blickrichtung des Spielers zur Zeit t */
export function planYaw(plan: PlayerPlan, t: number, ball: { x: number; y: number } | null, at = planAt(plan, t)): number {
  let yaw = plan.netYaw
  // Blick zum Ball (nicht, wenn er direkt über einem ist)
  if (ball) {
    const dx = ball.x - at.x
    const dy = ball.y - at.y
    const d = Math.hypot(dx, dy)
    if (d > 0.4) yaw = mixAngle(yaw, Math.atan2(dy, dx), 0.7 * clamp((d - 0.4) / 1.2, 0, 1))
  }
  // Beim Laufen in Laufrichtung
  const r = planRun(plan, t)
  if (r.dir && r.w > 0) yaw = mixAngle(yaw, Math.atan2(r.dir.y, r.dir.x), r.w * clamp(r.speed / 3, 0, 1) * 0.9)
  // Am Ball in Spielrichtung
  for (const a of plan.actions) {
    const s = t - a.t
    const w = ss(-0.85, -0.35, s) * (1 - ss(0.4, 0.85, s))
    if (w > 0) yaw = mixAngle(yaw, a.yaw, w)
  }
  return yaw
}

/** Figur des Spielers zur Zeit t; ball = aktuelle Ballposition (für die Blickrichtung) */
export function skeletonAt(plan: PlayerPlan, t: number, ball: { x: number; y: number } | null): Skeleton {
  const H = plan.height
  const at = planAt(plan, t)
  const yaw = planYaw(plan, t, ball, at)
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const toLocal = (p: { x: number; y: number; z: number }): V3 => {
    const dx = p.x - at.x
    const dy = p.y - at.y
    return [dx * cos + dy * sin, p.z - at.z, dx * sin - dy * cos]
  }

  // Grundhaltung und Lauf
  const r = planRun(plan, t)
  const amp = clamp(r.speed / 4.5, 0.45, 1.25)
  let pose = mixPose(ready(H), run(H, (r.dist / (0.82 * H)) * Math.PI, amp), r.w * clamp(r.speed / 1.5, 0, 1))

  // Sprung: Ausholen, Flug, Landung
  for (const j of plan.jumps) {
    const a = t - j.at
    const T = jumpAirtime(j.height)
    const dip = ss(-0.3, -0.1, a) * (1 - ss(-0.1, 0.02, a)) + ss(T - 0.02, T + 0.08, a) * (1 - ss(T + 0.08, T + 0.32, a)) * 0.8
    const air = ss(0, 0.1, a) * (1 - ss(T - 0.1, T, a))
    if (dip <= 0 && air <= 0) continue
    pose = {
      ...pose,
      pelvisY: mix(pose.pelvisY - dip * 0.13 * H, 0.522 * H, air),
      footL: mix3(pose.footL, [-0.05 * H, (BODY.ankle + 0.015) * H, -0.075 * H], air),
      footR: mix3(pose.footR, [-0.03 * H, (BODY.ankle + 0.03) * H, 0.075 * H], air)
    }
  }

  // Aktionen am Ball
  for (const a of plan.actions) {
    const w = actionWeight(a, t)
    if (w <= 0) continue
    const s = t - a.t
    const B = toLocal(a.ball)
    const target =
      a.kind === 'annahme'
        ? bagger(pose, H, B, s)
        : a.kind === 'zuspiel'
          ? pritschen(pose, H, B, s)
          : a.kind === 'schlag'
            ? a.finte
              ? tip(pose, H, B, s)
              : schlag(pose, H, B, s)
            : a.kind === 'fake'
              ? schlag(pose, H, B, s)
              : block(pose, H, s)
    pose = mixPose(pose, target, w)
  }

  // Gelenke
  const pelvis: V3 = [pose.pelvisX, pose.pelvisY, 0]
  const chest: V3 = [pelvis[0] + Math.sin(pose.lean) * BODY.spine * H, pelvis[1] + Math.cos(pose.lean) * BODY.spine * H, 0]
  const head: V3 = [chest[0] + Math.sin(pose.lean * 0.5) * BODY.neck * H, chest[1] + Math.cos(pose.lean * 0.5) * BODY.neck * H, 0]
  // Frauen: schmalere Schultern, breitere Hüfte
  const sh = BODY.shoulderHalf * H * (plan.female ? 0.9 : 1)
  const off: V3 = [-Math.sin(pose.twist) * sh, 0, Math.cos(pose.twist) * sh]
  const shrug = (hand: V3) => 0.03 * H * clamp((hand[1] - chest[1]) / (0.25 * H), 0, 1)
  const shoulderL: V3 = [chest[0] - off[0], chest[1] + shrug(pose.handL), chest[2] - off[2]]
  const shoulderR: V3 = [chest[0] + off[0], chest[1] + shrug(pose.handR), chest[2] + off[2]]
  const l1 = BODY.upperArm * H
  const l2 = (BODY.foreArm + BODY.palm) * H
  const armL = twoBone(shoulderL, pose.handL, l1, l2, pose.poleL)
  const armR = twoBone(shoulderR, pose.handR, l1, l2, pose.poleR)
  const wrist = (elbow: V3, hand: V3) => mix3(elbow, hand, BODY.foreArm / (BODY.foreArm + BODY.palm))
  const hh = BODY.hipHalf * H * (plan.female ? 1.15 : 1)
  const hipL: V3 = [pelvis[0], pelvis[1], -hh]
  const hipR: V3 = [pelvis[0], pelvis[1], hh]
  const legL = twoBone(hipL, pose.footL, BODY.thigh * H, BODY.shin * H, [1, 0.1, -0.12])
  const legR = twoBone(hipR, pose.footR, BODY.thigh * H, BODY.shin * H, [1, 0.1, 0.12])

  return {
    root: { x: at.x, y: at.y, z: at.z, yaw },
    H,
    pelvis,
    chest,
    head,
    shoulderL,
    shoulderR,
    elbowL: armL.mid,
    elbowR: armR.mid,
    wristL: wrist(armL.mid, armL.end),
    wristR: wrist(armR.mid, armR.end),
    handL: armL.end,
    handR: armR.end,
    palmL: norm(pose.palmL),
    palmR: norm(pose.palmR),
    hipL,
    hipR,
    kneeL: legL.mid,
    kneeR: legR.mid,
    footL: legL.end,
    footR: legR.end
  }
}

/** Handmitte in Weltkoordinaten (für Tests und Effekte) */
/** Gelenk (lokal) → Welt */
export function jointWorld(sk: Skeleton, v: V3): V3 {
  const c = Math.cos(sk.root.yaw)
  const s = Math.sin(sk.root.yaw)
  return [sk.root.x + v[0] * c + v[2] * s, sk.root.y + v[0] * s - v[2] * c, sk.root.z + v[1]]
}

/** Richtung (lokal) → Welt */
export function dirWorld(sk: Skeleton, v: V3): V3 {
  const c = Math.cos(sk.root.yaw)
  const s = Math.sin(sk.root.yaw)
  return [v[0] * c + v[2] * s, v[0] * s - v[2] * c, v[1]]
}

/** Trefferfläche: Strecke a–b mit Radius r, mit w als flache Platte (halbe Breite) */
export interface BodyCap {
  a: V3
  b: V3
  r: number
  w?: V3
}

/** Abstand, bis zu dem sich die Lücke zwischen zwei Händen schließt (m) – durch geschlossene Hände passt kein Ball */
export const HAND_GAP_CLOSE = 0.45

/** Hand als flache Platte: vom Handgelenk bis zu den Fingerspitzen, so breit wie die gespreizten Finger */
function handPlate(sk: Skeleton, elbow: V3, wrist: V3, hand: V3, palm: V3): BodyCap & { c: V3 } {
  const H = sk.H
  const d = norm(sub(hand, elbow))
  const tip = add(hand, mul(d, BODY.hand * 0.55 * H))
  // Quer zur Hand, in der Handfläche
  let across = sub([d[1] * palm[2] - d[2] * palm[1], d[2] * palm[0] - d[0] * palm[2], d[0] * palm[1] - d[1] * palm[0]], [0, 0, 0])
  if (len(across) < 1e-6) across = [0, 0, 1]
  across = norm(sub(across, mul(d, dot(across, d))))
  const a = jointWorld(sk, wrist)
  const b = jointWorld(sk, tip)
  return { a, b, r: 0.012 * H, w: mul(dirWorld(sk, across), 0.036 * H), c: mul(add(a, b), 0.5) }
}

/**
 * Trefferflächen eines Spielers zur Zeit t (Welt): Ober- und Unterarme, Hände als flache Platten bis zu den
 * Fingerspitzen und der Kopf – genau dort, wo die Figur sie gerade hat. Liegen die Hände dicht beieinander (Block),
 * schließt eine Platte die Lücke dazwischen.
 */
export function bodyCapsules(plan: PlayerPlan, t: number, ball: { x: number; y: number } | null): BodyCap[] {
  const sk = skeletonAt(plan, t, ball)
  const H = sk.H
  const W = (v: V3) => jointWorld(sk, v)
  const hl = handPlate(sk, sk.elbowL, sk.wristL, sk.handL, sk.palmL)
  const hr = handPlate(sk, sk.elbowR, sk.wristR, sk.handR, sk.palmR)
  const caps: BodyCap[] = [
    { a: W(sk.shoulderL), b: W(sk.elbowL), r: 0.027 * H },
    { a: W(sk.shoulderR), b: W(sk.elbowR), r: 0.027 * H },
    { a: W(sk.elbowL), b: W(sk.wristL), r: 0.023 * H },
    { a: W(sk.elbowR), b: W(sk.wristR), r: 0.023 * H },
    { a: hl.a, b: hl.b, r: hl.r, w: hl.w },
    { a: hr.a, b: hr.b, r: hr.r, w: hr.w },
    { a: W(sk.head), b: W(sk.head), r: BODY.headR * H }
  ]
  const between = bridge(hl, hr)
  if (between) caps.push(between)
  return caps
}

/** Platte zwischen zwei Händen (auch von zwei Blockern), wenn sie dicht beieinander sind; sonst null */
export function bridge(p: { a: V3; b: V3; c: V3; r: number }, q: { a: V3; b: V3; c: V3; r: number }): BodyCap | null {
  const gap = sub(q.c, p.c)
  const dist = len(gap)
  if (dist < 1e-6 || dist > HAND_GAP_CLOSE) return null
  // Mittellinie der beiden Hände, Breite bis zu beiden Handmitten
  const a = mul(add(p.a, q.a), 0.5)
  const b = mul(add(p.b, q.b), 0.5)
  const axis = norm(sub(b, a))
  const w = mul(sub(gap, mul(axis, dot(gap, axis))), 0.5)
  return { a, b, r: Math.min(p.r, q.r), w }
}

/** Handplatten eines Spielers zur Zeit t (für die Lücke zwischen zwei Blockern) */
export function handPlates(plan: PlayerPlan, t: number, ball: { x: number; y: number } | null): (BodyCap & { c: V3 })[] {
  const sk = skeletonAt(plan, t, ball)
  return [handPlate(sk, sk.elbowL, sk.wristL, sk.handL, sk.palmL), handPlate(sk, sk.elbowR, sk.wristR, sk.handR, sk.palmR)]
}

export function handWorld(sk: Skeleton, which: 'L' | 'R'): { x: number; y: number; z: number } {
  const h = which === 'L' ? sk.handL : sk.handR
  const c = Math.cos(sk.root.yaw)
  const s = Math.sin(sk.root.yaw)
  return { x: sk.root.x + h[0] * c + h[2] * s, y: sk.root.y + h[0] * s - h[2] * c, z: sk.root.z + h[1] }
}
