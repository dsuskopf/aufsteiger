import { create } from 'zustand'
import { PLAYER_HEIGHT, type Player, type Role, type Team } from '@shared/types'
import { clampHeight, clampNumber } from '@shared/validate'
import {
  DEFAULT_LIBERO_COLOR,
  DEFAULT_TEAM_COLOR,
  nextTeamColor,
  pairedLibero
} from '@shared/teamColors'

interface TeamsState {
  teams: Team[]
  loaded: boolean
  saveError: string | null
  load: () => Promise<void>
  /** Ausstehende Speicherung sofort ausführen (z. B. beim Schließen) */
  flush: () => void
  /** Legt ein Team mit einem ersten, leeren Spieler an (sofort ausfüllbar). */
  addTeam: (name?: string) => { teamId: string; playerId: string }
  renameTeam: (teamId: string, name: string) => void
  setTeamColor: (teamId: string, color: string) => void
  setLiberoColor: (teamId: string, color: string) => void
  deleteTeam: (teamId: string) => void
  addPlayer: (teamId: string) => string
  updatePlayer: (teamId: string, playerId: string, patch: Partial<Omit<Player, 'id'>>) => void
  togglePosition: (teamId: string, playerId: string, role: Role) => void
  deletePlayer: (teamId: string, playerId: string) => void
}

const newId = () => crypto.randomUUID()

function exampleTeam(): Team {
  const p = (name: string, number: number, ...positions: Role[]): Player => ({
    id: newId(),
    name,
    number,
    positions,
    height: PLAYER_HEIGHT.default
  })
  return {
    id: newId(),
    name: 'Beispielteam',
    color: DEFAULT_TEAM_COLOR,
    liberoColor: DEFAULT_LIBERO_COLOR,
    players: [
      p('Steller', 7, 'S'),
      p('Außen 1', 4, 'A'),
      p('Außen 2', 12, 'A'),
      p('Mitte 1', 9, 'MB'),
      p('Mitte 2', 15, 'MB'),
      p('Diagonal', 10, 'D', 'A'),
      p('Libero', 1, 'L')
    ]
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
let savePending = false

/** Teams werden nach jeder Änderung kurz verzögert in teams.json gespeichert. */
export const useTeams = create<TeamsState>((set, get) => {
  const saveNow = () => {
    clearTimeout(saveTimer)
    savePending = false
    window.api.teams
      .save(get().teams)
      .then(() => set({ saveError: null }))
      .catch((e: unknown) => set({ saveError: String(e) }))
  }
  const persist = () => {
    clearTimeout(saveTimer)
    savePending = true
    saveTimer = setTimeout(saveNow, 300)
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

    flush: () => {
      if (savePending) saveNow()
    },

    addTeam: (name) => {
      const teamId = newId()
      const playerId = newId()
      mutate((teams) => {
        const color = nextTeamColor(teams.map((t) => t.color))
        return [
        ...teams,
        {
          id: teamId,
          name: name ?? `Team ${teams.length + 1}`,
          color,
          liberoColor: pairedLibero(color) ?? DEFAULT_LIBERO_COLOR,
          players: [{ id: playerId, name: '', number: 1, positions: [], height: PLAYER_HEIGHT.default }]
        }
        ]
      })
      return { teamId, playerId }
    },
    renameTeam: (teamId, name) => mapTeam(teamId, (t) => ({ ...t, name })),
    // Libero-Farbe bleibt beim Trikotwechsel unverändert (nur neue Teams starten mit dem passenden Paar)
    setTeamColor: (teamId, color) => mapTeam(teamId, (t) => ({ ...t, color })),
    setLiberoColor: (teamId, liberoColor) => mapTeam(teamId, (t) => ({ ...t, liberoColor })),
    deleteTeam: (teamId) => mutate((teams) => teams.filter((t) => t.id !== teamId)),

    addPlayer: (teamId) => {
      const id = newId()
      mapTeam(teamId, (t) => {
        const used = new Set(t.players.map((p) => p.number))
        let number = 1
        while (used.has(number) && number < 99) number++
        return { ...t, players: [...t.players, { id, name: '', number, positions: [], height: PLAYER_HEIGHT.default }] }
      })
      return id
    },
    updatePlayer: (teamId, playerId, patch) =>
      mapPlayer(teamId, playerId, (p) => ({
        ...p,
        ...patch,
        ...(patch.number !== undefined ? { number: clampNumber(patch.number) } : {}),
        ...(patch.height !== undefined ? { height: clampHeight(patch.height) } : {})
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

// Beim Schließen des Fensters nichts verlieren
window.addEventListener('beforeunload', () => useTeams.getState().flush())
