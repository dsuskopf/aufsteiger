import { describe, expect, it } from 'vitest'
import type { Player, Team } from '@shared/types'
import { addToLineup, autoLineup, clampToArea, slotPosition, syncWithTeam } from './lineup'

const pl = (id: string, number: number, ...positions: Player['positions']): Player => ({
  id,
  name: id,
  number,
  positions
})

const team: Team = {
  id: 't',
  name: 'Test',
  players: [
    pl('libero', 1, 'L'),
    pl('aa1', 4, 'AA'),
    pl('s', 7, 'S'),
    pl('mb1', 9, 'MB'),
    pl('da', 10, 'DA', 'AA'),
    pl('aa2', 12, 'AA'),
    pl('mb2', 15, 'MB'),
    pl('s2', 3, 'S')
  ]
}

describe('Aufstellung', () => {
  it('Seite B ist an der Feldmitte gespiegelt', () => {
    expect(slotPosition('A', 1)).toEqual({ x: -6.5, y: -3 })
    expect(slotPosition('B', 1)).toEqual({ x: 6.5, y: 3 })
    expect(Math.abs(slotPosition('A', 3).x)).toBeLessThan(3)
  })

  it('autoLineup: 5-1 nach Positionen, ohne Libero', () => {
    const lineup = autoLineup(team, 'A')
    expect(lineup).toHaveLength(6)
    const roleOf = (id: string) => lineup.find((c) => c.playerId === id)?.role
    expect(roleOf('s')).toBe('S')
    expect(roleOf('da')).toBe('DA')
    expect(roleOf('mb1')).toBe('MB')
    expect(roleOf('mb2')).toBe('MB')
    expect(roleOf('aa1')).toBe('AA')
    expect(roleOf('aa2')).toBe('AA')
    expect(lineup.some((c) => c.playerId === 'libero')).toBe(false)
    expect(lineup.find((c) => c.playerId === 's')).toMatchObject(slotPosition('A', 1))
  })

  it('autoLineup mit weniger als 6 Spielern', () => {
    const small: Team = { id: 'x', name: 'x', players: team.players.slice(0, 3) }
    const lineup = autoLineup(small, 'B')
    expect(lineup.map((c) => c.playerId).sort()).toEqual(['aa1', 's'])
  })

  it('addToLineup: max. 6, keine Doppelten, freie Position', () => {
    let l = addToLineup([], team.players[1], 'A')
    l = addToLineup(l, team.players[1], 'A')
    expect(l).toHaveLength(1)
    l = addToLineup(l, team.players[2], 'A')
    expect(l[1]).toMatchObject(slotPosition('A', 2))
    const full = autoLineup(team, 'A')
    expect(addToLineup(full, team.players[0], 'A')).toBe(full)
  })

  it('syncWithTeam entfernt gelöschte Spieler und korrigiert Rollen', () => {
    const lineup = autoLineup(team, 'A')
    const changed: Team = {
      ...team,
      players: team.players
        .filter((p) => p.id !== 'aa1')
        .map((p) => (p.id === 'da' ? { ...p, positions: ['AA' as const] } : p))
    }
    const synced = syncWithTeam(lineup, changed)
    expect(synced.some((c) => c.playerId === 'aa1')).toBe(false)
    expect(synced.find((c) => c.playerId === 'da')?.role).toBe('AA')
    expect(syncWithTeam(synced, changed)).toBe(synced)
    expect(syncWithTeam(lineup, undefined)).toEqual([])
  })

  it('clampToArea hält Spieler im Feld + Freizone', () => {
    const c = clampToArea(100, -100)
    expect(c.x).toBeCloseTo(10.7)
    expect(c.y).toBeCloseTo(-6.2)
  })
})
