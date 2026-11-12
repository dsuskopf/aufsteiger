import { describe, expect, it } from 'vitest'
import {
  COLOR_PAIRS,
  JERSEY_COLORS,
  LIBERO_COLORS,
  contrastRatio,
  jerseyFor,
  luminance,
  pairedLibero,
  parseHexInput,
  hexToHsv,
  hsvToHex,
  hexToRgb,
  rgbToHex,
  nextTeamColor,
  teamTint,
  textOn
} from './teamColors'

describe('Teamfarben', () => {
  it('jede Trikotfarbe trägt ihre Schrift mit mindestens 4.5:1', () => {
    for (const c of [...JERSEY_COLORS, ...LIBERO_COLORS]) {
      expect(contrastRatio(c.hex, textOn(c.hex)), c.name).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('Libero trägt automatisch die Libero-Farbe, alle anderen die Hauptfarbe', () => {
    const team = { color: '#1f4e79', liberoColor: '#e8c547' }
    expect(jerseyFor(team, 'L').fill).toBe('#e8c547')
    for (const r of ['S', 'A', 'MB', 'D'] as const) expect(jerseyFor(team, r).fill).toBe('#1f4e79')
    // Helles Libero-Trikot → dunkle Schrift
    expect(jerseyFor(team, 'L').text).toBe('#16161a')
    expect(jerseyFor(team, 'S').text).toBe('#ffffff')
  })

  it('neues Team bekommt eine noch freie Farbe', () => {
    expect(nextTeamColor([])).toBe(JERSEY_COLORS[0].hex)
    expect(nextTeamColor([JERSEY_COLORS[0].hex.toUpperCase()])).toBe(JERSEY_COLORS[1].hex)
  })
  it('teamTint ist auf dunklem Grund immer lesbar (≥ 4.5:1)', () => {
    for (const c of [...JERSEY_COLORS, ...LIBERO_COLORS]) {
      expect(contrastRatio(teamTint(c.hex), '#1d1d22'), c.name).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(teamTint(c.hex, '#141417'), '#141417'), c.name).toBeGreaterThanOrEqual(4.5)
    }
    // Helle Farben bleiben, wie sie sind
    expect(teamTint('#e8c547')).toBe('#e8c547')
  })
  it('gleich viele Trikot- und Libero-Farben, jedes Paar hebt sich ab', () => {
    expect(JERSEY_COLORS).toHaveLength(LIBERO_COLORS.length)
    for (const p of COLOR_PAIRS) {
      // Libero hebt sich klar vom eigenen Trikot ab (≥ 3:1 wie für Grafiken)
      expect(contrastRatio(p.jersey, p.libero), p.jerseyName).toBeGreaterThanOrEqual(3)
      // Trikot dunkel (weiße Schrift), Libero hell (dunkle Schrift)
      expect(textOn(p.jersey), p.jerseyName).toBe('#ffffff')
      expect(textOn(p.libero), p.liberoName).toBe('#16161a')
    }
  })

  it('Libero-Farben sind untereinander gut unterscheidbar', () => {
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
    const libs = COLOR_PAIRS.map((p) => p.libero)
    for (let i = 0; i < libs.length; i++)
      for (let j = i + 1; j < libs.length; j++) {
        const [a, b] = [rgb(libs[i]), rgb(libs[j])]
        const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
        // ≥ 55 im RGB-Raum: z. B. Orange und Gold bleiben klar verschieden
        expect(dist, `${libs[i]} / ${libs[j]}`).toBeGreaterThanOrEqual(55)
      }
    // alle Libero-Farben sind hell
    for (const l of libs) expect(luminance(l)).toBeGreaterThan(0.3)
  })

  it('jede Trikotfarbe hat ihren Libero-Partner (Start für neue Teams)', () => {
    expect(pairedLibero('#1F4E79')).toBe('#ef8a52')
    expect(pairedLibero('#123456')).toBeNull()
  })
  it('Hex-Eingabe wird normalisiert, Ungültiges abgelehnt', () => {
    expect(parseHexInput('#1F4E79')).toBe('#1f4e79')
    expect(parseHexInput(' 1f4e79 ')).toBe('#1f4e79')
    expect(parseHexInput('#abc')).toBe('#aabbcc')
    expect(parseHexInput('blau')).toBeNull()
    expect(parseHexInput('#12345')).toBeNull()
    expect(parseHexInput('')).toBeNull()
  })
  it('HSV-Umrechnung ist umkehrbar', () => {
    for (const hex of ['#1f4e79', '#e8c547', '#000000', '#ffffff', '#2a9d8f', '#ff0000', '#8e2438']) {
      const { h, s, v } = hexToHsv(hex)
      expect(hsvToHex(h, s, v)).toBe(hex)
    }
    expect(hsvToHex(120, 1, 1)).toBe('#00ff00')
  })
  it('RGB-Umrechnung, Werte werden auf 0–255 begrenzt', () => {
    expect(hexToRgb('#2a9d8f')).toEqual([42, 157, 143])
    expect(rgbToHex(42, 157, 143)).toBe('#2a9d8f')
    expect(rgbToHex(300, -5, 128)).toBe('#ff0080')
  })
})
