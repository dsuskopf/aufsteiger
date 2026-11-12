import { describe, expect, it } from 'vitest'
import type { CourtPlayer } from '@shared/types'
import { G } from '../physics/trajectory'
import { jumpAirtime, jumpZ, motionDuration, pathCurve, pathEnd, playerAt, simplify, splinePolyline, strokeToPath } from './motion'

const base: CourtPlayer = { playerId: 'p', role: 'A', x: -6, y: -3 }

describe('Laufwege', () => {
  it('Kurve geht durch Start und alle Punkte', () => {
    const pts = [{ x: -4, y: -1 }, { x: -2, y: -2 }]
    const poly = splinePolyline(base, pts)
    expect(poly[0]).toMatchObject({ x: -6, y: -3 })
    expect(poly[poly.length - 1].x).toBeCloseTo(-2, 9)
    expect(poly.some((p) => Math.abs(p.x + 4) < 1e-9 && Math.abs(p.y + 1) < 1e-9)).toBe(true)
  })

  it('gleichmäßiges Tempo entlang der Kurve, Start nach Verzögerung', () => {
    const c: CourtPlayer = { ...base, path: { points: [{ x: -2, y: -3 }], delay: 0.5, speed: 4 } }
    expect(playerAt(c, 0)).toMatchObject({ x: -6, y: -3, z: 0 })
    expect(playerAt(c, 0.5).x).toBeCloseTo(-6, 9)
    expect(playerAt(c, 1).x).toBeCloseTo(-4, 6)
    expect(pathEnd(c, c.path!)).toBeCloseTo(1.5, 6)
    expect(playerAt(c, 10).x).toBeCloseTo(-2, 9)
    expect(motionDuration([{ teamId: 't', players: [c] }])).toBeCloseTo(1.5, 6)
  })

  it('Kurvenlänge ≥ Luftlinie; Kurve folgt dem Platz des Spielers', () => {
    const path = { points: [{ x: -4, y: 0 }, { x: -2, y: -3 }], delay: 0, speed: 4 }
    const a = pathCurve(base, path)
    expect(a.length).toBeGreaterThan(Math.hypot(4, 0))
    const moved = pathCurve({ ...base, x: -7 }, path)
    expect(moved.poly[0].x).toBe(-7)
  })

  it('Freihand-Strich wird vereinfacht; zu kurz → kein Laufweg', () => {
    const stroke = Array.from({ length: 50 }, (_, i) => ({ x: -6 + i * 0.1, y: -3 + Math.sin(i / 8) }))
    const pts = strokeToPath(stroke)!
    expect(pts.length).toBeGreaterThan(1)
    expect(pts.length).toBeLessThanOrEqual(8)
    expect(pts[pts.length - 1].x).toBeCloseTo(stroke[49].x, 3)
    expect(strokeToPath([{ x: 0, y: 0 }, { x: 0.2, y: 0 }])).toBeNull()
    expect(simplify([{ x: 0, y: 0 }, { x: 1, y: 0.001 }, { x: 2, y: 0 }], 0.01)).toHaveLength(2)
  })
})

describe('Sprung', () => {
  it('senkrechter Wurf: höchster Punkt = Sprunghöhe, danach wieder am Boden', () => {
    const jump = { at: 1, height: 0.6 }
    const T = jumpAirtime(0.6)
    expect(T).toBeCloseTo(2 * Math.sqrt(1.2 / G), 9)
    expect(jumpZ(jump, 1 + T / 2)).toBeCloseTo(0.6, 9)
    expect(jumpZ(jump, 0.9)).toBe(0)
    expect(jumpZ(jump, 1 + T + 0.01)).toBe(0)
    expect(motionDuration([{ teamId: 't', players: [{ ...base, jump }] }])).toBeCloseTo(1 + T, 9)
  })
})
