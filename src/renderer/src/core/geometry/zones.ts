import type { CourtSide, ZoneStyle } from '@shared/types'
import { COURT } from './court'

/**
 * Zonen auf dem Feldboden, je Feldhälfte aus Sicht des Teams, das aufs Netz schaut:
 *  - Standard (1–6): vorne (bis 3-m-Linie) links 4, Mitte 3, rechts 2; hinten links 5, Mitte 6, rechts 1.
 *  - Erweitert (1–9): drei Reihen à 3 m – vorne 4 3 2, Mitte 7 8 9, hinten 5 6 1 (3 × 3 m je Zone).
 *  - Erweitert mit Unterzonen: jede Zone in vier Quadrate geteilt – am Netz links C, rechts B;
 *    zur Grundlinie links D, rechts A (also 1A = hintere rechte Ecke, 4C = genau gegenüberliegende Ecke).
 * Alle Angaben in Weltkoordinaten (Netz bei x = 0, Seite A bei x < 0).
 */

export interface ZoneLabel {
  text: string
  x: number
  y: number
  /** Schrifthöhe in Metern */
  size: number
  kind: 'zone' | 'sub'
  /** Zahl mit Hintergrundscheibe (liegt auf dem Kreuz der Unterzonen) */
  disc: boolean
}

export interface ZoneLine {
  a: { x: number; y: number }
  b: { x: number; y: number }
  kind: 'zone' | 'sub'
}

export interface ZoneLayout {
  lines: ZoneLine[]
  labels: ZoneLabel[]
}

/** Spalten von links nach rechts (Sicht aufs Netz): Mitte der Spalte, seitlich in Metern (+ = rechts) */
const COLS = [-3, 0, 3]
const FRONT = [4, 3, 2]
const MIDDLE = [7, 8, 9]
const BACK = [5, 6, 1]
/** Unterzonen: [Buchstabe, seitlich (+ = rechts), Tiefe (+ = zur Grundlinie)] */
const SUBS: [string, number, number][] = [
  ['C', -1, -1],
  ['B', 1, -1],
  ['D', -1, 1],
  ['A', 1, 1]
]
/** Abstand der Buchstaben von der Zonenmitte (m): nah an den Ecken der Zone */
const SUB_OFFSET = 0.95

/** Seite A schaut in +x (rechts = −y), Seite B in −x (rechts = +y). */
function toWorld(side: CourtSide, depth: number, lateral: number) {
  const s = side === 'A' ? -1 : 1
  return { x: s * depth, y: s * lateral }
}

function line(side: CourtSide, d0: number, l0: number, d1: number, l1: number, kind: ZoneLine['kind']): ZoneLine {
  return { a: toWorld(side, d0, l0), b: toWorld(side, d1, l1), kind }
}

export function zoneLayout(style: ZoneStyle): ZoneLayout {
  const lines: ZoneLine[] = []
  const labels: ZoneLabel[] = []
  const L = COURT.halfLength
  const W = COURT.halfWidth
  const advanced = style !== 'standard'
  const letters = style === 'letters'

  for (const side of ['A', 'B'] as const) {
    // Spaltengrenzen über die ganze Hälfte (die 3-m-Linie ist schon eine Feldlinie)
    for (const l of [-1.5, 1.5]) lines.push(line(side, 0, l, L, l, 'zone'))
    if (advanced) lines.push(line(side, 6, -W, 6, W, 'zone'))
    if (letters) {
      // Kreuz in jeder Zone
      for (const l of COLS) lines.push(line(side, 0, l, L, l, 'sub'))
      for (const d of [1.5, 4.5, 7.5]) lines.push(line(side, d, -W, d, W, 'sub'))
    }

    const rows: { depth: number; numbers: number[] }[] = advanced
      ? [
          { depth: 1.5, numbers: FRONT },
          { depth: 4.5, numbers: MIDDLE },
          { depth: 7.5, numbers: BACK }
        ]
      : [
          { depth: 1.5, numbers: FRONT },
          { depth: 6, numbers: BACK }
        ]
    const size = letters ? 0.8 : advanced ? 1.1 : 1.3
    for (const row of rows) {
      row.numbers.forEach((n, i) => {
        const c = toWorld(side, row.depth, COLS[i])
        labels.push({ text: String(n), x: c.x, y: c.y, size, kind: 'zone', disc: letters })
        if (!letters) return
        for (const [ch, lat, dep] of SUBS) {
          const p = toWorld(side, row.depth + dep * SUB_OFFSET, COLS[i] + lat * SUB_OFFSET)
          labels.push({ text: ch, x: p.x, y: p.y, size: 0.5, kind: 'sub', disc: false })
        }
      })
    }
  }
  return { lines, labels }
}
