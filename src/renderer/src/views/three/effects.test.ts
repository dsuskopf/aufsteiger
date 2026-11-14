import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { BallEvent } from '@renderer/core/physics/rally'
import { cameraShake } from './effects'

const floor = (t: number, speed: number): BallEvent => ({ t, kind: 'boden', x: 5, y: 0, z: 0, speed })

describe('Kamera-Wackeln', () => {
  it('wackelt beim ersten Aufprall, beim Nachspringen höchstens minimal', () => {
    const events = [floor(1, 22), floor(2, 14), floor(2.6, 22)]
    const at = (t: number) => cameraShake(events, t, new THREE.Vector3()).length()
    const first = Math.max(...[0.005, 0.01, 0.02].map((d) => at(1 + d)))
    expect(first).toBeGreaterThan(0.001)
    // Zweiter Aufprall (nicht so hart): gar nicht
    expect(Math.max(...[0.005, 0.01, 0.02].map((d) => at(2 + d)))).toBe(0)
    // Selbst ein harter späterer Aufprall: weniger als ein Fünftel des ersten
    expect(Math.max(...[0.005, 0.01, 0.02].map((d) => at(2.6 + d)))).toBeLessThan(first * 0.2)
  })
})
