import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/types'
import { newTrajectory } from '@renderer/core/physics/trajectory'
import { trajectoryDefaults } from './appSettings'

describe('Standardwerte neuer Flugbahnen', () => {
  it('Zuspiel an einer Annahme startet auf deren Schlagpunkthöhe, Scheitel = Start + Offset', () => {
    const annahme = { start: { x: -7, y: 0, h: 0.8 }, end: { x: -2, y: 1 }, apexH: 4, hitH: 3.4 }
    const d = trajectoryDefaults('zuspiel', DEFAULT_SETTINGS, annahme)
    expect(d.startH).toBe(3.4)
    const z = newTrajectory({ x: -2, y: 1 }, { x: -1, y: -3 }, d)
    expect(z.apexH).toBeCloseTo(3.4 + DEFAULT_SETTINGS.defaultApexOffsetZuspiel, 9)
  })

  it('ohne Annahme gilt die Standard-Starthöhe Zuspiel', () => {
    expect(trajectoryDefaults('zuspiel', DEFAULT_SETTINGS).startH).toBe(DEFAULT_SETTINGS.defaultStartHZuspiel)
    expect(trajectoryDefaults('annahme', DEFAULT_SETTINGS).hitH).toBe(DEFAULT_SETTINGS.defaultEndHAnnahme)
  })
})
