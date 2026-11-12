import { describe, expect, it } from 'vitest'
import type { Player, Team } from '@shared/types'
import { autoLineup, isBackRow, slotPosition } from './lineup'
import { currentLaeufer, formationChanged, formationOf, laeuferLineup, rotateSlot } from './rotation'

const pl = (id: string, ...positions: Player['positions']): Player => ({ id, name: id, number: 1, positions, height: 1.8 })
const team: Team = {
  id: 't',
  name: 'T',
  color: '#000000',
  liberoColor: '#ffffff',
  players: [pl('s', 'S'), pl('mb1', 'MB'), pl('a1', 'A'), pl('d', 'D'), pl('mb2', 'MB'), pl('a2', 'A'), pl('l', 'L')]
}

describe('Läufersystem', () => {
  it('rotiert im Uhrzeigersinn: 2 → 1 → 6 → 5 → 4 → 3 → 2', () => {
    expect([2, 1, 6, 5, 4, 3].map((s) => rotateSlot(s, 1))).toEqual([1, 6, 5, 4, 3, 2])
    expect(rotateSlot(2, 6)).toBe(2)
  })

  it('Grundaufstellung ist Läufer 2; Läufer 1 = eine Rotation weiter', () => {
    const side = autoLineup(team, 'A')
    expect(currentLaeufer(side, team)).toBe(2)
    const l1 = laeuferLineup(side, team, 'A', 1, 'annahme')
    expect(l1.laeufer).toEqual({ n: 1, situation: 'annahme' })
    expect(l1.players.find((c) => c.playerId === 's')!.slot).toBe(1)
    expect(currentLaeufer(l1, team)).toBe(1)
    // Reihenfolge bleibt: der Diagonal steht immer gegenüber dem Steller
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const r = laeuferLineup(side, team, 'A', n, 'annahme')
      const sSlot = r.players.find((c) => c.playerId === 's')!.slot!
      expect(r.players.find((c) => c.playerId === 'd')!.slot).toBe(rotateSlot(sSlot, 3))
      expect(r.players).toHaveLength(6)
    }
  })

  it('Libero ersetzt immer den MB im Hinterfeld – beim Aufschlag nicht den aufschlagenden MB', () => {
    const side = autoLineup(team, 'A')
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const r = laeuferLineup(side, team, 'A', n, 'annahme')
      const lib = r.players.find((c) => c.playerId === 'l')!
      expect(isBackRow(lib.slot)).toBe(true)
      expect(['mb1', 'mb2']).toContain(r.liberoFor)
    }
    // Läufer 3: Steller auf 3 → MB von 3 steht auf 1 (Aufschläger)
    const base = laeuferLineup(side, team, 'A', 3, 'aufschlag')
    const server = base.players.find((c) => c.slot === 1)!
    if (server.playerId.startsWith('mb')) {
      expect(base.liberoFor).toBeUndefined()
      expect(base.liberoIdle).toBe('l')
      // Danach (Annahme) kommt der Libero zurück
      const back = laeuferLineup(base, team, 'A', 2, 'annahme')
      expect(back.players.some((c) => c.playerId === 'l')).toBe(true)
    }
  })

  it('gespeicherte Plätze werden genutzt, Seite B gespiegelt', () => {
    const side = autoLineup(team, 'B')
    const r = laeuferLineup(side, team, 'B', 1, 'annahme')
    const f = formationOf({ ...r, players: r.players.map((c) => (c.playerId === 'a1' ? { ...c, x: 5, y: 1 } : c)) }, 'B')
    expect(f.pos.a1).toEqual({ x: -5, y: -1 })
    const withF: Team = { ...team, rotations: { '1-annahme': f } }
    const again = laeuferLineup(r, withF, 'B', 1, 'annahme')
    expect(again.players.find((c) => c.playerId === 'a1')).toMatchObject({ x: 5, y: 1 })
    expect(formationChanged(again, withF, 'B')).toBe(false)
    expect(formationChanged(again, team, 'B')).toBe(true)
  })

  it('Aufschlag: Spieler auf 1 steht hinter der Grundlinie', () => {
    const r = laeuferLineup(autoLineup(team, 'A'), team, 'A', 2, 'aufschlag')
    const server = r.players.find((c) => c.slot === 1)!
    expect(server.x).toBeLessThan(-9)
    expect(slotPosition('A', 1).x).toBeGreaterThan(-9)
  })
})

describe('Hervorhebung des Bezugs-Stellers', () => {
  it('markiert den Steller; steht der Libero für ihn, den Libero (gestrichelt)', async () => {
    const { laeuferMarker } = await import('./rotation')
    const side = autoLineup(team, 'A')
    expect(laeuferMarker(side, team)).toEqual({ playerId: 's', standIn: false })
    // Läufer 1: Steller hinten; Libero für den Steller einwechseln
    const l1 = laeuferLineup(side, team, 'A', 1, 'annahme')
    const { setLiberoFor } = await import('./lineup')
    const swapped = setLiberoFor(l1, team, 's', 'A')
    expect(swapped.liberoFor).toBe('s')
    expect(laeuferMarker(swapped, team)).toEqual({ playerId: 'l', standIn: true })
  })
})
