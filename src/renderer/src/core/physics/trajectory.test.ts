import { describe, expect, it } from 'vitest'
import {
  APEX_EPS,
  G,
  clampInput,
  coupleTrajectories,
  heightAt,
  minHitDist,
  moveHitAlongParabola,
  newTrajectory,
  positionAt,
  projectToFallingBranch,
  solveTrajectory,
  type TrajectoryInput
} from './trajectory'

const base: TrajectoryInput = { start: { x: -6, y: 2, h: 0.8 }, end: { x: -1, y: 0.5 }, apexH: 4, hitH: 2.4 }

describe('solveTrajectory', () => {
  it('geht exakt durch Start und Schlagpunkt', () => {
    const s = solveTrajectory(base)
    expect(heightAt(s, 0)).toBeCloseTo(0.8, 9)
    expect(heightAt(s, s.D)).toBeCloseTo(2.4, 9)
    expect(s.D).toBeCloseTo(Math.hypot(5, 1.5), 9)
  })

  it('Scheitel ist das Maximum, Steigung dort null, liegt zwischen Start und Schlagpunkt', () => {
    const s = solveTrajectory(base)
    expect(heightAt(s, s.sA)).toBeCloseTo(4, 9)
    const d = 1e-5
    expect((heightAt(s, s.sA + d) - heightAt(s, s.sA - d)) / (2 * d)).toBeCloseTo(0, 6)
    for (let x = 0; x <= s.sGround; x += 0.1) expect(heightAt(s, x)).toBeLessThanOrEqual(4 + 1e-9)
    expect(s.sA).toBeGreaterThan(0)
    expect(s.sA).toBeLessThan(s.D)
  })

  it('Geschwindigkeiten passen zu g', () => {
    const s = solveTrajectory(base)
    // Steigzeit vZ0/g = Zeit bis zum Scheitel sA/vH
    expect(s.vZ0 / G).toBeCloseTo(s.sA / s.vH, 9)
    // Fallhöhe vom Scheitel bis zum Schlagpunkt: ½ g t²
    const tFall = (s.D - s.sA) / s.vH
    expect(0.5 * G * tFall ** 2).toBeCloseTo(4 - 2.4, 9)
  })

  it('positionAt(tHit) ergibt den Schlagpunkt, danach fällt er bis zum Boden', () => {
    const s = solveTrajectory(base)
    const p = positionAt(s, base.start, s.tHit)
    expect(p.x).toBeCloseTo(-1, 9)
    expect(p.y).toBeCloseTo(0.5, 9)
    expect(p.z).toBeCloseTo(2.4, 9)
    expect(positionAt(s, base.start, s.tGround).z).toBeCloseTo(0, 6)
    expect(positionAt(s, base.start, s.tGround + 5).z).toBe(0)
  })

  it('klemmt den Scheitel über Start und Schlagpunkt', () => {
    const s = solveTrajectory({ ...base, apexH: 1 })
    expect(s.apexH).toBeCloseTo(2.4 + APEX_EPS, 9)
    expect(Number.isFinite(s.k)).toBe(true)
  })

  it('keine NaN in Grenzfällen', () => {
    const cases: TrajectoryInput[] = [
      { ...base, start: { ...base.start, h: 4 }, apexH: 4 },
      { ...base, hitH: 0 },
      { ...base, end: { ...base.start } },
      { ...base, end: { x: 30, y: -10 } },
      { ...base, apexH: Number.NaN },
      { ...base, start: { ...base.start, h: -3 } }
    ]
    for (const c of cases) {
      const s = solveTrajectory(c)
      for (const v of [s.D, s.k, s.sA, s.sGround, s.vH, s.vZ0, s.tHit, s.tGround]) expect(Number.isFinite(v)).toBe(true)
      expect(s.D).toBeGreaterThan(0)
    }
  })
})

describe('Schlagpunkt verschieben', () => {
  it('bleibt auf der Parabel, Richtung bleibt gleich', () => {
    const s0 = solveTrajectory(base)
    const moved = moveHitAlongParabola(base, s0.D + 1)
    const s1 = solveTrajectory(moved)
    expect(s1.k).toBeCloseTo(s0.k, 9)
    expect(s1.sA).toBeCloseTo(s0.sA, 9)
    expect(s1.dir.dx).toBeCloseTo(s0.dir.dx, 9)
    expect(s1.D).toBeCloseTo(s0.D + 1, 9)
    expect(moved.hitH).toBeCloseTo(heightAt(s0, s0.D + 1), 9)
  })

  it('nur auf dem fallenden Ast und nicht unter den Boden', () => {
    const s0 = solveTrajectory(base)
    expect(solveTrajectory(moveHitAlongParabola(base, 0)).D).toBeCloseTo(minHitDist(s0), 6)
    const far = moveHitAlongParabola(base, 100)
    expect(far.hitH).toBeCloseTo(0, 6)
  })

  it('Projektion ist monoton und im Bereich', () => {
    const s = solveTrajectory(base)
    // Profilprojektion: Pixel = (s, −z)
    const project = (p: { x: number; y: number; z: number }) => ({
      px: Math.hypot(p.x - base.start.x, p.y - base.start.y) * 50,
      py: -p.z * 50
    })
    let last = -Infinity
    for (let px = 0; px <= s.sGround * 50; px += 10) {
      const v = projectToFallingBranch(s, base.start, project, px, -heightAt(s, px / 50) * 50)
      expect(v).toBeGreaterThanOrEqual(last - 1e-9)
      expect(v).toBeGreaterThanOrEqual(minHitDist(s) - 1e-9)
      expect(v).toBeLessThanOrEqual(s.sGround + 1e-9)
      last = v
    }
  })
})

describe('Standardwerte', () => {
  it('neue Bahn: Scheitel = Start + Offset, mindestens 0,3 m über dem Ende', () => {
    const a = newTrajectory({ x: -7, y: 0 }, { x: -2, y: 1 }, { startH: 0.8, hitH: 2.5, apexOffset: 1 })
    expect(a.apexH).toBeCloseTo(2.8, 9)
    const z = newTrajectory({ x: -2, y: 1 }, { x: -1, y: -3 }, { startH: 2.5, hitH: 3, apexOffset: 1 })
    expect(z.apexH).toBeCloseTo(3.5, 9)
  })

  it('clampInput begrenzt Starthöhe', () => {
    expect(clampInput({ ...base, start: { ...base.start, h: 20 } }).start.h).toBe(6)
  })
})

describe('Kopplung Annahme → Zuspiel', () => {
  it('Zuspiel-Start folgt dem Schlagpunkt der Annahme, Ziel und Scheitel bleiben', () => {
    const annahme = { ...base }
    const zuspiel: TrajectoryInput = { start: { x: 0, y: 0, h: 1 }, end: { x: -0.8, y: -3.5 }, apexH: 4.2, hitH: 3 }
    const c = coupleTrajectories({ annahme, zuspiel })
    expect(c.zuspiel!.start).toEqual({ x: -1, y: 0.5, h: 2.4 })
    expect(c.zuspiel!.end).toEqual(zuspiel.end)
    expect(c.zuspiel!.apexH).toBe(4.2)
  })

  it('hebt den Scheitel des Zuspiels, wenn der neue Start höher liegt', () => {
    const annahme = { ...base, hitH: 4.5, apexH: 5 }
    const zuspiel: TrajectoryInput = { start: { x: 0, y: 0, h: 1 }, end: { x: -0.8, y: -3.5 }, apexH: 4.2, hitH: 3 }
    const c = coupleTrajectories({ annahme, zuspiel })
    expect(c.zuspiel!.apexH).toBeCloseTo(4.5 + APEX_EPS, 9)
  })

  it('ohne Annahme bleibt das Zuspiel unverändert', () => {
    const zuspiel: TrajectoryInput = { start: { x: 0, y: 0, h: 1 }, end: { x: -0.8, y: -3.5 }, apexH: 4.2, hitH: 3 }
    const tr = { zuspiel }
    expect(coupleTrajectories(tr)).toBe(tr)
  })
})
