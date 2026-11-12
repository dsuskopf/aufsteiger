import { describe, expect, it } from 'vitest'
import { CAMERA_LIMITS, clampTarget, polarAngle } from './camera'

describe('Kamera-Begrenzung', () => {
  it('erlaubt nur die obere Halbkugel', () => {
    expect(CAMERA_LIMITS.minPolar).toBe(0)
    expect(CAMERA_LIMITS.maxPolar).toBeLessThan(Math.PI / 2)
  })

  it('Ziel nie unter dem Boden', () => {
    expect(clampTarget({ x: 0, y: -3, z: 0 }).y).toBe(0)
    expect(clampTarget({ x: 100, y: 1, z: -100 })).toEqual({ x: 14, y: 1, z: -10 })
  })

  it('Polarwinkel', () => {
    expect(polarAngle({ x: 0, y: 5, z: 0 })).toBeCloseTo(0)
    expect(polarAngle({ x: 5, y: 0, z: 0 })).toBeCloseTo(Math.PI / 2)
  })
})
