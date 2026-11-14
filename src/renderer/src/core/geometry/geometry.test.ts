import { describe, expect, it } from 'vitest'
import { COURT, NET_PRESETS, clampNetHeight, courtLines, presetForHeight } from './court'
import {
  IDENTITY_VIEW,
  applyViewTop,
  clampView,
  fitViewport,
  zoomAt,
  netToPx,
  pxToNet,
  isNearSide,
  netProject,
  netDepth,
  netHalfExtent,
  netOrient,
  netViewDir,
  normYaw,
  yawFromOrient,
  threeToWorld,
  topToWorld,
  worldToThree,
  worldToTop
} from './transform'

describe('court', () => {
  it('hat echte Hallenmaße', () => {
    expect(COURT.length).toBe(18)
    expect(COURT.width).toBe(9)
    expect(COURT.attackLineDist).toBe(3)
  })

  it('Netzhöhen-Presets', () => {
    expect(NET_PRESETS.herren.height).toBe(2.43)
    expect(NET_PRESETS.damen.height).toBe(2.24)
    expect(NET_PRESETS.mixed.height).toBe(2.35)
    expect(presetForHeight(2.24)).toBe('damen')
    expect(presetForHeight(2.3)).toBe('custom')
  })

  it('klemmt Netzhöhe', () => {
    expect(clampNetHeight(10)).toBe(3)
    expect(clampNetHeight(0)).toBe(1)
    expect(clampNetHeight(Number.NaN)).toBe(2.43)
  })

  it('Angriffslinien 3 m vom Netz, Mittellinie unter dem Netz', () => {
    const lines = courtLines()
    const attack = lines.filter((l) => l.kind === 'attack').map((l) => Math.abs(l.a.x))
    expect(attack).toEqual([3, 3])
    expect(lines.find((l) => l.kind === 'center')!.a.x).toBe(0)
  })
})

describe('transform', () => {
  it('Draufsicht ist maßstabstreu und umkehrbar', () => {
    const vp = fitViewport(1000, 600, 22, 13, 10)
    expect(vp.scale).toBeCloseTo(Math.min(980 / 22, 580 / 13))
    const p = worldToTop(vp, 4.5, -2)
    const w = topToWorld(vp, p.px, p.py)
    expect(w.x).toBeCloseTo(4.5)
    expect(w.y).toBeCloseTo(-2)
    // 1 m in x und 1 m in y sind gleich viele Pixel
    const a = worldToTop(vp, 0, 0)
    const b = worldToTop(vp, 1, 1)
    expect(b.px - a.px).toBeCloseTo(a.py - b.py)
  })

  it('Three-Adapter: z wird zu y-up, umkehrbar', () => {
    expect(worldToThree(1, 2, 3)).toEqual([1, 3, -2])
    const [tx, ty, tz] = worldToThree(-4, 1.5, 2.43)
    expect(threeToWorld(tx, ty, tz)).toEqual({ x: -4, y: 1.5, z: 2.43 })
  })

})

describe('Draufsicht-Drehung', () => {
  it('jede Drehung ist umkehrbar', () => {
    for (const a of [0, 0.3, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const vp = fitViewport(800, 1000, 22, 13, 10, a)
      const p = worldToTop(vp, 7, -3)
      const w = topToWorld(vp, p.px, p.py)
      expect(w.x).toBeCloseTo(7)
      expect(w.y).toBeCloseTo(-3)
    }
  })

  it('90 Grad: Feld steht hochkant (Länge vertikal)', () => {
    const vp = fitViewport(600, 1000, 22, 13, 0, Math.PI / 2)
    const a = worldToTop(vp, -9, 0)
    const b = worldToTop(vp, 9, 0)
    expect(Math.abs(a.px - b.px)).toBeCloseTo(0)
    expect(Math.abs(a.py - b.py)).toBeCloseTo(18 * vp.scale)
    expect(vp.scale).toBeCloseTo(Math.min(600 / 13, 1000 / 22))
  })

  it('Maßstab ändert sich während der Drehung stetig', () => {
    let prev = fitViewport(1000, 600, 22, 13, 0, 0).scale
    for (let i = 1; i <= 90; i++) {
      const sc = fitViewport(1000, 600, 22, 13, 0, (i / 90) * (Math.PI / 2)).scale
      expect(Math.abs(sc - prev) / prev).toBeLessThan(0.05)
      prev = sc
    }
  })
})

describe('Zoom & Verschieben', () => {
  it('zoomAt hält den Ankerpunkt fest', () => {
    const v = zoomAt(IDENTITY_VIEW, 2, 300, 200)
    expect(v.z).toBe(2)
    expect(300 * v.z + v.tx).toBeCloseTo(300)
    expect(200 * v.z + v.ty).toBeCloseTo(200)
  })

  it('zoomAt klemmt den Zoom', () => {
    expect(zoomAt(IDENTITY_VIEW, 0.1, 0, 0).z).toBe(1)
    expect(zoomAt(IDENTITY_VIEW, 100, 0, 0).z).toBe(8)
  })

  it('clampView zentriert kleinen Inhalt und begrenzt großen', () => {
    const content = { x0: 100, y0: 0, x1: 300, y1: 400 }
    expect(clampView({ z: 1, tx: 50, ty: 0 }, content, 400, 400).tx).toBeCloseTo(0)
    const c = clampView({ z: 4, tx: 1000, ty: 0 }, content, 400, 400)
    expect(c.tx).toBeCloseTo(-400)
    const d = clampView({ z: 4, tx: -5000, ty: 0 }, content, 400, 400)
    expect(300 * 4 + d.tx).toBeCloseTo(400)
  })

  it('clampView zentriert im kleineren Rahmen', () => {
    const content = { x0: 100, y0: 0, x1: 300, y1: 400 }
    // Rahmen = linke Hälfte (0..400) einer 800 px breiten Fläche → Inhalt mittig bei x = 200
    const v = clampView({ z: 1, tx: 0, ty: 0 }, content, 800, 400, { x0: 0, y0: 0, x1: 400, y1: 400 })
    expect((100 + 300) / 2 + v.tx).toBeCloseTo(200)
  })

  it('applyView auf die Draufsicht', () => {
    const vp = fitViewport(1000, 600, 22, 13)
    const v = zoomAt(IDENTITY_VIEW, 2, 500, 300)
    const p = worldToTop(applyViewTop(vp, v), 0, 0)
    expect(p.px).toBeCloseTo(500)
    expect(p.py).toBeCloseTo(300)
  })

})

describe('Netzansicht', () => {
  const vp = { scale: 50, originX: 400, groundY: 600, from: 'A' as const }

  it('von Seite A ist rechts −y, von B gespiegelt', () => {
    // y = −4.5 (Seitenlinie rechts aus Sicht von A)
    expect(netToPx(vp, -4.5, 0).px).toBeCloseTo(400 + 225)
    expect(netToPx({ ...vp, from: 'B' }, -4.5, 0).px).toBeCloseTo(400 - 225)
    expect(netToPx(vp, 0, 2.43).py).toBeCloseTo(600 - 121.5)
  })

  it('ist umkehrbar', () => {
    for (const from of ['A', 'B'] as const) {
      const p = netToPx({ ...vp, from }, 3.2, 1.7)
      const w = pxToNet({ ...vp, from }, p.px, p.py)
      expect(w.y).toBeCloseTo(3.2)
      expect(w.z).toBeCloseTo(1.7)
    }
  })

  it('erkennt die Seite des Betrachters', () => {
    expect(isNearSide({ from: 'A' }, -3)).toBe(true)
    expect(isNearSide({ from: 'A' }, 3)).toBe(false)
    expect(isNearSide({ from: 'B' }, 3)).toBe(true)
  })
})

describe('Netzansicht gedreht', () => {
  const vp = { scale: 50, originX: 400, groundY: 600, from: 'A' as const }
  it('ohne Drehung gleich wie netToPx, x spielt keine Rolle', () => {
    expect(netProject(vp, 5, -4.5, 1).px).toBeCloseTo(netToPx(vp, -4.5, 1).px)
  })
  it('90° gedreht: Blick entlang des Netzes, die Feldlänge liegt quer', () => {
    const r = { ...vp, angle: Math.PI / 2 }
    // Blick in +y-Richtung, rechts = +x
    expect(netProject(r, 9, 0, 0).px).toBeCloseTo(400 + 450)
    expect(netProject(r, 0, 4.5, 0).px).toBeCloseTo(400)
    expect(netDepth(r, 0, 4.5)).toBeCloseTo(4.5)
    expect(netHalfExtent(r, 11, 6.5)).toBeCloseTo(11)
    expect(netHalfExtent(vp, 11, 6.5)).toBeCloseTo(6.5)
  })
  it('freier Blickwinkel rundum: Richtung durchgehend, umkehrbar', () => {
    for (let deg = -400; deg <= 400; deg += 15) {
      const o = netOrient(deg)
      const d = netViewDir({ from: o.from, angle: o.angle })
      const th = (deg * Math.PI) / 180
      expect(d.dx).toBeCloseTo(Math.cos(th))
      expect(d.dy).toBeCloseTo(Math.sin(th))
      expect(Math.abs(o.angleDeg)).toBeLessThanOrEqual(90)
      expect(yawFromOrient(o.from, o.angleDeg)).toBeCloseTo(normYaw(deg))
    }
    expect(netOrient(0).from).toBe('A')
    expect(netOrient(180).from).toBe('B')
    expect(netOrient(180).angleDeg).toBeCloseTo(0)
    expect(normYaw(-45)).toBe(315)
  })
  it('Höhe bleibt senkrecht (nie von oben)', () => {
    const r = { ...vp, angle: 0.7 }
    expect(netProject(r, 3, 2, 2.43).py).toBeCloseTo(600 - 121.5)
    expect(pxToNet(r, 123, netProject(r, 3, 2, 2.43).py).z).toBeCloseTo(2.43)
  })
})
