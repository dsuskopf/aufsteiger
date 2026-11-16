import { describe, expect, it } from 'vitest'
import { clampHeight, sanitizePlay, sanitizeSettings, sanitizeTeams } from './validate'

describe('sanitizeTeams', () => {
  it('bereinigt fehlerhafte Daten', () => {
    const teams = sanitizeTeams({
      teams: [
        {
          id: 'a',
          name: 'A',
          players: [{ id: 'p', name: 'X', number: 123, positions: ['S', 'S', 'XX', 'L'] }, 5]
        },
        { name: 'ohne id' },
        null
      ]
    })
    expect(teams).toHaveLength(1)
    expect(teams[0].players).toEqual([{ id: 'p', name: 'X', number: 99, positions: ['S', 'L'], height: 1.75 }])
    expect(teams[0].color).toBe('#1f4e79')
    expect(teams[0].liberoColor).toBe('#ef8a52')
  })

  it('migriert alte Rollen AA/DA und übernimmt gültige Farben', () => {
    const [t] = sanitizeTeams([
      {
        id: 'a',
        name: 'A',
        color: '#8E2438',
        liberoColor: 'rot',
        players: [{ id: 'p', name: 'X', number: 4, positions: ['AA', 'DA', 'A'] }]
      }
    ])
    expect(t.players[0].positions).toEqual(['A', 'D'])
    expect(t.color).toBe('#8e2438')
    // ungültige Libero-Farbe → Partner von Bordeaux
    expect(t.liberoColor).toBe('#e8c547')
  })

  it('Körpergröße: Standard 1,75 m, mindestens 1,0 m', () => {
    expect(clampHeight(undefined)).toBe(1.75)
    expect(clampHeight('abc')).toBe(1.75)
    expect(clampHeight(0.5)).toBe(1)
    expect(clampHeight(3)).toBe(2.5)
    expect(clampHeight(2.45)).toBe(2.45)
    expect(clampHeight(1.874)).toBe(1.87)
  })

  it('leere Eingabe', () => {
    expect(sanitizeTeams(undefined)).toEqual([])
    expect(sanitizeTeams([])).toEqual([])
  })
})

describe('Rundreise neuer Felder', () => {
  it('Spielzug: Position, Laufweg, Sprung, Läufer, Libero (ersetzt / draußen)', () => {
    const doc = {
      id: 'x1',
      sides: {
        A: {
          teamId: 't',
          players: [
            { playerId: 'a', role: 'A', x: -6, y: -3, slot: 1, path: { points: [{ x: -4, y: 0 }, { x: -2, y: 1 }], delay: 0.4, speed: 5 }, jump: { at: 1.2, height: 0.7 } },
            { playerId: 'l', role: 'L', x: -6.5, y: 0, slot: 6 }
          ],
          liberoFor: 'mb',
          liberoRole: 'MB',
          laeufer: { n: 3, situation: 'aufschlag' }
        },
        B: { teamId: 't2', players: [{ playerId: 'b', role: 'S', x: 2, y: 1, slot: 2 }], liberoIdle: 'lb' }
      },
      trajectories: { zuspiel: { start: { x: 0, y: 0, h: 2 }, end: { x: 1, y: 0 }, apexH: 4, hitH: 3, rising: true } }
    }
    const p = sanitizePlay(doc)!
    expect(p.sides.A.players[0]).toMatchObject({ slot: 1, path: { points: [{ x: -4, y: 0 }, { x: -2, y: 1 }], delay: 0.4, speed: 5 }, jump: { at: 1.2, height: 0.7 } })
    expect(p.sides.A).toMatchObject({ liberoFor: 'mb', liberoRole: 'MB', laeufer: { n: 3, situation: 'aufschlag' } })
    expect(p.sides.B.liberoIdle).toBe('lb')
    expect(p.trajectories.zuspiel!.rising).toBe(true)
    expect(sanitizePlay(JSON.parse(JSON.stringify(p)))).toEqual(p)
  })

  it('Team: Läufer-Aufstellungen nur mit gültigen Schlüsseln und eigenen Spielern', () => {
    const [t] = sanitizeTeams([
      {
        id: 't',
        players: [{ id: 'a', name: 'A', number: 1, positions: ['A'] }],
        rotations: {
          '1-annahme': { pos: { a: { x: -5, y: 1 }, fremd: { x: 0, y: 0 } }, liberoFor: null },
          '7-annahme': { pos: { a: { x: 0, y: 0 } } }
        }
      }
    ])
    expect(t.rotations).toEqual({ '1-annahme': { pos: { a: { x: -5, y: 1 } }, liberoFor: null } })
    expect(sanitizeTeams(JSON.parse(JSON.stringify([t])))[0]).toEqual(t)
  })
})

describe('Einstellungen: Erscheinungsbild', () => {
  it('folgt ohne Angabe dem System (auch bei älteren Einstellungsdateien)', () => {
    expect(sanitizeSettings({}).theme).toBe('system')
    expect(sanitizeSettings({ theme: 'bunt' }).theme).toBe('system')
  })
  it('behält Hell und Dunkel', () => {
    expect(sanitizeSettings({ theme: 'light' }).theme).toBe('light')
    expect(sanitizeSettings({ theme: 'dark' }).theme).toBe('dark')
  })
})
