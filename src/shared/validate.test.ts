import { describe, expect, it } from 'vitest'
import { sanitizeTeams } from './validate'

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
    expect(teams[0].players).toEqual([{ id: 'p', name: 'X', number: 99, positions: ['S', 'L'] }])
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

  it('leere Eingabe', () => {
    expect(sanitizeTeams(undefined)).toEqual([])
    expect(sanitizeTeams([])).toEqual([])
  })
})
