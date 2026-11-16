import { create } from 'zustand'
import { PLAYER_HEIGHT, type Formation, type Player, type Role, type Team } from '@shared/types'
import { clampHeight, clampNumber } from '@shared/validate'
import {
  COLOR_PAIRS,
  DEFAULT_LIBERO_COLOR,
  nextTeamColor,
  pairedLibero
} from '@shared/teamColors'
import type { Body, Look, TeamGender } from '@shared/looks'

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
  /** Männer, Frauen oder gemischt (bestimmt die 3D-Figuren) */
  setTeamGender: (teamId: string, gender: TeamGender) => void
  /** Aussehen eines Spielers (null = wieder zufällig) */
  setPlayerLook: (teamId: string, playerId: string, look: Look | null) => void
  deleteTeam: (teamId: string) => void
  /** Team aus einem gespeicherten Spielzug wiederherstellen, falls es nicht mehr existiert */
  restoreTeam: (team: Team) => void
  addPlayer: (teamId: string) => string
  updatePlayer: (teamId: string, playerId: string, patch: Partial<Omit<Player, 'id'>>) => void
  togglePosition: (teamId: string, playerId: string, role: Role) => void
  deletePlayer: (teamId: string, playerId: string) => void
  /** Läufer-Aufstellung speichern (null = löschen, zurück zum Standard) */
  setFormation: (teamId: string, key: string, formation: Formation | null) => void
}

const newId = () => crypto.randomUUID()

/**
 * Beispielteams für den ersten Start: je zwei Herren-, Mixed- und Damenteams, jedes in einer eigenen Farbe.
 * Das erste steht gleich auf dem Feld, das zweite (gleiche Klasse) ist der Gegner für den Ein-Tipp-Knopf.
 * Mixed: Auf dem Feld stehen immer 3 Männer und 3 Frauen – der Libero ersetzt einen Mittelblocker und ist
 * darum ein Mann. (Keine Regel in der App, nur so angelegt.)
 */
function exampleTeams(): Team[] {
  const p = (name: string, number: number, height: number, positions: Role[], body?: Body): Player => ({
    id: newId(),
    name,
    number,
    positions,
    height,
    ...(body ? { look: { body } } : {})
  })
  const team = (name: string, pair: number, gender: TeamGender, players: Player[]): Team => ({
    id: newId(),
    name,
    color: COLOR_PAIRS[pair].jersey,
    liberoColor: COLOR_PAIRS[pair].libero,
    gender,
    players
  })
  return [
    team('Herren 1', 0, 'm', [
      p('Steller', 7, 1.88, ['S']),
      p('Außen 1', 4, 1.94, ['A']),
      p('Außen 2', 12, 1.92, ['A']),
      p('Mitte 1', 9, 2.02, ['MB']),
      p('Mitte 2', 15, 2.0, ['MB']),
      p('Diagonal', 10, 1.98, ['D', 'A']),
      p('Libero', 1, 1.8, ['L'])
    ]),
    team('Herren 2', 6, 'm', [
      p('Steller', 2, 1.86, ['S']),
      p('Außen 1', 11, 1.93, ['A']),
      p('Außen 2', 5, 1.9, ['A']),
      p('Mitte 1', 13, 2.04, ['MB']),
      p('Mitte 2', 8, 1.99, ['MB']),
      p('Diagonal', 17, 1.97, ['D', 'A']),
      p('Libero', 3, 1.78, ['L'])
    ]),
    // Mixed 1: Mittelblocker und ein Außen männlich – Zuspielerin, Diagonal und der zweite Außen weiblich
    team('Mixed 1', 2, 'mixed', [
      p('Zuspielerin', 6, 1.72, ['S'], 'f'),
      p('Außen 1', 9, 1.9, ['A'], 'm'),
      p('Außen 2', 14, 1.78, ['A'], 'f'),
      p('Mitte 1', 12, 1.98, ['MB'], 'm'),
      p('Mitte 2', 16, 1.96, ['MB'], 'm'),
      p('Diagonal', 4, 1.8, ['D', 'A'], 'f'),
      p('Libero', 1, 1.8, ['L'], 'm')
    ]),
    // Mixed 2: Mittelblocker und Diagonal männlich – Zuspielerin und beide Außen weiblich
    team('Mixed 2', 4, 'mixed', [
      p('Zuspielerin', 3, 1.74, ['S'], 'f'),
      p('Außen 1', 7, 1.79, ['A'], 'f'),
      p('Außen 2', 10, 1.77, ['A'], 'f'),
      p('Mitte 1', 11, 1.97, ['MB'], 'm'),
      p('Mitte 2', 15, 1.95, ['MB'], 'm'),
      p('Diagonal', 8, 1.93, ['D', 'A'], 'm'),
      p('Libero', 2, 1.79, ['L'], 'm')
    ]),
    team('Damen 1', 1, 'f', [
      p('Zuspielerin', 3, 1.76, ['S']),
      p('Außen 1', 8, 1.82, ['A']),
      p('Außen 2', 5, 1.8, ['A']),
      p('Mitte 1', 11, 1.88, ['MB']),
      p('Mitte 2', 14, 1.86, ['MB']),
      p('Diagonal', 2, 1.84, ['D', 'A']),
      p('Libera', 6, 1.68, ['L'])
    ]),
    team('Damen 2', 5, 'f', [
      p('Zuspielerin', 9, 1.74, ['S']),
      p('Außen 1', 4, 1.83, ['A']),
      p('Außen 2', 13, 1.79, ['A']),
      p('Mitte 1', 7, 1.9, ['MB']),
      p('Mitte 2', 12, 1.87, ['MB']),
      p('Diagonal', 10, 1.85, ['D', 'A']),
      p('Libera', 1, 1.66, ['L'])
    ])
  ]
}

/** Gelöschten Spieler aus allen gespeicherten Läufer-Aufstellungen entfernen */
function withoutPlayer(rotations: Team['rotations'], playerId: string): Pick<Team, 'rotations'> {
  if (!rotations) return {}
  const out: Record<string, Formation> = {}
  for (const [key, f] of Object.entries(rotations)) {
    const pos = { ...f.pos }
    delete pos[playerId]
    out[key] = { ...f, pos, ...(f.liberoFor === playerId ? { liberoFor: undefined } : {}) }
    if (out[key].liberoFor === undefined) delete out[key].liberoFor
  }
  return { rotations: out }
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
      // Lässt sich die Datei nicht lesen, startet die App ohne Teams, statt beim Laden hängen zu bleiben
      let file: Awaited<ReturnType<typeof window.api.teams.load>>
      try {
        file = await window.api.teams.load()
      } catch (e) {
        set({ teams: [], loaded: true, saveError: String(e) })
        return
      }
      if (file === null) {
        // Erster Start: Beispielteams anlegen, damit man sofort loslegen kann
        set({ teams: exampleTeams(), loaded: true })
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
    setTeamGender: (teamId, gender) => mapTeam(teamId, (t) => ({ ...t, gender })),
    setPlayerLook: (teamId, playerId, look) =>
      mapPlayer(teamId, playerId, (p) => {
        const next = { ...p }
        if (look && Object.keys(look).length) next.look = look
        else delete next.look
        return next
      }),
    deleteTeam: (teamId) => mutate((teams) => teams.filter((t) => t.id !== teamId)),
    restoreTeam: (team) => {
      if (get().teams.some((t) => t.id === team.id)) return
      mutate((teams) => [...teams, team])
    },

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
      mapTeam(teamId, (t) => ({ ...t, players: t.players.filter((p) => p.id !== playerId), ...withoutPlayer(t.rotations, playerId) })),
    setFormation: (teamId, key, formation) =>
      mapTeam(teamId, (t) => {
        const rotations = { ...(t.rotations ?? {}) }
        if (formation) rotations[key] = formation
        else delete rotations[key]
        const next: Team = { ...t, rotations }
        if (Object.keys(rotations).length === 0) delete next.rotations
        return next
      })
  }
})

// Beim Schließen des Fensters nichts verlieren: synchron speichern (asynchron würde das Beenden es abschneiden)
window.addEventListener('beforeunload', () => {
  if (!savePending) return
  clearTimeout(saveTimer)
  savePending = false
  window.api.flushSync('teams', useTeams.getState().teams)
})
