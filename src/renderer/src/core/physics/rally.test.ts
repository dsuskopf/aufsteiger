import { describe, expect, it } from 'vitest'
import { ballAt } from '../timeline/timeline'
import { newAttack } from './attack'
import { ANTENNA_Y, blockBounce, buildRally, floorBounce, freeFlight, netHit, type BlockerFn, type RallyInput } from './rally'
import { BALL_RADIUS } from './trajectory'
import { ballIn } from '../geometry/court'
import type { TrajectoryInput } from './trajectory'

const NET = 2.43
const base = (items: RallyInput['items'], blockers: RallyInput['blockers'] = []): RallyInput => ({
  items,
  netHeight: NET,
  blockers,
  bounce: true,
  bounceDuration: 1.5
})
const annahme: TrajectoryInput = { start: { x: -7, y: 2, h: 0.8 }, end: { x: -1.5, y: 1 }, apexH: 4, hitH: 2.5 }
const zuspiel: TrajectoryInput = { start: { x: -1.5, y: 1, h: 2.5 }, end: { x: -1, y: -3 }, apexH: 4.5, hitH: 3 }
/** Schlag von Seite A über das Netz ins Feld B */
const schlag = (h = 3.1, speed = 22) => ({ ...newAttack({ x: -0.9, y: -3, h }, { x: 6, y: 0 }), speed })

describe('Netz und Block (Einzelkontakte)', () => {
  it('Netz: darüber und darunter frei, in den Maschen prallt der Ball zurück, an der Kante rollt er hinüber', () => {
    expect(netHit(0, NET + 0.3, [20, 0, -3], NET)).toBeNull()
    expect(netHit(0, 1.0, [20, 0, -3], NET)).toBeNull()
    expect(netHit(6, NET - 0.3, [20, 0, -3], NET)).toBeNull()
    const mesh = netHit(1, NET - 0.4, [20, 2, -3], NET)!
    expect(mesh.kind).toBe('netz')
    expect(mesh.vOut[0]).toBeLessThan(0)
    expect(Math.abs(mesh.vOut[0])).toBeLessThan(3)
    expect(mesh.pOut[0]).toBeLessThan(0)
    const tape = netHit(1, NET + 0.03, [20, 0, -3], NET)!
    expect(tape.kind).toBe('netzkante')
    expect(tape.vOut[0]).toBeGreaterThan(0)
    expect(tape.vOut[0]).toBeLessThan(20)
    expect(tape.vOut[2]).toBeGreaterThan(0)
  })

  it('Block-Abprall folgt der Trefferfläche: frontal zurück, an den Fingerspitzen nach oben, an der Kante seitlich', () => {
    const v: [number, number, number] = [22, 0, -4]
    // Frontal (Treffpunkt direkt vor dem Ball): zurück, langsamer
    const front = blockBounce([0, 0, 2.6], v, [0.15, 0, 2.6], [0, 0, 0])
    expect(front.v[0]).toBeLessThan(-5)
    expect(front.v[0]).toBeGreaterThan(-22)
    // Fingerspitzen (Treffpunkt unter dem Ball): Ball wird nach oben abgelenkt und fliegt weiter
    const tip = blockBounce([0, 0, 2.9], v, [0.05, 0, 2.75], [0, 0, 0])
    expect(tip.v[2]).toBeGreaterThan(0)
    expect(tip.v[0]).toBeGreaterThan(0)
    // Außenkante (Treffpunkt seitlich): Ball geht zur Seite weg
    const edge = blockBounce([0, 0.2, 2.6], v, [0.1, 0.05, 2.6], [0, 0, 0])
    expect(edge.v[1]).toBeGreaterThan(3)
    // Hände, die nach vorn drücken, geben dem Ball mehr Tempo zurück
    const push = blockBounce([0, 0, 2.6], v, [0.15, 0, 2.6], [-2, 0, 0])
    expect(push.v[0]).toBeLessThan(front.v[0])
  })
})

describe('Antenne und Linien', () => {
  it('Antenne: Berührung wird erkannt (auch über der Netzkante), daneben und darüber frei', () => {
    expect(netHit(ANTENNA_Y + 0.05, NET + 0.4, [20, 0, -2], NET)?.kind).toBe('antenne')
    expect(netHit(-ANTENNA_Y - 0.05, NET - 0.5, [20, 0, -2], NET)?.kind).toBe('antenne')
    // Innerhalb der Antennen unter der Netzkante fängt das Netz den Ball
    expect(netHit(ANTENNA_Y - 0.05, NET - 0.5, [20, 0, -2], NET)?.kind).toBe('netz')
    expect(netHit(ANTENNA_Y + 0.3, NET + 0.4, [20, 0, -2], NET)).toBeNull()
    expect(netHit(ANTENNA_Y, NET + 1.2, [20, 0, -2], NET)).toBeNull()
  })

  it('Antenne biegt sich weg: Ball fliegt weiter, nur etwas langsamer und leicht abgelenkt', () => {
    const v: [number, number, number] = [20, 0, -2]
    for (const dy of [0, 0.05, 0.1]) {
      const h = netHit(ANTENNA_Y + dy, NET + 0.4, v, NET)!
      expect(h.kind).toBe('antenne')
      const out = h.vOut
      const angle = Math.acos((out[0] * v[0] + out[1] * v[1] + out[2] * v[2]) / (Math.hypot(...out) * Math.hypot(...v)))
      expect((angle * 180) / Math.PI).toBeLessThan(6)
      expect(Math.hypot(...out)).toBeGreaterThan(0.8 * Math.hypot(...v))
      expect(out[0]).toBeGreaterThan(0)
      // Weg von der Stange
      expect(out[1]).toBeGreaterThanOrEqual(0)
    }
  })

  it('Schlag an die Antenne ist ein Fehler', () => {
    const a = { ...newAttack({ x: -2, y: 4.2, h: 3.1 }, { x: 4, y: 5.2 }), speed: 16 }
    const r = buildRally(base([{ type: 'schlag', attack: a }]))
    expect(r.deflection?.kind).toBe('antenne')
    expect(r.fault?.reason).toBe('antenne')
    expect(r.events.some((e) => e.kind === 'antenne')).toBe(true)
  })

  it('Ball ist im Feld, solange er die Linie aus der Vogelperspektive berührt', () => {
    const r = 0.105
    expect(ballIn(9, 0, r)).toBe(true)
    expect(ballIn(9.1, 4.6, r)).toBe(true)
    expect(ballIn(9 + 0.025 + r - 0.001, 0, r)).toBe(true)
    expect(ballIn(9 + 0.025 + r + 0.001, 0, r)).toBe(false)
    expect(ballIn(0, -4.75, r)).toBe(false)
  })
})

describe('Bodenkontakt mit Drall', () => {
  const R = BALL_RADIUS
  it('ohne Drall: Reibung bremst und lässt den Ball vorwärts rollen', () => {
    const b = floorBounce([10, 0, -8], [0, 0, 0])
    expect(b.v[0]).toBeLessThan(10)
    expect(b.v[2]).toBeGreaterThan(0)
    // Vorwärtsdrall (ωy > 0 bei Flug in +x), höchstens bis zum Rollen
    expect(b.w[1]).toBeGreaterThan(0)
    expect(b.v[0] - R * b.w[1]).toBeGreaterThanOrEqual(-1e-9)
  })

  it('Topspin springt flacher und schneller weiter, Rückwärtsdrall wird gebremst', () => {
    const v: [number, number, number] = [10, 0, -8]
    const top = floorBounce(v, [0, 2 * Math.PI * 8, 0])
    const none = floorBounce(v, [0, 0, 0])
    const back = floorBounce(v, [0, -2 * Math.PI * 8, 0])
    expect(top.v[0]).toBeGreaterThan(none.v[0])
    expect(back.v[0]).toBeLessThan(none.v[0])
    // Starker Rückwärtsdrall bei langsamem Ball: er springt sogar zurück
    expect(floorBounce([1, 0, -5], [0, -2 * Math.PI * 10, 0]).v[0]).toBeLessThan(0)
  })

  it('Seitendrall lenkt beim Aufprall seitlich ab; steiler Aufprall = mehr Reibung', () => {
    const side = floorBounce([10, 0, -8], [2 * Math.PI * 6, 0, 0])
    expect(Math.abs(side.v[1])).toBeGreaterThan(0.3)
    const flat = floorBounce([10, 0, -2], [0, 0, 0])
    const steep = floorBounce([10, 0, -10], [0, 0, 0])
    expect(10 - steep.v[0]).toBeGreaterThan(10 - flat.v[0])
  })

  it('die Spur enthält die Drehung (Einheits-Quaternion), der Ball rollt am Ende passend zum Tempo', () => {
    const ff = freeFlight([-2, 0, 1], [6, 0, -3], [0, 0, 0], { netHeight: NET, bounce: true, duration: 3 })
    const q = ff.track.q!
    expect(q.length).toBe(ff.track.t.length * 4)
    const i = ff.track.t.length - 1
    expect(Math.hypot(q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3])).toBeCloseTo(1, 6)
    expect(q[i * 4 + 3]).not.toBeCloseTo(1, 3)
  })
})

describe('freier Flug', () => {
  it('fällt, springt auf dem Boden und endet nach der Abprall-Dauer', () => {
    const ff = freeFlight([-2, 0, 2.5], [-6, 1, -2], [0, 0, 0], { netHeight: NET, bounce: true, duration: 1.5 })
    expect(ff.tFloor).not.toBeNull()
    expect(ff.events.filter((e) => e.kind === 'boden').length).toBeGreaterThanOrEqual(1)
    const T = ff.track.t[ff.track.t.length - 1]
    expect(T).toBeCloseTo(ff.tFloor! + 1.5, 1)
    for (const z of ff.track.z) expect(z).toBeGreaterThanOrEqual(0)
  })

  it('ohne Abprall endet er am Boden', () => {
    const ff = freeFlight([-2, 0, 2.5], [-6, 1, -2], [0, 0, 0], { netHeight: NET, bounce: false, duration: 1.5 })
    expect(ff.track.t[ff.track.t.length - 1]).toBeCloseTo(ff.tFloor!, 6)
  })

  it('bleibt am Netz hängen, wenn er hineinfliegt', () => {
    const ff = freeFlight([-1, 0, 2.0], [8, 0, 0], [0, 0, 0], { netHeight: NET, bounce: true, duration: 1 })
    expect(ff.events[0].kind).toBe('netz')
    // Der Ball bleibt auf der Seite, von der er kam
    expect(Math.max(...ff.track.x)).toBeLessThan(0.01)
  })
})

describe('Ballwechsel', () => {
  it('ohne Hindernis: Flüge nacheinander, Schlag landet und springt weiter', () => {
    const r = buildRally(base([{ type: 'annahme', input: annahme }, { type: 'zuspiel', input: zuspiel }, { type: 'schlag', attack: schlag() }]))
    expect(r.timeline.segments.map((s) => s.type)).toEqual(['annahme', 'zuspiel', 'schlag', 'abprall'])
    expect(r.deflection).toBeNull()
    expect(r.events.map((e) => e.kind).slice(0, 4)).toEqual(['annahme', 'zuspiel', 'schlag', 'boden'])
    const landing = r.events.find((e) => e.kind === 'boden')!
    expect(landing.x).toBeCloseTo(6, 0)
    // Zeiten steigen
    for (let i = 1; i < r.events.length; i++) expect(r.events[i].t).toBeGreaterThanOrEqual(r.events[i - 1].t)
  })

  it('Schlag ins Netz: Flug endet am Netz, Ball fällt auf der eigenen Seite herunter', () => {
    const r = buildRally(base([{ type: 'schlag', attack: schlag(2.2, 20) }]))
    expect(r.deflection?.kind).toBe('netz')
    const hit = r.events.find((e) => e.kind === 'netz')!
    expect(hit.x).toBeCloseTo(0, 6)
    const end = ballAt(r.timeline, r.timeline.total)!
    expect(end.x).toBeLessThan(0)
    expect(end.z).toBeLessThan(0.3)
  })

  it('Block im Weg: Ball prallt zurück ins Feld des Angreifers', () => {
    const a = schlag()
    // Blocker steht dort, wo der Ball das Netz überquert
    const free = buildRally(base([{ type: 'schlag', attack: a }]))
    const seg = free.timeline.segments[0]
    let cross = { y: 0, z: 0 }
    for (let t = 0; t < seg.t1; t += 0.002) {
      const p = ballAt(free.timeline, t)!
      if (p.x >= 0.1) {
        cross = p
        break
      }
    }
    // Zwei Hände (senkrechte Kapseln) direkt in der Bahn
    const wall = (dy: number): BlockerFn => () => ({
      key: 'B:x',
      caps: [-0.09, 0.09].map((o) => ({ a: [0.15, cross.y + dy + o, cross.z - 0.3] as [number, number, number], b: [0.15, cross.y + dy + o, cross.z + 0.25] as [number, number, number], r: 0.05 }))
    })
    const r = buildRally(base([{ type: 'schlag', attack: a }], [wall(0)]))
    expect(r.deflection?.kind).toBe('block')
    const ev = r.events.find((e) => e.kind === 'block')!
    expect(ev.by).toBe('B:x')
    expect(r.timeline.segments[0].t1).toBeCloseTo(ev.t, 9)
    // Kein Sprung: Der Ball berührt die Hand genau dort, wo er gerade ist (Abstand = Radius + Hand)
    const at = ballAt(r.timeline, ev.t)!
    expect(at.x).toBeGreaterThan(0.15 - BALL_RADIUS - 0.05 - 0.01)
    expect(at.x).toBeLessThan(0.15)
    const end = ballAt(r.timeline, r.timeline.total)!
    expect(end.x).toBeLessThan(0)
    // Stehen die Hände woanders, fliegt der Ball durch
    expect(buildRally(base([{ type: 'schlag', attack: a }], [wall(2)])).deflection).toBeNull()
  })

  it('Annahme ins Netz beendet den Ballwechsel (kein Zuspiel mehr)', () => {
    const insNetz: TrajectoryInput = { start: { x: -4, y: 0, h: 0.8 }, end: { x: 3, y: 0 }, apexH: 2.3, hitH: 1.5 }
    const r = buildRally(base([{ type: 'annahme', input: insNetz }, { type: 'zuspiel', input: zuspiel }]))
    expect(r.timeline.segments.map((s) => s.type)).toEqual(['annahme', 'abprall'])
    expect(r.events.some((e) => e.kind === 'zuspiel')).toBe(false)
  })
})
