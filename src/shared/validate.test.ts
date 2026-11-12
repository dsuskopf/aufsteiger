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
  })

  it('leere Eingabe', () => {
    expect(sanitizeTeams(undefined)).toEqual([])
    expect(sanitizeTeams([])).toEqual([])
  })
})
