import { create } from 'zustand'
import {
  DEFAULT_DISPLAY,
  type CourtSide,
  type PlayDisplay,
  type PlaySide,
  type Role,
  type Trajectory,
  type TrajectoryType
} from '@shared/types'
import { addToLineup, autoLineup, clampToArea, syncWithTeam } from '@renderer/core/lineup/lineup'
import { clampInput, coupleTrajectories } from '@renderer/core/physics/trajectory'
import { useTeams } from './teamsStore'

interface PlayState {
  sides: Record<CourtSide, PlaySide>
  /** Team wählen: stellt automatisch bis zu 6 Spieler auf. */
  setTeam: (side: CourtSide, teamId: string | null) => void
  /** Grundaufstellung neu setzen */
  autoArrange: (side: CourtSide) => void
  togglePlayer: (side: CourtSide, playerId: string) => void
  setRole: (side: CourtSide, playerId: string, role: Role) => void
  movePlayer: (side: CourtSide, playerId: string, x: number, y: number) => void

  /** Höchstens eine Annahme und ein Zuspiel; das Zuspiel startet am Schlagpunkt der Annahme */
  trajectories: Partial<Record<TrajectoryType, Trajectory>>
  display: PlayDisplay
  selected: TrajectoryType | null
  setTrajectory: (type: TrajectoryType, t: Trajectory) => void
  removeTrajectory: (type: TrajectoryType) => void
  /** Annahme und Zuspiel löschen */
  clearTrajectories: () => void
  select: (type: TrajectoryType | null) => void
  setDisplay: (patch: Partial<PlayDisplay>) => void

  /** Geöffneter, gespeicherter Spielzug (null = neu, noch nicht gespeichert) */
  current: { id: string; code: string; title: string; createdAt: string } | null
  /** Ungespeicherte Änderungen */
  dirty: boolean
}

const emptySide = (): PlaySide => ({ teamId: null, players: [] })
const teamById = (id: string | null) => useTeams.getState().teams.find((t) => t.id === id)

/** Der aktuelle Spielzug: Aufstellung, Flugbahnen und Anzeige-Optionen. */
export const usePlay = create<PlayState>((set) => {
  const mapSide = (side: CourtSide, fn: (s: PlaySide) => PlaySide) =>
    set((st) => ({ sides: { ...st.sides, [side]: fn(st.sides[side]) } }))

  return {
    sides: { A: emptySide(), B: emptySide() },
    trajectories: {},
    display: { ...DEFAULT_DISPLAY },
    selected: null,
    current: null,
    dirty: false,

    setTrajectory: (type, t) =>
      set((st) => ({ trajectories: coupleTrajectories({ ...st.trajectories, [type]: clampInput(t) }) })),
    removeTrajectory: (type) =>
      set((st) => {
        const next = { ...st.trajectories }
        delete next[type]
        return { trajectories: next, selected: st.selected === type ? null : st.selected }
      }),
    clearTrajectories: () => set({ trajectories: {}, selected: null }),
    select: (selected) => set({ selected }),
    setDisplay: (patch) => set((st) => ({ display: { ...st.display, ...patch } })),

    setTeam: (side, teamId) => {
      const team = teamById(teamId)
      mapSide(side, () => ({ teamId: team ? team.id : null, players: team ? autoLineup(team, side) : [] }))
    },
    autoArrange: (side) =>
      mapSide(side, (s) => {
        const team = teamById(s.teamId)
        return team ? { ...s, players: autoLineup(team, side) } : s
      }),
    togglePlayer: (side, playerId) =>
      mapSide(side, (s) => {
        if (s.players.some((c) => c.playerId === playerId))
          return { ...s, players: s.players.filter((c) => c.playerId !== playerId) }
        const player = teamById(s.teamId)?.players.find((p) => p.id === playerId)
        return player ? { ...s, players: addToLineup(s.players, player, side) } : s
      }),
    setRole: (side, playerId, role) =>
      mapSide(side, (s) => ({
        ...s,
        players: s.players.map((c) => (c.playerId === playerId ? { ...c, role } : c))
      })),
    movePlayer: (side, playerId, x, y) =>
      mapSide(side, (s) => ({
        ...s,
        players: s.players.map((c) => (c.playerId === playerId ? { ...c, ...clampToArea(x, y) } : c))
      }))
  }
})

// Jede inhaltliche Änderung markiert den Spielzug als ungespeichert
usePlay.subscribe((s, prev) => {
  if (!s.dirty && (s.sides !== prev.sides || s.trajectories !== prev.trajectories || s.display !== prev.display))
    usePlay.setState({ dirty: true })
})

// Änderungen an den Teams (Spieler gelöscht, Positionen geändert, Team gelöscht) in den Spielzug übernehmen
useTeams.subscribe((state) => {
  const { sides } = usePlay.getState()
  let changed = false
  const next = { ...sides }
  for (const side of ['A', 'B'] as const) {
    const s = sides[side]
    if (s.teamId === null) continue
    const team = state.teams.find((t) => t.id === s.teamId)
    const players = syncWithTeam(s.players, team)
    const teamId = team ? s.teamId : null
    if (players !== s.players || teamId !== s.teamId) {
      next[side] = { teamId, players }
      changed = true
    }
  }
  if (changed) usePlay.setState({ sides: next })
})
