import { describe, expect, it } from 'vitest'
import { zoneLayout } from './zones'

const find = (style: Parameters<typeof zoneLayout>[0], text: string, side: 'A' | 'B') =>
  zoneLayout(style).labels.filter((l) => l.text === text && (side === 'A' ? l.x < 0 : l.x > 0))

describe('Zonen', () => {
  it('Standard: 6 Zonen je Seite, Zone 1 hinten rechts aus Sicht des Teams', () => {
    const labels = zoneLayout('standard').labels
    expect(labels).toHaveLength(12)
    // Seite A schaut in +x: rechts = −y
    const [a1] = find('standard', '1', 'A')
    expect(a1.x).toBeCloseTo(-6)
    expect(a1.y).toBeCloseTo(-3)
    const [a4] = find('standard', '4', 'A')
    expect(a4.x).toBeCloseTo(-1.5)
    expect(a4.y).toBeCloseTo(3)
    // Seite B schaut in −x: rechts = +y
    const [b1] = find('standard', '1', 'B')
    expect(b1.x).toBeCloseTo(6)
    expect(b1.y).toBeCloseTo(3)
  })

  it('Erweitert: Mittelreihe 7 8 9 zwischen vorne und hinten', () => {
    const labels = zoneLayout('advanced').labels
    expect(labels).toHaveLength(18)
    const [a7] = find('advanced', '7', 'A')
    const [a9] = find('advanced', '9', 'A')
    expect(a7.x).toBeCloseTo(-4.5)
    expect(a7.y).toBeCloseTo(3) // links
    expect(a9.y).toBeCloseTo(-3) // rechts
    expect(find('advanced', '1', 'A')[0].x).toBeCloseTo(-7.5)
  })

  it('Unterzonen: A hinten rechts, C vorne links – 1A ist die Feldecke, 4C die gegenüberliegende', () => {
    const subs = zoneLayout('letters').labels.filter((l) => l.kind === 'sub' && l.x < 0)
    expect(subs).toHaveLength(36)
    // Buchstabe A, der am weitesten in der Ecke hinten rechts liegt (Zone 1)
    const corner = subs.reduce((m, l) => (l.x + l.y < m.x + m.y ? l : m))
    expect(corner.text).toBe('A')
    const opposite = subs.reduce((m, l) => (l.x + l.y > m.x + m.y ? l : m))
    expect(opposite.text).toBe('C')
    expect(opposite.x).toBeGreaterThan(-1.5)
    expect(opposite.y).toBeGreaterThan(3)
    // Zahlen liegen mit Scheibe auf dem Kreuz
    expect(zoneLayout('letters').labels.filter((l) => l.kind === 'zone').every((l) => l.disc)).toBe(true)
  })

  it('Alle Beschriftungen liegen im Feld', () => {
    for (const style of ['standard', 'advanced', 'letters'] as const)
      for (const l of zoneLayout(style).labels) {
        expect(Math.abs(l.x)).toBeLessThan(9)
        expect(Math.abs(l.y)).toBeLessThan(4.5)
      }
  })
})
