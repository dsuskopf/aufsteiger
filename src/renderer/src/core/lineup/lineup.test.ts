import { describe, expect, it } from 'vitest'
import type { PlaySide, Player, Team } from '@shared/types'
import {
  addBlocker,
  addToLineup,
  allowedRoles,
  autoLineup,
  clampLibero,
  clampToArea,
  inferSlots,
  removeFromLineup,
  setLiberoFor,
  slotPosition,
  syncWithTeam
} from './lineup'

const pl = (id: string, number: number, ...positions: Player['positions']): Player => ({
  id,
  name: id,
  number,
  positions,
  height: 1.75
})

const team: Team = {
  id: 't',
  name: 'Test',
  color: '#5b2a86',
  liberoColor: '#e8c547',
  players: [
    pl('libero', 1, 'L'),
    pl('aa1', 4, 'A'),
    pl('s', 7, 'S'),
    pl('mb1', 9, 'MB'),
    pl('da', 10, 'D', 'A'),
    pl('aa2', 12, 'A'),
    pl('mb2', 15, 'MB'),
    pl('s2', 3, 'S')
  ]
}
const byId = (id: string) => team.players.find((p) => p.id === id)!
const at = (s: PlaySide, id: string) => s.players.find((c) => c.playerId === id)

describe('Aufstellung', () => {
  it('Seite B ist an der Feldmitte gespiegelt', () => {
    expect(slotPosition('A', 1)).toEqual({ x: -6.5, y: -3 })
    expect(slotPosition('B', 1)).toEqual({ x: 6.5, y: 3 })
    expect(Math.abs(slotPosition('A', 3).x)).toBeLessThan(3)
  })

  it('Grundaufstellung: Steller 2, MB 3, Außen 4, Diagonal 5, MB 6, Außen 1 – Libero ersetzt den MB hinten', () => {
    const side = autoLineup(team, 'A')
    expect(side.players).toHaveLength(6)
    expect(at(side, 's')).toMatchObject({ role: 'S', slot: 2, ...slotPosition('A', 2) })
    expect(at(side, 'mb1')).toMatchObject({ role: 'MB', slot: 3 })
    expect(at(side, 'da')).toMatchObject({ role: 'D', slot: 5 })
    expect(new Set(side.players.filter((c) => c.role === 'A').map((c) => c.slot))).toEqual(new Set([4, 1]))
    // MB2 stand auf 6 und wird vom Libero ersetzt
    expect(side.liberoFor).toBe('mb2')
    expect(side.liberoRole).toBe('MB')
    expect(at(side, 'libero')).toMatchObject({ role: 'L', slot: 6, ...slotPosition('A', 6) })
    expect(at(side, 'mb2')).toBeUndefined()
    expect(at(side, 's2')).toBeUndefined()
  })

  it('ohne Diagonal: zweiter Steller auf 5', () => {
    const t: Team = { ...team, players: team.players.filter((p) => p.id !== 'da') }
    const side = autoLineup(t, 'A')
    expect(at(side, 's2')).toMatchObject({ role: 'S', slot: 5 })
  })

  it('Team ohne Libero und mit fehlender Position: Libero nur, wenn vorhanden; Rest bleibt leer mit Regeln', () => {
    const small: Team = { ...team, players: [byId('s'), byId('aa1'), byId('libero')] }
    const side = autoLineup(small, 'B')
    expect(side.players.map((c) => c.playerId).sort()).toEqual(['aa1', 'libero', 's'])
    // Libero nimmt eine freie Hinterfeldposition (kein Ersetzter)
    expect(side.liberoFor).toBeUndefined()
    expect([1, 5, 6]).toContain(at(side, 'libero')!.slot)
  })

  it('Regeln: Zusammensetzung begrenzt die Rollen', () => {
    const side = autoLineup(team, 'A')
    // Dritter Außen/zweiter Steller passt nicht mehr
    expect(allowedRoles(byId('s2'), side.players, true)).toEqual([])
    expect(addBlocker(removeFromLineup(side, 'aa1'), byId('s2'), true)).toMatch(/besetzt/)
    // Ohne Regeln geht alles
    expect(allowedRoles(byId('s2'), side.players, false)).toEqual(['S'])
    // Diagonal raus → zweiter Steller passt (2 Steller statt Steller + Diagonal)
    const noD = removeFromLineup(side, 'da')
    expect(allowedRoles(byId('s2'), noD.players, true)).toEqual(['S'])
    const withS2 = addToLineup(noD, byId('s2'), 'A')
    expect(at(withS2, 's2')).toMatchObject({ role: 'S', slot: 5 })
    // Zwei Steller → kein Diagonal mehr
    expect(allowedRoles(byId('da'), withS2.players, true)).toEqual([])
  })

  it('Libero: geht er vom Feld, kommt der Ersetzte auf seine Position zurück', () => {
    const side = autoLineup(team, 'A')
    const out = removeFromLineup(side, 'libero')
    expect(out.liberoFor).toBeUndefined()
    expect(at(out, 'mb2')).toMatchObject({ role: 'MB', slot: 6, ...slotPosition('A', 6) })
    // Wieder rein: ersetzt erneut den MB hinten
    const back = addToLineup(out, byId('libero'), 'A')
    expect(back.liberoFor).toBe('mb2')
    expect(back.players).toHaveLength(6)
    // Den Ersetzten antippen holt ihn zurück
    expect(addToLineup(back, byId('mb2'), 'A').liberoFor).toBeUndefined()
  })

  it('Libero für einen anderen Hinterfeldspieler – nie für einen Vorderspieler', () => {
    const side = autoLineup(team, 'A')
    const a1 = side.players.find((c) => c.role === 'A' && c.slot === 1)!
    const swapped = setLiberoFor(side, team, a1.playerId, 'A')
    expect(swapped.liberoFor).toBe(a1.playerId)
    expect(at(swapped, 'mb2')).toMatchObject({ slot: 6, role: 'MB' })
    expect(at(swapped, 'libero')).toMatchObject({ slot: 1 })
    expect(setLiberoFor(side, team, 's', 'A')).toBe(side)
  })

  it('Libero mit Regeln nur hinter der 3-m-Linie', () => {
    expect(clampLibero('A', -1, 0).x).toBe(-3)
    expect(clampLibero('B', 1, 0).x).toBe(3)
    expect(clampLibero('A', -8, 1)).toEqual({ x: -8, y: 1 })
  })

  it('addToLineup: max. 6, keine Doppelten, passende freie Position', () => {
    const empty: PlaySide = { teamId: 't', players: [] }
    let l = addToLineup(empty, byId('aa1'), 'A')
    l = addToLineup(l, byId('aa1'), 'A')
    expect(l.players).toHaveLength(1)
    expect(l.players[0].slot).toBe(1)
    l = addToLineup(l, byId('s'), 'A')
    expect(at(l, 's')).toMatchObject({ slot: 2, ...slotPosition('A', 2) })
    const full = autoLineup(team, 'A')
    expect(addToLineup(full, byId('s2'), 'A')).toBe(full)
  })

  it('syncWithTeam entfernt gelöschte Spieler, korrigiert Rollen und hebt den Libero-Verweis auf', () => {
    const side = autoLineup(team, 'A')
    const changed: Team = {
      ...team,
      players: team.players
        .filter((p) => p.id !== 'aa1' && p.id !== 'mb2')
        .map((p) => (p.id === 'da' ? { ...p, positions: ['A' as const] } : p))
    }
    const synced = syncWithTeam(side, changed)
    expect(at(synced, 'aa1')).toBeUndefined()
    expect(at(synced, 'da')?.role).toBe('A')
    expect(synced.liberoFor).toBeUndefined()
    expect(syncWithTeam(synced, changed)).toBe(synced)
    expect(syncWithTeam(side, undefined)).toEqual({ teamId: null, players: [] })
  })

  it('inferSlots: ältere Spielzüge bekommen die nächstgelegene Position', () => {
    const players = [
      { playerId: 'a', role: 'A' as const, x: -6.4, y: -2.9 },
      { playerId: 'b', role: 'S' as const, x: -1.6, y: -3.1 }
    ]
    const r = inferSlots(players, 'A')
    expect(r.map((c) => c.slot)).toEqual([1, 2])
    expect(inferSlots(r, 'A')).toBe(r)
  })

  it('clampToArea hält Spieler im Feld + Freizone', () => {
    const c = clampToArea(100, -100)
    expect(c.x).toBeCloseTo(10.7)
    expect(c.y).toBeCloseTo(-6.2)
  })
})
