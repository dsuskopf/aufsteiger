import { describe, expect, it } from 'vitest'
import { FRAME_DT, advance, ballAt, buildTimeline, stepFrame } from './timeline'
import type { TrajectoryInput } from '../physics/trajectory'

const annahme: TrajectoryInput = { start: { x: -7, y: 2, h: 0.8 }, end: { x: -1.5, y: 1 }, apexH: 4, hitH: 2.5 }
const zuspiel: TrajectoryInput = { start: { x: -1.5, y: 1, h: 2.5 }, end: { x: -1, y: -3.5 }, apexH: 4.5, hitH: 3 }

describe('timeline', () => {
  it('reiht Segmente aneinander', () => {
    const tl = buildTimeline([
      { type: 'annahme', input: annahme },
      { type: 'zuspiel', input: zuspiel }
    ])
    expect(tl.segments[1].t0).toBeCloseTo(tl.segments[0].t1, 12)
    expect(tl.total).toBeCloseTo(tl.segments[0].sol.tHit + tl.segments[1].sol.tHit, 12)
  })

  it('Ball startet am Start, ist am Ende am Schlagpunkt des letzten Segments', () => {
    const tl = buildTimeline([
      { type: 'annahme', input: annahme },
      { type: 'zuspiel', input: zuspiel }
    ])
    const b0 = ballAt(tl, 0)!
    expect(b0.type).toBe('annahme')
    expect(b0.z).toBeCloseTo(0.8, 6)
    const mid = ballAt(tl, tl.segments[0].t1 + 1e-6)!
    expect(mid.type).toBe('zuspiel')
    const end = ballAt(tl, tl.total + 3)!
    expect(end.x).toBeCloseTo(-1, 5)
    expect(end.z).toBeCloseTo(3, 5)
  })

  it('leere Timeline', () => {
    expect(ballAt(buildTimeline([]), 1)).toBeNull()
  })

  it('advance: Schleife und einmal', () => {
    expect(advance(0.9, 0.2, 1, 1, true).t).toBeCloseTo(0.1, 9)
    expect(advance(0.9, 0.2, 1, 1, false)).toEqual({ t: 1, ended: true })
    expect(advance(0, 0.1, 4, 1, false).t).toBeCloseTo(0.4, 9)
  })

  it('Frame-Schritt ist 1/60 s und bleibt im Bereich', () => {
    expect(stepFrame(0, 1, 1)).toBeCloseTo(FRAME_DT, 12)
    expect(stepFrame(0, -1, 1)).toBe(0)
    expect(stepFrame(1, 1, 1)).toBe(1)
  })
})
