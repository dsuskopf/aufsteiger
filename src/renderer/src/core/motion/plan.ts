/**
 * Bewegungsplan der Spieler für einen Spielzug (reine Logik).
 *
 * Ein Spieler kann an Ballkontakte gekoppelt sein (er nimmt an, stellt oder schlägt) und/oder blocken.
 * Daraus ergibt sich, was er wann tut:
 *  - Ohne eigenen Laufweg läuft er von selbst rechtzeitig zum Ball.
 *  - Ohne eigenen Sprung springt er so hoch, wie es der Ballkontakt verlangt (Sprungzuspiel, Angriff, Block).
 *  - Blocker springen so, dass ihr höchster Punkt mit dem Durchgang des Balls zusammenfällt.
 * Eigene Laufwege und Sprünge haben immer Vorrang.
 */
import { BALL_TYPES, type BallType, type Contacts, type CourtPlayer, type CourtSide, type Jump, type PlaySide, type RunPath, type Vec2 } from '@shared/types'
import { segmentPosition, type Timeline } from '../timeline/timeline'
import { BLOCK_FORWARD, REACH_ONE, REACH_SET } from './body'
import { JUMP_HEIGHT, RUN_SPEED, jumpAirtime, jumpRise, jumpZ, pathCurve, pathEnd, pointAtLength } from './motion'

/** Ballkontakt, Block oder Fake-Schlag (Schlagbewegung ohne Ball) */
export type ActionKind = BallType | 'block' | 'fake'

export interface PlayerAction {
  kind: ActionKind
  /** Zeitpunkt des Kontakts (Gesamtachse) */
  t: number
  /** Ball beim Kontakt (Block: wo der Ball die Hände erreicht, sonst über dem Netz) */
  ball: { x: number; y: number; z: number }
  /** Blickrichtung des Spielers beim Kontakt (Winkel in der Draufsicht) */
  yaw: number
  /** Schlag als Finte: Ball nur mit den Fingern über den Block getippt */
  finte?: boolean
}

/** Automatischer Lauf von a nach b */
export interface Leg {
  t0: number
  t1: number
  from: Vec2
  to: Vec2
}

export interface PlayerPlan {
  key: string
  side: CourtSide
  playerId: string
  /** Körpergröße (m) */
  height: number
  /** Weiblicher Körperbau (schmalere Schultern, breitere Hüfte) */
  female: boolean
  /** Platz in der Grundstellung */
  home: Vec2
  /** Blick zum Netz */
  netYaw: number
  /** Eigener Laufweg (hat Vorrang vor den automatischen Läufen) */
  path?: RunPath
  legs: Leg[]
  jumps: Jump[]
  /** Sprünge sind automatisch (aus den Ballkontakten) */
  autoJump: boolean
  actions: PlayerAction[]
}

export const planKey = (side: CourtSide, playerId: string) => `${side}:${playerId}`

const TAU = Math.PI * 2
/** Kürzester Weg von Winkel a nach b, Anteil k */
export function mixAngle(a: number, b: number, k: number): number {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return a + d * k
}

/** Blickrichtung beim Ballkontakt: Angriff und Zuspiel in Spielrichtung, die Annahme überwiegend zum Netz */
export function contactYaw(kind: BallType, netYaw: number, dir: { dx: number; dy: number }): number {
  const d = Math.atan2(dir.dy, dir.dx)
  return kind === 'annahme' ? mixAngle(netYaw, d, 0.35) : d
}

/** Lage des Balls relativ zum Spieler beim Kontakt: nach vorn (f) und nach rechts (r), in Metern */
export function ballOffset(kind: BallType, H: number, finte = false): { f: number; r: number } {
  if (kind === 'annahme') return { f: 0.27 * H, r: 0 }
  if (kind === 'zuspiel') return { f: 0.1 * H, r: 0 }
  // Finte: Arm gestreckt über dem Kopf, etwas weiter vorn
  if (finte) return { f: 0.13 * H, r: 0.07 * H }
  // Schlag: vor der rechten Schulter
  return { f: 0.16 * H, r: 0.1 * H }
}

/** Wo der Spieler stehen muss, um den Ball an dieser Stelle zu spielen */
export function standPoint(kind: BallType, ball: Vec2, yaw: number, H: number, finte = false): Vec2 {
  const o = ballOffset(kind, H, finte)
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return { x: ball.x - c * o.f - s * o.r, y: ball.y - s * o.f + c * o.r }
}

/** Nötige Sprunghöhe für einen Kontakt in Ballhöhe z (0 = aus dem Stand) */
export function neededJump(kind: ActionKind, z: number, H: number): number {
  if (kind === 'block') return JUMP_HEIGHT.default
  if (kind === 'fake') return FAKE_JUMP
  if (kind === 'annahme') return 0
  const need = kind === 'schlag' ? z - 0.06 - REACH_ONE * H : z - 0.05 - REACH_SET * H
  if (need < 0.08) return 0
  return Math.min(JUMP_HEIGHT.max, Math.max(JUMP_HEIGHT.min, need))
}

/** Ebene der Blockhände: vor dem Körper, höchstens 25 cm über das Netz hinaus */
export function handsPlaneX(px: number, netYaw: number, H: number): number {
  const face = Math.cos(netYaw) >= 0 ? 1 : -1
  const x = px + face * BLOCK_FORWARD * H
  return face > 0 ? Math.min(x, 0.25) : Math.max(x, -0.25)
}

/** Tempo des automatischen Anlaufs (m/s) */
const AUTO_SPEED = 4.5
/** Sprunghöhe eines Fake-Schlags ohne eigenen Sprung (m) */
const FAKE_JUMP = 0.65

export interface PlanInput {
  sides: Record<CourtSide, PlaySide>
  contacts: Contacts
  /** Ballflüge ohne Abpraller (Kontaktzeiten und -orte) */
  timeline: Timeline<string>
  heightOf: (side: CourtSide, playerId: string) => number
  /** Körperbau (fehlt = männlich) */
  femaleOf?: (side: CourtSide, playerId: string) => boolean
  netHeight: number
}

/** Bewegungsplan aller Spieler auf dem Feld */
export function planPlayers(input: PlanInput): Map<string, PlayerPlan> {
  const out = new Map<string, PlayerPlan>()
  const schlagSeg = input.timeline.segments.find((s) => s.type === 'schlag')
  for (const side of ['A', 'B'] as const)
    for (const c of input.sides[side].players) {
      const H = input.heightOf(side, c.playerId)
      const netYaw = side === 'A' ? 0 : Math.PI
      const path = c.path && c.path.points.length > 0 ? c.path : undefined
      const plan: PlayerPlan = {
        key: planKey(side, c.playerId),
        side,
        playerId: c.playerId,
        height: H,
        female: input.femaleOf?.(side, c.playerId) ?? false,
        home: { x: c.x, y: c.y },
        netYaw,
        ...(path ? { path } : {}),
        legs: [],
        jumps: [],
        autoJump: !c.jump,
        actions: []
      }
      // Ballkontakte
      for (const type of BALL_TYPES) {
        const ref = input.contacts[type]
        if (!ref || ref.side !== side || ref.playerId !== c.playerId) continue
        const seg = input.timeline.segments.find((s) => s.type === type)
        if (!seg) continue
        const dir = seg.sol?.dir ?? seg.asol?.dir ?? { dx: Math.cos(netYaw), dy: 0 }
        plan.actions.push({ kind: type, t: seg.t0, ball: segmentPosition(seg, 0), yaw: contactYaw(type, netYaw, dir), ...(seg.attack?.finte ? { finte: true } : {}) })
      }
      // Block: Zeitpunkt = Ball erreicht die Hände (sonst kurz nach dem Schlag)
      if (c.block) plan.actions.push(blockAction(c, plan, schlagSeg, input.netHeight))
      // Schlag antäuschen: Schlagbewegung am höchsten Punkt des Sprungs – dann, wenn das Zuspiel ihm am nächsten
      // kommt (so sieht es für den Block aus, als käme der Ball zu ihm). Mit eigenem, nicht gekoppeltem Sprung an
      // dessen höchstem Punkt. Wer selbst schlägt, täuscht nicht an.
      if (c.fake && !plan.actions.some((a) => a.kind === 'schlag')) {
        const zuspielSeg = input.timeline.segments.find((s) => s.type === 'zuspiel')
        const t =
          c.jump && !c.jump.sync
            ? c.jump.at + jumpRise(c.jump.height)
            : zuspielSeg
              ? closestPass(zuspielSeg, (tt) => planXY(plan, tt))
              : (schlagSeg?.t0 ?? 1)
        plan.actions.push({ kind: 'fake', t, ball: { x: c.x, y: c.y, z: 0 }, yaw: netYaw })
      }
      plan.actions.sort((a, b) => a.t - b.t)

      // Sprünge: eigener Sprung (ggf. zeitlich an die Aktion gekoppelt), sonst so hoch wie nötig
      if (c.jump) {
        const a = plan.actions.find((k) => k.kind === 'block' || k.kind === 'schlag' || k.kind === 'fake') ?? plan.actions.find((k) => k.kind === 'zuspiel') ?? plan.actions[0]
        plan.jumps = [c.jump.sync && a ? { at: a.t - jumpRise(c.jump.height), height: c.jump.height } : { at: c.jump.at, height: c.jump.height }]
      } else
        for (const a of plan.actions) {
          const h = neededJump(a.kind, a.ball.z, H)
          if (h > 0) plan.jumps.push({ at: a.t - jumpRise(h), height: h })
        }

      // Automatische Läufe zum Ball (nur ohne eigenen Laufweg)
      if (!path) {
        let prev = plan.home
        let tPrev = 0
        for (const a of plan.actions) {
          if (a.kind === 'block' || a.kind === 'fake') continue
          const to = standPoint(a.kind, a.ball, a.yaw, H, a.finte)
          const dist = Math.hypot(to.x - prev.x, to.y - prev.y)
          if (dist > 0.03) {
            const jump = plan.jumps.find((j) => Math.abs(j.at + jumpRise(j.height) - a.t) < 1e-6)
            // Ankunft kurz vor dem Kontakt bzw. zum Absprung
            const arrive = jump ? jump.at - 0.02 : a.t - 0.12
            const t0 = Math.max(tPrev, arrive - dist / AUTO_SPEED)
            const t1 = Math.max(arrive, t0 + dist / RUN_SPEED.max)
            // Bei t = 0 kann niemand schon gelaufen sein – dann steht er (noch) nicht am Ball
            if (t1 > t0 && arrive > tPrev) plan.legs.push({ t0, t1, from: prev, to })
            else if (arrive <= tPrev && tPrev > 0) plan.legs.push({ t0: tPrev, t1: tPrev + dist / RUN_SPEED.max, from: prev, to })
            else continue
          }
          prev = to
          tPrev = Math.max(plan.legs.length ? plan.legs[plan.legs.length - 1].t1 : 0, a.t + 0.3)
        }
      }
      // Fake-Schlag: gedachter Ball vor der rechten Schulter, in Reichhöhe am höchsten Punkt
      for (const a of plan.actions) {
        if (a.kind !== 'fake') continue
        const p = planXY(plan, a.t)
        const o = ballOffset('schlag', H)
        const cy = Math.cos(a.yaw)
        const sy = Math.sin(a.yaw)
        a.ball = { x: p.x + cy * o.f + sy * o.r, y: p.y + sy * o.f - cy * o.r, z: planZ(plan, a.t) + REACH_ONE * H + 0.03 }
      }
      out.set(plan.key, plan)
    }
  return out
}

/** Zeitpunkt, zu dem der Ball (waagerecht) dem Spieler am nächsten ist – während des Flugs seg */
export function closestPass(seg: Timeline<string>['segments'][number], at: (t: number) => Vec2): number {
  const n = 80
  let best = seg.t1
  let bestD = Infinity
  for (let i = 0; i <= n; i++) {
    const t = seg.t0 + ((seg.t1 - seg.t0) * i) / n
    const b = segmentPosition(seg, t - seg.t0)
    const p = at(t)
    const d = Math.hypot(b.x - p.x, b.y - p.y)
    if (d < bestD - 1e-9) {
      bestD = d
      best = t
    }
  }
  return best
}

function blockAction(c: CourtPlayer, plan: PlayerPlan, schlagSeg: Timeline<string>['segments'][number] | undefined, netHeight: number): PlayerAction {
  const H = plan.height
  // Blocker laufen nicht automatisch: ihre Lage folgt nur dem eigenen Laufweg
  const at = (t: number) => planXY(plan, t)
  const fallback = (t: number): PlayerAction => {
    const p = at(t)
    return { kind: 'block', t, ball: { x: handsPlaneX(p.x, plan.netYaw, H), y: p.y, z: netHeight + 0.25 }, yaw: plan.netYaw }
  }
  if (!schlagSeg) {
    const base = c.path && c.path.points.length > 0 ? pathEnd(c, c.path) : 0
    return fallback(base + 0.5)
  }
  const dur = schlagSeg.t1 - schlagSeg.t0
  // Wann erreicht der Ball die Ebene der Hände? (zwei Runden, weil sich der Blocker bewegen kann)
  let t = schlagSeg.t0 + Math.min(dur, 0.2)
  let found: { t: number; p: { x: number; y: number; z: number } } | null = null
  for (let round = 0; round < 2; round++) {
    const plane = handsPlaneX(at(t).x, plan.netYaw, H)
    let prev = segmentPosition(schlagSeg, 0)
    found = null
    const n = Math.max(1, Math.ceil(dur * 240))
    for (let i = 1; i <= n; i++) {
      const tl = (dur * i) / n
      const cur = segmentPosition(schlagSeg, tl)
      const a = prev.x - plane
      const b = cur.x - plane
      if (a !== 0 && a * b <= 0 && a !== b) {
        const f = a / (a - b)
        found = {
          t: schlagSeg.t0 + tl - (dur / n) * (1 - f),
          p: { x: plane, y: prev.y + f * (cur.y - prev.y), z: prev.z + f * (cur.z - prev.z) }
        }
        break
      }
      prev = cur
    }
    if (!found) break
    t = found.t
  }
  if (!found) return fallback(schlagSeg.t0 + Math.min(dur, 0.2))
  return { kind: 'block', t: found.t, ball: found.p, yaw: plan.netYaw }
}

/** Ort des Spielers am Boden zur Zeit t */
export function planXY(plan: PlayerPlan, t: number): Vec2 {
  if (plan.path) {
    const curve = pathCurve(plan.home, plan.path)
    return pointAtLength(curve.poly, curve.L, Math.max(0, t - plan.path.delay) * plan.path.speed)
  }
  let p = plan.home
  for (const leg of plan.legs) {
    if (t <= leg.t0) break
    if (t >= leg.t1) {
      p = leg.to
      continue
    }
    const k = (t - leg.t0) / (leg.t1 - leg.t0)
    return { x: leg.from.x + (leg.to.x - leg.from.x) * k, y: leg.from.y + (leg.to.y - leg.from.y) * k }
  }
  return p
}

/** Höhe der Füße über dem Boden (Sprung) */
export function planZ(plan: PlayerPlan, t: number): number {
  let z = 0
  for (const j of plan.jumps) z = Math.max(z, jumpZ(j, t))
  return z
}

/** Position des Spielers zur Zeit t (x, y am Boden; z = Sprunghöhe) */
export function planAt(plan: PlayerPlan, t: number): { x: number; y: number; z: number } {
  const p = planXY(plan, t)
  return { x: p.x, y: p.y, z: planZ(plan, t) }
}

/** Lauf zur Zeit t: zurückgelegte Strecke, Tempo, Richtung und wie sehr er gerade läuft (0–1, weich ein-/ausgeblendet) */
export function planRun(plan: PlayerPlan, t: number): { dist: number; speed: number; w: number; dir: Vec2 | null } {
  const ramp = (t0: number, t1: number) => Math.min(1, Math.max(0, Math.min(t - t0, t1 - t) / 0.15))
  if (plan.path) {
    const curve = pathCurve(plan.home, plan.path)
    const t0 = plan.path.delay
    const t1 = t0 + curve.length / Math.max(0.1, plan.path.speed)
    const d = Math.min(curve.length, Math.max(0, t - t0) * plan.path.speed)
    const a = pointAtLength(curve.poly, curve.L, Math.max(0, d - 0.15))
    const b = pointAtLength(curve.poly, curve.L, Math.min(curve.length, d + 0.15))
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    return { dist: d, speed: plan.path.speed, w: ramp(t0, t1), dir: len > 1e-6 ? { x: (b.x - a.x) / len, y: (b.y - a.y) / len } : null }
  }
  let dist = 0
  for (const leg of plan.legs) {
    const len = Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y)
    if (t >= leg.t1) {
      dist += len
      continue
    }
    if (t > leg.t0) {
      const k = (t - leg.t0) / (leg.t1 - leg.t0)
      return { dist: dist + len * k, speed: len / (leg.t1 - leg.t0), w: ramp(leg.t0, leg.t1), dir: len > 1e-6 ? { x: (leg.to.x - leg.from.x) / len, y: (leg.to.y - leg.from.y) / len } : null }
    }
    break
  }
  return { dist, speed: 0, w: 0, dir: null }
}

/** Ende aller Bewegungen (Läufe, Sprünge inkl. Landung) */
export function planDuration(plans: Iterable<PlayerPlan>): number {
  let end = 0
  for (const plan of plans) {
    if (plan.path) end = Math.max(end, pathEnd(plan.home, plan.path))
    for (const leg of plan.legs) end = Math.max(end, leg.t1)
    for (const j of plan.jumps) end = Math.max(end, j.at + jumpAirtime(j.height))
  }
  return end
}
