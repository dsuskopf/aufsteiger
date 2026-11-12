import { describe, expect, it } from 'vitest'
import { panelAt } from './ballModel'

/** Gleichmäßig verteilte Richtungen auf der Kugel (Fibonacci-Gitter) */
function sphere(n: number): [number, number, number][] {
  const out: [number, number, number][] = []
  const ga = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    out.push([Math.cos(ga * i) * r, y, Math.sin(ga * i) * r])
  }
  return out
}

/** Panel-Kennung: Würfelseite (Achse und Vorzeichen) und Streifen */
function panelId(x: number, y: number, z: number): string {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z)
  const [axis, sign, strip] = ax >= ay && ax >= az ? ['x', x, z / ax] : ay >= az ? ['y', y, x / ay] : ['z', z, y / az]
  const a = Math.atan(strip as number) / (Math.PI / 4)
  return `${axis}${(sign as number) > 0 ? '+' : '-'}${a < -1 / 3 ? 0 : a > 1 / 3 ? 2 : 1}`
}

describe('Volleyball-Panels', () => {
  it('18 Panels, davon 6 blau (je ein Mittelstreifen pro Seite)', () => {
    const ids = new Map<string, number>()
    for (const [x, y, z] of sphere(40000)) ids.set(panelId(x, y, z), panelAt(x, y, z).color)
    expect(ids.size).toBe(18)
    expect([...ids.values()].filter((c) => c === 1).length).toBe(6)
  })

  it('Flächenanteile: etwa ein Drittel blau, Nähte schmal', () => {
    const pts = sphere(40000)
    const blue = pts.filter(([x, y, z]) => panelAt(x, y, z).color === 1).length / pts.length
    const seam = pts.filter(([x, y, z]) => panelAt(x, y, z).seamDist < 0.022).length / pts.length
    expect(blue).toBeGreaterThan(0.28)
    expect(blue).toBeLessThan(0.38)
    expect(seam).toBeLessThan(0.15)
  })

  it('benachbarte Seiten: Streifen stehen quer (Naht entlang der Würfelkante)', () => {
    // Auf der Kante zwischen +X und +Y liegt immer eine Naht
    for (let t = -0.9; t <= 0.9; t += 0.1) {
      const v = [1, 1, Math.tan((t * Math.PI) / 4) * 1]
      const n = Math.hypot(...v)
      expect(panelAt(v[0] / n, v[1] / n, v[2] / n).seamDist).toBeLessThan(1e-9)
    }
  })
})
