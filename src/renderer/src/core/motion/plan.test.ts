import { describe, expect, it } from 'vitest'
import type { Contacts, CourtSide, PlaySide } from '@shared/types'
import { newAttack } from '../physics/attack'
import { buildRally } from '../physics/rally'
import type { TrajectoryInput } from '../physics/trajectory'
import { buildTimeline } from '../timeline/timeline'
import { attachFirstContact, pruneContacts, suggestContact } from './couple'
import { jumpRise } from './motion'
import { planAt, planDuration, planPlayers, planXY, standPoint } from './plan'
import { bodyCapsules, handWorld, skeletonAt, twoBone } from './pose'
import { BALL_RADIUS } from '../physics/trajectory'

const annahme: TrajectoryInput = { start: { x: -6, y: 0.5, h: 0.8 }, end: { x: -1.5, y: 1 }, apexH: 5, hitH: 2.3 }
const zuspiel: TrajectoryInput = { start: { x: -1.5, y: 1, h: 2.3 }, end: { x: -0.9, y: -3 }, apexH: 5, hitH: 3 }
const schlag = { ...newAttack({ x: -0.9, y: -3, h: 3 }, { x: 6, y: 0 }), speed: 22 }
const items = [
  { type: 'annahme', input: annahme },
  { type: 'zuspiel', input: zuspiel },
  { type: 'schlag', attack: schlag }
] as const
const sides = (): Record<CourtSide, PlaySide> => ({
  A: {
    teamId: 't',
    players: [
      { playerId: 'lib', role: 'L', x: -6.5, y: 0.5 },
      { playerId: 'set', role: 'S', x: -1.5, y: -3 },
      { playerId: 'out', role: 'A', x: -4.5, y: -3.5 }
    ]
  },
  B: { teamId: 'u', players: [{ playerId: 'mb', role: 'MB', x: 0.5, y: 1.35, block: true }] }
})
const contacts: Contacts = { annahme: { side: 'A', playerId: 'lib' }, zuspiel: { side: 'A', playerId: 'set' }, schlag: { side: 'A', playerId: 'out' } }
const H = 1.9
const plan = (s = sides(), c = contacts) => planPlayers({ sides: s, contacts: c, timeline: buildTimeline([...items]), heightOf: () => H, netHeight: 2.43 })

describe('Bewegungsplan', () => {
  it('gekoppelte Spieler laufen rechtzeitig zum Ball', () => {
    const tl = buildTimeline([...items])
    const plans = plan()
    const set = plans.get('A:set')!
    const zu = tl.segments[1]
    const a = set.actions[0]
    expect(a.kind).toBe('zuspiel')
    expect(a.t).toBeCloseTo(zu.t0, 9)
    // Zum Kontakt steht er am Ball
    const at = planAt(set, a.t)
    const stand = standPoint('zuspiel', a.ball, a.yaw, H)
    expect(Math.hypot(at.x - stand.x, at.y - stand.y)).toBeLessThan(0.02)
    // Am Anfang steht er noch auf seinem Platz
    expect(planAt(set, 0)).toMatchObject({ x: -1.5, y: -3 })
  })

  it('Angreifer springt so, dass er den Ball am höchsten Punkt trifft', () => {
    const plans = plan()
    const out = plans.get('A:out')!
    const a = out.actions[0]
    expect(out.jumps).toHaveLength(1)
    const j = out.jumps[0]
    expect(j.at + jumpRise(j.height)).toBeCloseTo(a.t, 9)
    // Schlaghand erreicht den Ball
    const sk = skeletonAt(out, a.t, null)
    const hand = handWorld(sk, 'R')
    expect(Math.hypot(hand.x - a.ball.x, hand.y - a.ball.y, hand.z - a.ball.z)).toBeLessThan(BALL_RADIUS + 0.06)
  })

  it('eigener Laufweg und eigener Sprung haben Vorrang', () => {
    const s = sides()
    s.A.players[2] = { ...s.A.players[2], path: { points: [{ x: -3, y: -3 }], delay: 0, speed: 3 }, jump: { at: 1, height: 0.5 } }
    const out = plan(s).get('A:out')!
    expect(out.legs).toHaveLength(0)
    expect(out.jumps).toEqual([{ at: 1, height: 0.5 }])
    // Gekoppelter Sprung: höchster Punkt beim Kontakt
    s.A.players[2] = { ...s.A.players[2], jump: { at: 1, height: 0.5, sync: true } }
    const synced = plan(s).get('A:out')!
    expect(synced.jumps[0].at + jumpRise(0.5)).toBeCloseTo(synced.actions[0].t, 9)
  })

  it('Fake-Schlag: springt mit dem echten Angriff hoch und schlägt ohne Ball', () => {
    const s = sides()
    s.A.players.push({ playerId: 'fake', role: 'MB', x: -1.2, y: 0, fake: true })
    const plans = plan(s)
    const f = plans.get('A:fake')!
    const out = plans.get('A:out')!
    expect(f.actions[0].kind).toBe('fake')
    expect(f.actions[0].t).toBeCloseTo(out.actions[0].t, 9)
    expect(f.jumps[0].at + jumpRise(f.jumps[0].height)).toBeCloseTo(f.actions[0].t, 9)
    // Am höchsten Punkt ist die Schlaghand oben
    const sk = skeletonAt(f, f.actions[0].t, null)
    expect(handWorld(sk, 'R').z).toBeGreaterThan(2.6)
    // Mit eigenem (nicht gekoppeltem) Sprung: Schlag an dessen höchstem Punkt
    s.A.players[3] = { ...s.A.players[3], jump: { at: 1, height: 0.5 } }
    const own = plan(s).get('A:fake')!
    expect(own.actions[0].t).toBeCloseTo(1 + jumpRise(0.5), 9)
  })

  it('Blocker springt zum Durchgang des Balls; trifft der Ball seine Hände, prallt er ab', () => {
    const plans = plan()
    const mb = plans.get('B:mb')!
    const block = mb.actions[0]
    expect(block.kind).toBe('block')
    expect(mb.jumps[0].at + jumpRise(mb.jumps[0].height)).toBeCloseTo(block.t, 9)
    // Zum Blockzeitpunkt reichen die Fingerspitzen über die Netzkante, eine Sekunde vorher nicht
    const top = (t: number) => Math.max(...bodyCapsules(mb, t, null).flatMap((c) => [c.a[2], c.b[2]]))
    expect(top(block.t)).toBeGreaterThan(2.43 + 0.2)
    expect(top(block.t - 1)).toBeLessThan(2.43)

    // Blocker genau in die Bahn gestellt
    const s = sides()
    s.B.players[0] = { ...s.B.players[0], y: block.ball.y }
    const inWay = plan(s)
    const fns = [...inWay.values()]
      .filter((p) => p.actions.some((a) => a.kind === 'block'))
      .map((p) => (t: number, ball: { x: number; y: number; z: number }) => {
        const at = planXY(p, t)
        return Math.hypot(at.x - ball.x, at.y - ball.y) > 2.5 ? null : { key: p.key, caps: bodyCapsules(p, t, ball) }
      })
    const r = buildRally({ items: [...items], netHeight: 2.43, blockers: fns, bounce: true, bounceDuration: 1 })
    expect(r.deflection?.kind).toBe('block')
    // Hände sind zum Blockzeitpunkt oben
    const sk = skeletonAt(inWay.get('B:mb')!, block.t, null)
    expect(handWorld(sk, 'L').z).toBeGreaterThan(2.43)
    expect(planDuration(inWay.values())).toBeGreaterThan(block.t)
  })
})

describe('Kopplung', () => {
  it('der erste Ballflug startet beim gekoppelten Spieler und folgt ihm', () => {
    const s = sides()
    const state = { trajectories: { annahme, zuspiel }, schlag, contacts, sides: s }
    const fixed = attachFirstContact(state, () => H)
    const start = fixed.trajectories.annahme!.start
    expect(Math.hypot(start.x - -6.5, start.y - 0.5)).toBeCloseTo(0.27 * H, 2)
    // Stabil: zweite Runde ändert nichts mehr
    const again = attachFirstContact({ ...state, ...fixed }, () => H)
    expect(again.trajectories).toBe(fixed.trajectories)
    // Ohne Kopplung bleibt alles, wie es ist
    expect(attachFirstContact({ ...state, contacts: {} }, () => H)).toMatchObject({ trajectories: state.trajectories })
  })

  it('räumt Kontakte ohne Spieler oder Ballflug ab', () => {
    const s = sides()
    expect(pruneContacts(contacts, s, { annahme, zuspiel }, schlag)).toBe(contacts)
    expect(pruneContacts(contacts, s, { annahme }, null)).toEqual({ annahme: contacts.annahme })
    s.A.players = s.A.players.filter((c) => c.playerId !== 'lib')
    expect(pruneContacts(contacts, s, { annahme, zuspiel }, schlag).annahme).toBeUndefined()
  })

  it('schlägt Spieler vor: Nächster zur Annahme, Steller zum Zuspiel, Angreifer zum Schlag', () => {
    const state = { trajectories: { annahme, zuspiel }, schlag, contacts: {} as Contacts, sides: sides() }
    expect(suggestContact('annahme', state)).toEqual({ side: 'A', playerId: 'lib' })
    expect(suggestContact('zuspiel', state)).toEqual({ side: 'A', playerId: 'set' })
    expect(suggestContact('schlag', state)).toEqual({ side: 'A', playerId: 'out' })
  })
})

describe('Haltung', () => {
  it('Zwei-Gelenk-Kinematik hält die Längen und klemmt unerreichbare Ziele', () => {
    const r = twoBone([0, 1, 0], [0.3, 1.2, 0.1], 0.3, 0.35, [0, -1, 0])
    expect(Math.hypot(r.mid[0], r.mid[1] - 1, r.mid[2])).toBeCloseTo(0.3, 6)
    expect(Math.hypot(r.end[0] - r.mid[0], r.end[1] - r.mid[1], r.end[2] - r.mid[2])).toBeCloseTo(0.35, 6)
    const far = twoBone([0, 1, 0], [5, 1, 0], 0.3, 0.35, [0, -1, 0])
    expect(far.end[0]).toBeCloseTo(0.65, 3)
  })

  it('Annehmer hat die Arme beim Kontakt unter dem Ball, Füße am Boden', () => {
    const s = sides()
    const fixed = attachFirstContact({ trajectories: { annahme, zuspiel }, schlag, contacts, sides: s }, () => H)
    const tl = buildTimeline([{ type: 'annahme', input: fixed.trajectories.annahme! }])
    const lib = planPlayers({ sides: s, contacts, timeline: tl, heightOf: () => H, netHeight: 2.43 }).get('A:lib')!
    const sk = skeletonAt(lib, 0, null)
    const ball = lib.actions[0].ball
    const hand = handWorld(sk, 'R')
    expect(hand.z).toBeLessThan(ball.z)
    expect(Math.hypot(hand.x - ball.x, hand.y - ball.y)).toBeLessThan(0.2)
    expect(sk.footL[1]).toBeLessThan(0.12)
    expect(sk.root.z).toBe(0)
  })
})
