import { describe, expect, it } from 'vitest'
import { attackPositionAt, netClearance, newAttack, solveAttack, type AttackInput } from './attack'

const base: AttackInput = newAttack({ x: -1, y: 2, h: 3.1 }, { x: 6, y: -1 })

describe('Schlag', () => {
  it('trifft das Ziel auf dem Boden, startet am Schlagpunkt', () => {
    const s = solveAttack(base)
    expect(s.reachable).toBe(true)
    expect(Math.hypot(s.landing.x - 6, s.landing.y + 1)).toBeLessThan(0.15)
    expect(attackPositionAt(s, 0)).toMatchObject({ x: -1, y: 2, z: 3.1 })
    expect(attackPositionAt(s, s.tHit).z).toBeCloseTo(0, 2)
    expect(s.tHit).toBeGreaterThan(0.2)
    expect(s.tHit).toBeLessThan(1.5)
  })

  it('Topspin: steiler nach oben abgeschlagen, um dasselbe Ziel zu erreichen; Backspin flacher', () => {
    const none = solveAttack(base)
    const top = solveAttack({ ...base, topspin: 6 })
    const back = solveAttack({ ...base, topspin: -6 })
    expect(top.elevation).toBeGreaterThan(none.elevation)
    expect(back.elevation).toBeLessThan(none.elevation)
    expect(top.reachable && back.reachable).toBe(true)
  })

  it('Rechtsdrall (rechts getroffen): Kurve nach links – startet rechts der Geraden und landet trotzdem am Ziel', () => {
    const s = solveAttack({ ...base, sidespin: 6 })
    expect(s.reachable).toBe(true)
    const mid = attackPositionAt(s, s.tHit / 2)
    // Abstand zur Geraden Start → Ziel: positiv = links, negativ = rechts (aus Sicht des Angreifers)
    const dx = 7
    const dy = -3
    const side = (-(mid.x + 1) * dy + (mid.y - 2) * dx) / Math.hypot(dx, dy)
    // Ein Ball, der nach links kurvt, muss rechts ausholen, um am Ziel zu landen
    expect(side).toBeLessThan(-0.1)
    const links = solveAttack({ ...base, sidespin: -6 })
    const mid2 = attackPositionAt(links, links.tHit / 2)
    expect((-(mid2.x + 1) * dy + (mid2.y - 2) * dx) / Math.hypot(dx, dy)).toBeGreaterThan(0.1)
  })

  it('Rechtsdrall lenkt den Ball nach links ab (gleiche Abflugrichtung, Landepunkt links)', () => {
    const none = solveAttack({ ...base })
    const spun = solveAttack({ ...base, sidespin: 6 })
    // Seitliche Beschleunigung am Anfang: nach links der Flugrichtung
    const p0 = attackPositionAt(spun, 0.02)
    const p1 = attackPositionAt(spun, spun.tHit * 0.9)
    const q0 = attackPositionAt(none, 0.02)
    const q1 = attackPositionAt(none, none.tHit * 0.9)
    const turn = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    const mid = attackPositionAt(spun, spun.tHit / 2)
    // Die Bahn biegt nach links (gegen den Uhrzeigersinn von oben)
    expect(turn(p0, mid, p1)).toBeGreaterThan(0)
    expect(Math.abs(turn(q0, attackPositionAt(none, none.tHit / 2), q1))).toBeLessThan(1e-3)
  })

  it('zu langsam für die Weite: landet zu kurz, als nicht erreichbar markiert', () => {
    const s = solveAttack({ ...base, end: { x: 8.5, y: 2 }, speed: 25 / 3.6 })
    expect(s.reachable).toBe(false)
    expect(s.landing.x).toBeLessThan(8.3)
  })

  it('höhere Geschwindigkeit → kürzere Flugzeit; Netzabstand wird geprüft', () => {
    const slow = solveAttack({ ...base, speed: 50 / 3.6 })
    const fast = solveAttack({ ...base, speed: 100 / 3.6 })
    expect(fast.tHit).toBeLessThan(slow.tHit)
    expect(netClearance(fast, 2.43)).not.toBeNull()
  })

  it('Finte: hoher, langsamer Bogen mit der eingestellten Bogenhöhe, landet am Ziel', () => {
    const tip = { ...base, end: { x: 2.5, y: 1 }, finte: true, arc: 0.8 }
    const s = solveAttack(tip)
    expect(s.apexH).toBeCloseTo(3.9, 1)
    expect(s.speed).toBeLessThan(10)
    expect(s.elevation).toBeGreaterThan(20)
    expect(Math.hypot(s.landing.x - 2.5, s.landing.y - 1)).toBeLessThan(0.05)
    expect(attackPositionAt(s, s.tHit).z).toBeCloseTo(0, 2)
    // Höherer Bogen → längere Flugzeit
    expect(solveAttack({ ...tip, arc: 1.6 }).tHit).toBeGreaterThan(s.tHit)
  })
})

describe('Abprall nach dem Schlag', () => {
  it('startet am Aufprallpunkt, springt weiter in Schlagrichtung, wird flacher und dauert so lange wie eingestellt', async () => {
    const { bounceTrack, trackPositionAt } = await import('./attack')
    const s = solveAttack(base)
    const tr = bounceTrack(s, 1.5)!
    expect(tr.t[tr.t.length - 1]).toBeCloseTo(1.5, 1)
    expect(trackPositionAt(tr, 0)).toMatchObject({ x: s.landing.x, y: s.landing.y, z: 0 })
    let maxZ = 0
    for (let i = 0; i < tr.z.length; i++) {
      expect(tr.z[i]).toBeGreaterThanOrEqual(0)
      maxZ = Math.max(maxZ, tr.z[i])
    }
    expect(maxZ).toBeGreaterThan(0.1)
    expect(maxZ).toBeLessThan(3.1)
    // weiter in Schlagrichtung (Start (−1, 2) → Ziel (6, −1))
    const end = trackPositionAt(tr, 1.5)
    expect((end.x - s.landing.x) * 7 + (end.y - s.landing.y) * -3).toBeGreaterThan(0)
  })

  it('kein Abprall, wenn die Dauer 0 ist', async () => {
    const { bounceTrack } = await import('./attack')
    expect(bounceTrack(solveAttack(base), 0)).toBeNull()
  })
})
