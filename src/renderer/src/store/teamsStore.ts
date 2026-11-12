import { create } from 'zustand'
import type { Player, Role, Team } from '@shared/types'
import { clampNumber } from '@shared/validate'

interface TeamsState {
  teams: Team[]
  loaded: boolean
  saveError: string | null
  load: () => Promise<void>
  addTeam: (name?: string) => string
  renameTeam: (teamId: string, name: string) => void
  deleteTeam: (teamId: string) => void
  addPlayer: (teamId: string) => string
  updatePlayer: (teamId: string, playerId: string, patch: Partial<Omit<Player, 'id'>>) => void
  togglePosition: (teamId: string, playerId: string, role: Role) => void
  deletePlayer: (teamId: string, playerId: string) => void
}

const newId = () => crypto.randomUUID()

function exampleTeam(): Team {
  const p = (name: string, number: number, ...positions: Role[]): Player => ({ id: newId(), name, number, positions })
  return {
    id: newId(),
    name: 'Beispielteam',
    players: [
      p('Steller', 7, 'S'),
      p('Außen 1', 4, 'AA'),
      p('Außen 2', 12, 'AA'),
      p('Mitte 1', 9, 'MB'),
      p('Mitte 2', 15, 'MB'),
      p('Diagonal', 10, 'DA', 'AA'),
      p('Libero', 1, 'L')
    ]
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

/** Teams werden nach jeder Änderung kurz verzögert in teams.json gespeichert. */
export const useTeams = create<TeamsState>((set, get) => {
  const persist = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      window.api.teams
        .save(get().teams)
        .then(() => set({ saveError: null }))
        .catch((e: unknown) => set({ saveError: String(e) }))
    }, 300)
  }
  const mutate = (fn: (teams: Team[]) => Team[]) => {
    set({ teams: fn(get().teams) })
    persist()
  }
  const mapTeam = (teamId: string, fn: (t: Team) => Team) =>
    mutate((teams) => teams.map((t) => (t.id === teamId ? fn(t) : t)))
  const mapPlayer = (teamId: string, playerId: string, fn: (p: Player) => Player) =>
    mapTeam(teamId, (t) => ({ ...t, players: t.players.map((p) => (p.id === playerId ? fn(p) : p)) }))

  return {
    teams: [],
    loaded: false,
    saveError: null,

    load: async () => {
      const file = await window.api.teams.load()
      if (file === null) {
        // Erster Start: Beispielteam anlegen, damit man sofort loslegen kann
        set({ teams: [exampleTeam()], loaded: true })
        persist()
      } else {
        set({ teams: file.teams, loaded: true })
      }
    },

    addTeam: (name) => {
      const id = newId()
      mutate((teams) => [...teams, { id, name: name ?? `Team ${teams.length + 1}`, players: [] }])
      return id
    },
    renameTeam: (teamId, name) => mapTeam(teamId, (t) => ({ ...t, name })),
    deleteTeam: (teamId) => mutate((teams) => teams.filter((t) => t.id !== teamId)),

    addPlayer: (teamId) => {
      const id = newId()
      mapTeam(teamId, (t) => {
        const used = new Set(t.players.map((p) => p.number))
        let number = 1
        while (used.has(number) && number < 99) number++
        return { ...t, players: [...t.players, { id, name: '', number, positions: [] }] }
      })
      return id
    },
    updatePlayer: (teamId, playerId, patch) =>
      mapPlayer(teamId, playerId, (p) => ({
        ...p,
        ...patch,
        ...(patch.number !== undefined ? { number: clampNumber(patch.number) } : {})
      })),
    togglePosition: (teamId, playerId, role) =>
      mapPlayer(teamId, playerId, (p) => ({
        ...p,
        positions: p.positions.includes(role) ? p.positions.filter((r) => r !== role) : [...p.positions, role]
      })),
    deletePlayer: (teamId, playerId) =>
      mapTeam(teamId, (t) => ({ ...t, players: t.players.filter((p) => p.id !== playerId) }))
  }
})
