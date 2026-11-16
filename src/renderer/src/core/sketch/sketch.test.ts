import { describe, expect, it } from 'vitest'
import { SKETCH_LIMITS, type SketchStroke } from '@shared/types'
import { sanitizePlay, sanitizeSketch } from '@shared/validate'
import { finishStroke, hitsStroke, simplifyStroke } from './sketch'

describe('Skizze: Striche ausdünnen', () => {
  it('eine gerade Linie behält nur Anfang und Ende', () => {
    const line = Array.from({ length: 50 }, (_, i) => [i * 0.1, 0]).flat()
    expect(simplifyStroke(line, 0.01)).toEqual([0, 0, 4.9, 0])
  })
  it('eine Ecke bleibt erhalten', () => {
    const out = simplifyStroke([0, 0, 1, 0, 2, 0, 2, 1, 2, 2], 0.01)
    expect(out).toEqual([0, 0, 2, 0, 2, 2])
  })
  it('ein Punkt (Tipp) bleibt ein Punkt', () => {
    expect(simplifyStroke([1, 2], 0.01)).toEqual([1, 2])
    expect(finishStroke([1.234, 2.345])).toEqual([1.23, 2.35])
  })
  it('sehr lange Striche bleiben unter der Obergrenze, ohne abgeschnitten zu werden', () => {
    // Zickzack: jeder Punkt ist eine Ecke
    const zig = Array.from({ length: 5000 }, (_, i) => [i * 0.004, i % 2 ? 0.05 : 0]).flat()
    const out = finishStroke(zig)
    expect(out.length).toBeLessThanOrEqual(SKETCH_LIMITS.points * 2)
    expect(out.slice(-2)[0]).toBeCloseTo(4999 * 0.004, 1)
  })
})

describe('Skizze: Radierer', () => {
  const stroke: SketchStroke = { color: 'ink', width: 0.1, points: [0, 0, 4, 0] }
  it('trifft auf dem Strich und knapp daneben', () => {
    expect(hitsStroke(stroke, 2, 0, 0.1)).toBe(true)
    expect(hitsStroke(stroke, 2, 0.14, 0.1)).toBe(true)
  })
  it('trifft nicht daneben und nicht hinter dem Ende', () => {
    expect(hitsStroke(stroke, 2, 0.3, 0.1)).toBe(false)
    expect(hitsStroke(stroke, 4.5, 0, 0.1)).toBe(false)
  })
  it('trifft einen einzelnen Punkt', () => {
    expect(hitsStroke({ color: 'red', width: 0.1, points: [1, 1] }, 1.05, 1, 0.1)).toBe(true)
  })
})

describe('Skizze: gespeicherte Daten prüfen', () => {
  it('verwirft Unbrauchbares und rundet auf Zentimeter', () => {
    const out = sanitizeSketch([
      { color: 'red', width: 0.09, points: [0.123, 1.987, 2, 3] },
      { color: 'pink', width: 99, points: [1, 2, 3] },
      { color: 'blue', points: [1] },
      'unsinn',
      { color: 'blue', width: 0.05, points: [100, -100] }
    ])
    expect(out).toEqual([
      { color: 'red', width: 0.09, points: [0.12, 1.99, 2, 3] },
      { color: 'ink', width: 0.4, points: [1, 2] },
      { color: 'blue', width: 0.05, points: [30, -30] }
    ])
  })
  it('begrenzt Striche und Punkte', () => {
    const many = Array.from({ length: SKETCH_LIMITS.strokes + 50 }, () => ({ color: 'ink', width: 0.05, points: [0, 0, 1, 1] }))
    expect(sanitizeSketch(many)).toHaveLength(SKETCH_LIMITS.strokes)
    const long = [{ color: 'ink', width: 0.05, points: new Array(SKETCH_LIMITS.points * 2 + 100).fill(0) }]
    expect(sanitizeSketch(long)[0].points).toHaveLength(SKETCH_LIMITS.points * 2)
  })
  it('ein Spielzug behält seine Skizze; ältere Spielzüge ohne Skizze bleiben gültig', () => {
    const base = { id: 'abc', code: 'S1', title: '', sides: {}, trajectories: {} }
    expect(sanitizePlay(base)?.sketch).toBeUndefined()
    const doc = sanitizePlay({ ...base, sketch: [{ color: 'green', width: 0.09, points: [0, 0, 1, 1] }] })
    expect(doc?.sketch).toEqual([{ color: 'green', width: 0.09, points: [0, 0, 1, 1] }])
  })
})
