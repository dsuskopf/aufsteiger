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

  it('Seitendrall nach rechts: Kurve, startet links der Geraden und landet trotzdem am Ziel', () => {
    const s = solveAttack({ ...base, sidespin: 6 })
    expect(s.reachable).toBe(true)
    const mid = attackPositionAt(s, s.tHit / 2)
    // links der Geraden Start → Ziel (positive Seite)
    const dx = 7
    const dy = -3
    const side = (-(mid.x + 1) * dy + (mid.y - 2) * dx) / Math.hypot(dx, dy)
    expect(side).toBeGreaterThan(0.1)
    const left = solveAttack({ ...base, sidespin: -6 })
    const mid2 = attackPositionAt(left, left.tHit / 2)
    expect((-(mid2.x + 1) * dy + (mid2.y - 2) * dx) / Math.hypot(dx, dy)).toBeLessThan(-0.1)
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

  it('Zielhöhe über dem Boden (z. B. Block oder Abwehr)', () => {
    const s = solveAttack({ ...base, endH: 1 })
    expect(attackPositionAt(s, s.tHit).z).toBeCloseTo(1, 2)
    expect(s.tGround).toBeGreaterThan(s.tHit)
  })
})
