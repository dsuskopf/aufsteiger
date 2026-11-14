import { describe, expect, it } from 'vitest'
import {
  APEX_EPS,
  BALL_RADIUS,
  DRAG_K,
  G,
  clampInput,
  coupleTrajectories,
  distAtHeightFalling,
  distAtHeightRising,
  heightAt,
  hitRanges,
  minHitDist,
  moveHitAlongParabola,
  newTrajectory,
  positionAt,
  projectToHitBranches,
  setHitHeight,
  setHitHeightFixed,
  solveTrajectory,
  stateAt,
  type TrajectoryInput
} from './trajectory'

const base: TrajectoryInput = { start: { x: -6, y: 2, h: 0.8 }, end: { x: -1, y: 0.5 }, apexH: 4, hitH: 2.4 }

describe('solveTrajectory', () => {
  it('geht exakt durch Start und Schlagpunkt', () => {
    const s = solveTrajectory(base)
    expect(heightAt(s, 0)).toBeCloseTo(0.8, 6)
    expect(heightAt(s, s.D)).toBeCloseTo(2.4, 5)
    expect(s.D).toBeCloseTo(Math.hypot(5, 1.5), 9)
  })

  it('Scheitel ist das Maximum, Steigung dort null, liegt zwischen Start und Schlagpunkt', () => {
    const s = solveTrajectory(base)
    expect(heightAt(s, s.sA)).toBeCloseTo(4, 6)
    const d = 1e-3
    expect((heightAt(s, s.sA + d) - heightAt(s, s.sA - d)) / (2 * d)).toBeCloseTo(0, 3)
    for (let x = 0; x <= s.sGround; x += 0.1) expect(heightAt(s, x)).toBeLessThanOrEqual(4 + 1e-6)
    expect(s.sA).toBeGreaterThan(0)
    expect(s.sA).toBeLessThan(s.D)
  })

  it('erfüllt die Bewegungsgleichung mit Schwerkraft und Luftwiderstand', () => {
    const s = solveTrajectory(base)
    const h = 1e-3
    for (const t of [0.1, s.tApex, s.tHit * 0.8]) {
      const a = stateAt(s, t - h)
      const b = stateAt(s, t + h)
      const m = stateAt(s, t)
      const v = Math.hypot(m.vs, m.vz)
      expect((b.vz - a.vz) / (2 * h)).toBeCloseTo(-G - DRAG_K * v * m.vz, 1)
      expect((b.vs - a.vs) / (2 * h)).toBeCloseTo(-DRAG_K * v * m.vs, 1)
    }
  })

  it('Luftwiderstand: Ball wird horizontal langsamer und fällt steiler, als er steigt', () => {
    const sym = solveTrajectory({ start: { x: -6, y: 0, h: 2.5 }, end: { x: 0, y: 0 }, apexH: 5, hitH: 2.5 })
    const { vs } = sym.samples
    for (let i = 1; i < vs.length; i++) expect(vs[i]).toBeLessThan(vs[i - 1])
    // Gleiche Start- und Endhöhe: Scheitel liegt hinter der Mitte, Abstieg dauert länger
    expect(sym.sA).toBeGreaterThan(sym.D / 2 + 0.05)
    expect(sym.tHit - sym.tApex).toBeGreaterThan(sym.tApex)
    expect(sym.vHit).toBeLessThan(Math.hypot(sym.vH, sym.vZ0))
  })

  it('realistische Werte für eine Annahme', () => {
    const s = solveTrajectory({ start: { x: -8, y: 0, h: 0.8 }, end: { x: -1, y: 0 }, apexH: 4.5, hitH: 2.5 })
    const kmh = Math.hypot(s.vH, s.vZ0) * 3.6
    expect(kmh).toBeGreaterThan(30)
    expect(kmh).toBeLessThan(50)
    expect(s.tHit).toBeGreaterThan(1.2)
    expect(s.tHit).toBeLessThan(1.8)
  })

  it('offizieller Ballradius (Umfang 65–67 cm)', () => {
    expect(2 * Math.PI * BALL_RADIUS).toBeGreaterThanOrEqual(0.65)
    expect(2 * Math.PI * BALL_RADIUS).toBeLessThanOrEqual(0.67)
  })

  it('positionAt(tHit) ergibt den Schlagpunkt, danach fällt er bis zum Boden', () => {
    const s = solveTrajectory(base)
    const p = positionAt(s, base.start, s.tHit)
    expect(p.x).toBeCloseTo(-1, 5)
    expect(p.y).toBeCloseTo(0.5, 5)
    expect(p.z).toBeCloseTo(2.4, 5)
    expect(positionAt(s, base.start, s.tGround).z).toBeCloseTo(0, 6)
    expect(positionAt(s, base.start, s.tGround + 5).z).toBe(0)
  })

  it('klemmt den Scheitel über Start und Schlagpunkt', () => {
    const s = solveTrajectory({ ...base, apexH: 1 })
    expect(s.apexH).toBeCloseTo(2.4 + APEX_EPS, 9)
    expect(Number.isFinite(s.tHit)).toBe(true)
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
      for (const v of [s.D, s.sA, s.sGround, s.vH, s.vZ0, s.vHit, s.tHit, s.tGround]) expect(Number.isFinite(v)).toBe(true)
      expect(s.D).toBeGreaterThan(0)
    }
  })
})

describe('Schlagpunkt verschieben', () => {
  it('bleibt auf der Parabel, Richtung bleibt gleich', () => {
    const s0 = solveTrajectory(base)
    const moved = moveHitAlongParabola(base, s0.D + 1)
    const s1 = solveTrajectory(moved)
    // Dieselbe Flugkurve: gleicher Scheitel, gleiche Abfluggeschwindigkeit
    expect(s1.sA).toBeCloseTo(s0.sA, 4)
    expect(s1.vH).toBeCloseTo(s0.vH, 4)
    expect(s1.vZ0).toBeCloseTo(s0.vZ0, 4)
    expect(heightAt(s1, s0.D)).toBeCloseTo(2.4, 4)
    expect(s1.dir.dx).toBeCloseTo(s0.dir.dx, 9)
    expect(s1.D).toBeCloseTo(s0.D + 1, 9)
    expect(moved.hitH).toBeCloseTo(heightAt(s0, s0.D + 1), 9)
  })

  it('Distanz zu einer Höhe auf dem fallenden Ast ist die Umkehrung von heightAt', () => {
    const s = solveTrajectory(base)
    for (const h of [3.9, 3, 2.4, 1, 0.2]) expect(heightAt(s, distAtHeightFalling(s, h))).toBeCloseTo(h, 4)
  })

  it('nicht vor den Start, nicht in die Lücke am Scheitel und nicht unter den Boden', () => {
    const s0 = solveTrajectory(base)
    const r = hitRanges(s0)
    expect(r.rising).not.toBeNull()
    const near = moveHitAlongParabola(base, 0)
    expect(near.rising).toBe(true)
    expect(solveTrajectory(near).D).toBeCloseTo(r.rising![0], 6)
    // Knapp hinter dem Scheitel → fallender Ast, knapp davor → steigender
    expect(moveHitAlongParabola(base, s0.sA + 0.001).rising).toBeUndefined()
    expect(solveTrajectory(moveHitAlongParabola(base, s0.sA + 0.001)).D).toBeCloseTo(minHitDist(s0), 6)
    expect(moveHitAlongParabola(base, r.rising![1] - 0.01).rising).toBe(true)
    const far = moveHitAlongParabola(base, 100)
    expect(far.hitH).toBeCloseTo(0, 6)
  })

  it('über den Scheitel auf den steigenden Ast: dieselbe Flugkurve', () => {
    const s0 = solveTrajectory(base)
    const moved = moveHitAlongParabola(base, s0.sA * 0.5)
    expect(moved.rising).toBe(true)
    const s1 = solveTrajectory(moved)
    expect(s1.rising).toBe(true)
    expect(s1.D).toBeCloseTo(s0.sA * 0.5, 9)
    expect(s1.sA).toBeCloseTo(s0.sA, 4)
    expect(s1.vH).toBeCloseTo(s0.vH, 4)
    expect(s1.vZ0).toBeCloseTo(s0.vZ0, 4)
    expect(s1.sGround).toBeCloseTo(s0.sGround, 3)
    // Schlagpunkt liegt vor dem Scheitel und wird früher erreicht
    expect(s1.tHit).toBeLessThan(s1.tApex)
    expect(heightAt(s1, s1.D)).toBeCloseTo(moved.hitH, 4)
    // und zurück auf den fallenden Ast
    const back = solveTrajectory(moveHitAlongParabola(moved, s0.D))
    expect(back.rising).toBe(false)
    expect(back.vH).toBeCloseTo(s0.vH, 4)
  })

  it('steigender Schlagpunkt direkt gelöst: Höhe stimmt, Scheitel dahinter', () => {
    const r: TrajectoryInput = { start: { x: 0, y: 0, h: 1 }, end: { x: 3, y: 0 }, apexH: 5, hitH: 3, rising: true }
    const s = solveTrajectory(r)
    expect(heightAt(s, 3)).toBeCloseTo(3, 4)
    expect(s.sA).toBeGreaterThan(3)
    expect(heightAt(s, s.sA)).toBeCloseTo(5, 5)
    // Ball steigt am Schlagpunkt noch
    expect(heightAt(s, 3.05)).toBeGreaterThan(heightAt(s, 3))
    // Schlagpunkt unter dem Start ist auf dem steigenden Ast unmöglich → wird über den Start gehoben
    expect(clampInput({ ...r, hitH: 0.5 }).hitH).toBeGreaterThan(1)
  })

  it('Höhe setzen auf dem gewählten Ast', () => {
    const s0 = solveTrajectory(base)
    const up = setHitHeight(base, 3, true)
    expect(up.rising).toBe(true)
    expect(up.hitH).toBeCloseTo(3, 3)
    expect(solveTrajectory(up).D).toBeCloseTo(distAtHeightRising(s0, 3), 3)
    const down = setHitHeight(up, 3, false)
    expect(down.rising).toBeUndefined()
    expect(solveTrajectory(down).D).toBeCloseTo(distAtHeightFalling(s0, 3), 3)
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
      const v = projectToHitBranches(s, base.start, project, px, -heightAt(s, px / 50) * 50)
      expect(v).toBeGreaterThanOrEqual(last - 1e-9)
      expect(v).toBeGreaterThan(0)
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

describe('Kopplung mit steigendem Zuspiel', () => {
  it('liegt der neue Start zu hoch, wird der steigende Schlagpunkt zum fallenden', () => {
    const annahme: TrajectoryInput = { start: { x: -7, y: 1, h: 0.8 }, end: { x: -1.5, y: 0 }, apexH: 5.8, hitH: 3.2 }
    const zuspiel: TrajectoryInput = { start: { x: -1.5, y: 0, h: 2.5 }, end: { x: -1.2, y: 0.3 }, apexH: 4, hitH: 3, rising: true }
    const c = coupleTrajectories({ annahme, zuspiel })
    expect(c.zuspiel!.start.h).toBe(3.2)
    expect(c.zuspiel!.rising).toBeUndefined()
    expect(c.zuspiel!.hitH).toBe(3)
  })
})

describe('Schlagpunkt-Höhe bei festem Ort', () => {
  it('Ort bleibt, Höhe ändert sich, der höchste Punkt wandert und wird bei Bedarf angehoben', () => {
    const lower = setHitHeightFixed(base, 2.0)
    expect(lower.end).toEqual(base.end)
    expect(lower.start).toEqual(base.start)
    expect(lower.hitH).toBeCloseTo(2.0, 9)
    expect(lower.apexH).toBeCloseTo(base.apexH, 9)
    const s0 = solveTrajectory(base)
    const s1 = solveTrajectory(lower)
    expect(s1.D).toBeCloseTo(s0.D, 9)
    // Der Scheitel liegt jetzt an einer anderen Stelle
    expect(Math.abs(s1.sA - s0.sA)).toBeGreaterThan(0.01)
    // Über den Scheitel hinaus: Scheitel wird mitgenommen
    const high = setHitHeightFixed(base, 4.2)
    expect(high.end).toEqual(base.end)
    expect(high.apexH).toBeGreaterThan(4.2)
    // Steigend: bleibt über dem Start
    const rise = setHitHeightFixed(base, 0.2, true)
    expect(rise.rising).toBe(true)
    expect(rise.hitH).toBeGreaterThan(base.start.h)
  })
})
