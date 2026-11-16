import type { Role } from './types'

/**
 * Farbpaare aus Trikot und Libero-Trikot. Jedes Paar ist eine stimmige Kombination:
 * gedecktes, dunkles Trikot (weiße Schrift) und ein helles Libero-Trikot (dunkle Schrift) im Gegenton,
 * das sich auf dem Feld klar abhebt – wie im echten Volleyball. Abgesichert per Test:
 * Schrift ≥ 4.5:1, Libero zu Trikot ≥ 3:1, Libero-Farben untereinander gut unterscheidbar.
 */
export const COLOR_PAIRS = [
  { jersey: '#1f4e79', jerseyName: 'Marine', libero: '#ef8a52', liberoName: 'Orange' },
  { jersey: '#8e2438', jerseyName: 'Bordeaux', libero: '#e8c547', liberoName: 'Gold' },
  { jersey: '#2e5e3a', jerseyName: 'Waldgrün', libero: '#f2a7c3', liberoName: 'Rosa' },
  { jersey: '#1d6363', jerseyName: 'Petrol', libero: '#ececf0', liberoName: 'Weiß' },
  { jersey: '#8a3b6e', jerseyName: 'Beere', libero: '#86d6a2', liberoName: 'Mint' },
  { jersey: '#7a4a12', jerseyName: 'Bronze', libero: '#6cb7e6', liberoName: 'Himmelblau' },
  { jersey: '#3d4756', jerseyName: 'Schiefer', libero: '#a8e05f', liberoName: 'Limette' },
  { jersey: '#5b2a86', jerseyName: 'Violett', libero: '#f3e98a', liberoName: 'Zitrone' }
] as const

/** Trikotfarben zur Auswahl (Reihenfolge = Paare) */
export const JERSEY_COLORS = COLOR_PAIRS.map((p) => ({ hex: p.jersey, name: p.jerseyName }))
/** Libero-Farben zur Auswahl, jeweils unter ihrem Trikot-Partner */
export const LIBERO_COLORS = COLOR_PAIRS.map((p) => ({ hex: p.libero, name: p.liberoName }))

/** Passende Libero-Farbe zu einer Trikotfarbe aus der Palette (sonst null) */
export function pairedLibero(jerseyHex: string): string | null {
  return COLOR_PAIRS.find((p) => p.jersey === jerseyHex.toLowerCase())?.libero ?? null
}

export const DEFAULT_TEAM_COLOR = JERSEY_COLORS[0].hex
export const DEFAULT_LIBERO_COLOR = COLOR_PAIRS[0].libero

export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')
}

/** Relative Leuchtdichte nach WCAG */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export const TEXT_LIGHT = '#ffffff'
export const TEXT_DARK = '#16161a'

/** Schriftfarbe mit dem besseren Kontrast auf der Trikotfarbe */
export function textOn(fill: string): string {
  return contrastRatio(fill, TEXT_LIGHT) >= contrastRatio(fill, TEXT_DARK) ? TEXT_LIGHT : TEXT_DARK
}

/** Mischt eine Farbe mit Weiß (amount 0..1) – für Ränder und Lichtkanten */
export function mixWhite(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex)
  return toHex([r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount])
}

export interface JerseyStyle {
  fill: string
  stroke: string
  text: string
}

/** Darstellung eines Spielers: der Libero trägt automatisch die Libero-Farbe, alle anderen die Hauptfarbe. */
export function jerseyFor(team: { color: string; liberoColor: string }, role: Role): JerseyStyle {
  const fill = role === 'L' ? team.liberoColor : team.color
  const isLight = luminance(fill) > 0.35
  return { fill, stroke: isLight ? '#ffffff' : mixWhite(fill, 0.4), text: textOn(fill) }
}

/** Nächste noch nicht benutzte Trikotfarbe für ein neues Team */
export function nextTeamColor(used: string[]): string {
  const lower = used.map((c) => c.toLowerCase())
  return (JERSEY_COLORS.find((c) => !lower.includes(c.hex)) ?? JERSEY_COLORS[used.length % JERSEY_COLORS.length]).hex
}

/**
 * Teamfarbe als Akzent auf dunklem Grund (Häkchen, Links, Fokus): so weit mit Weiß aufhellen,
 * bis mindestens 4.5:1 Kontrast zum Hintergrund erreicht ist. Helle Farben bleiben unverändert.
 */
export function teamTint(hex: string, background = '#1d1d22'): string {
  for (let a = 0; a <= 1.0001; a += 0.05) {
    const c = mixWhite(hex, a)
    if (contrastRatio(c, background) >= 4.5) return c
  }
  return '#ffffff'
}

/** Mischt eine Farbe mit Schwarz (amount 0..1) */
export function mixBlack(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex)
  return toHex([r * (1 - amount), g * (1 - amount), b * (1 - amount)])
}

/** Teamfarbe als Akzent auf hellem Grund: so weit abdunkeln, bis mindestens 4.5:1 Kontrast erreicht ist. */
export function teamTintOnLight(hex: string, background = '#ffffff'): string {
  for (let a = 0; a <= 1.0001; a += 0.05) {
    const c = mixBlack(hex, a)
    if (contrastRatio(c, background) >= 4.5) return c
  }
  return '#000000'
}

/**
 * Hex-Eingabe des Nutzers normalisieren: „#1F4E79“, „1f4e79“, „#abc“ → „#1f4e79“ bzw. „#aabbcc“.
 * Gibt null zurück, wenn die Eingabe keine gültige Farbe ist.
 */
export function parseHexInput(input: string): string | null {
  const v = input.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`
  if (/^[0-9a-f]{3}$/.test(v)) return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`
  return null
}

/** HSV (h 0–360, s/v 0–1) ↔ Hex – für den eigenen Farbwähler */
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const [r, g, b] = rgb(hex).map((c) => c / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s
  const hh = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hh % 2) - 1))
  const [r1, g1, b1] =
    hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x]
  const m = v - c
  return toHex([(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255])
}

/** RGB-Kanäle (0–255) ↔ Hex – für die RGB-Eingabe im Farbwähler */
export function hexToRgb(hex: string): [number, number, number] {
  return rgb(hex)
}

export function rgbToHex(r: number, g: number, b: number): string {
  return toHex([r, g, b])
}
