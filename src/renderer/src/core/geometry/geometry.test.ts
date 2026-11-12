import { describe, expect, it } from 'vitest'
import { COURT, NET_PRESETS, clampNetHeight, courtLines, presetForHeight } from './court'
import {
  IDENTITY_VIEW,
  applyViewSide,
  applyViewTop,
  clampView,
  fitViewport,
  zoomAt,
  pxToSide,
  sideToPx,
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

  it('Seitenansicht umkehrbar', () => {
    const vp = { scale: 40, originX: 50, groundY: 500 }
    const p = sideToPx(vp, 6, 2.43)
    const q = pxToSide(vp, p.px, p.py)
    expect(q.s).toBeCloseTo(6)
    expect(q.z).toBeCloseTo(2.43)
  })
})

describe('Draufsicht-Drehung', () => {
  it('jede Vierteldrehung ist umkehrbar', () => {
    for (const r of [0, 1, 2, 3] as const) {
      const vp = fitViewport(800, 1000, 22, 13, 10, r)
      const p = worldToTop(vp, 7, -3)
      const w = topToWorld(vp, p.px, p.py)
      expect(w.x).toBeCloseTo(7)
      expect(w.y).toBeCloseTo(-3)
    }
  })

  it('90 Grad: Feld steht hochkant (Länge vertikal)', () => {
    const vp = fitViewport(600, 1000, 22, 13, 0, 1)
    const a = worldToTop(vp, -9, 0)
    const b = worldToTop(vp, 9, 0)
    expect(Math.abs(a.px - b.px)).toBeCloseTo(0)
    expect(Math.abs(a.py - b.py)).toBeCloseTo(18 * vp.scale)
    expect(vp.scale).toBeCloseTo(Math.min(600 / 13, 1000 / 22))
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

  it('applyView auf Draufsicht und Seite', () => {
    const vp = fitViewport(1000, 600, 22, 13)
    const v = zoomAt(IDENTITY_VIEW, 2, 500, 300)
    const p = worldToTop(applyViewTop(vp, v), 0, 0)
    expect(p.px).toBeCloseTo(500)
    expect(p.py).toBeCloseTo(300)
    const sv = applyViewSide({ scale: 10, originX: 0, groundY: 100 }, { z: 2, tx: 5, ty: -100 })
    expect(sideToPx(sv, 1, 0)).toEqual({ px: 25, py: 100 })
  })

  it('Seitenansicht spiegeln', () => {
    const vp = { scale: 10, originX: 0, groundY: 100, mirror: true, mirrorCenter: 9 }
    expect(sideToPx(vp, 0, 0).px).toBeCloseTo(180)
    expect(sideToPx(vp, 18, 0).px).toBeCloseTo(0)
    expect(pxToSide(vp, 180, 100).s).toBeCloseTo(0)
  })
})
