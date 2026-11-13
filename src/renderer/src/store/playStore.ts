import { create } from 'zustand'
import {
  DEFAULT_DISPLAY,
  type CourtSide,
  type PlayDisplay,
  type PlaySide,
  type Role,
  type Situation,
  type Jump,
  type RunPath,
  type Attack,
  type BallType,
  type Trajectory,
  type TrajectoryType
} from '@shared/types'
import {
  addToLineup,
  allowedRoles,
  autoLineup,
  clampLibero,
  clampToArea,
  removeFromLineup,
  setLiberoFor,
  syncWithTeam
} from '@renderer/core/lineup/lineup'
import { useSettings } from './appSettings'
import { formationKey, formationOf, laeuferLineup } from '@renderer/core/lineup/rotation'
import { tween } from '@renderer/components/tween'
import { clampInput, coupleTrajectories } from '@renderer/core/physics/trajectory'
import { clampAttack } from '@renderer/core/physics/attack'
import { useTeams } from './teamsStore'

interface PlayState {
  sides: Record<CourtSide, PlaySide>
  /** Team wählen: stellt automatisch bis zu 6 Spieler auf. */
  setTeam: (side: CourtSide, teamId: string | null) => void
  /** Grundaufstellung neu setzen */
  autoArrange: (side: CourtSide) => void
  togglePlayer: (side: CourtSide, playerId: string) => void
  setRole: (side: CourtSide, playerId: string, role: Role) => void
  /** Libero für einen anderen Hinterfeldspieler einwechseln */
  setLiberoFor: (side: CourtSide, playerId: string) => void
  /** Läufersystem: zur Aufstellung „Läufer n“ in der Situation springen (Spieler laufen weich hin) */
  applyLaeufer: (side: CourtSide, n: number, situation: Situation) => void
  /** Aktuelle Plätze als Aufstellung des aktiven Läufers im Team speichern */
  saveFormation: (side: CourtSide) => void
  /** Gespeicherte Aufstellung des aktiven Läufers löschen (zurück zu den Standardplätzen) */
  resetFormation: (side: CourtSide) => void
  movePlayer: (side: CourtSide, playerId: string, x: number, y: number) => void

  /** Höchstens eine Annahme und ein Zuspiel; das Zuspiel startet am Schlagpunkt der Annahme */
  trajectories: Partial<Record<TrajectoryType, Trajectory>>
  /** Schlag: startet am Schlagpunkt des Zuspiels */
  schlag: Attack | null
  setSchlag: (a: Attack) => void
  removeSchlag: () => void
  display: PlayDisplay
  selected: BallType | null
  setTrajectory: (type: TrajectoryType, t: Trajectory) => void
  removeTrajectory: (type: TrajectoryType) => void
  /** Annahme und Zuspiel löschen */
  clearTrajectories: () => void
  /** Laufwege und Sprünge aller Spieler löschen (beide Seiten) */
  clearMoves: () => void
  /** Laufweg und Sprung eines Spielers löschen */
  clearPlayerMoves: (side: CourtSide, playerId: string) => void
  select: (type: BallType | null) => void
  /** Gewählter Spieler (Karte mit Laufweg und Sprung); schließt die Flugbahn-Auswahl aus */
  selectedPlayer: { side: CourtSide; playerId: string } | null
  selectPlayer: (p: { side: CourtSide; playerId: string } | null) => void
  setPath: (side: CourtSide, playerId: string, path: RunPath | null) => void
  setJump: (side: CourtSide, playerId: string, jump: Jump | null) => void
  setDisplay: (patch: Partial<PlayDisplay>) => void

  /** Geöffneter, gespeicherter Spielzug (null = neu, noch nicht gespeichert) */
  current: { id: string; code: string; title: string; createdAt: string } | null
  /** Ungespeicherte Änderungen */
  dirty: boolean
}

const emptySide = (): PlaySide => ({ teamId: null, players: [] })

/** Schlag startet am Schlagpunkt des Zuspiels (Lage und Höhe) – gibt dasselbe Objekt zurück, wenn es schon passt */
function coupleSchlag(schlag: Attack | null, zuspiel: Trajectory | undefined): Attack | null {
  if (!schlag || !zuspiel) return schlag
  const s = schlag.start
  if (s.x === zuspiel.end.x && s.y === zuspiel.end.y && s.h === zuspiel.hitH) return schlag
  return { ...schlag, start: { x: zuspiel.end.x, y: zuspiel.end.y, h: zuspiel.hitH } }
}
const teamById = (id: string | null) => useTeams.getState().teams.find((t) => t.id === id)
/** Aufstellungsregeln aktiv? (Einstellungen) */
const rulesOn = () => useSettings.getState().settings.lineupRules

/** Der aktuelle Spielzug: Aufstellung, Flugbahnen und Anzeige-Optionen. */
export const usePlay = create<PlayState>((set, get) => {
  const mapSide = (side: CourtSide, fn: (s: PlaySide) => PlaySide) =>
    set((st) => ({ sides: { ...st.sides, [side]: fn(st.sides[side]) } }))

  /** Weicher Wechsel zu einer neuen Aufstellung: Aufbau sofort, Plätze gleiten (neu Eingewechselte stehen gleich da). */
  const cancelAnim: Partial<Record<CourtSide, () => void>> = {}
  const animateTo = (side: CourtSide, target: PlaySide) => {
    cancelAnim[side]?.()
    const from = new Map(get().sides[side].players.map((c) => [c.playerId, { x: c.x, y: c.y }]))
    const frame = (k: number) =>
      mapSide(side, () => ({
        ...target,
        players: target.players.map((c) => {
          const f = from.get(c.playerId)
          return f ? { ...c, x: f.x + (c.x - f.x) * k, y: f.y + (c.y - f.y) * k } : c
        })
      }))
    frame(0)
    cancelAnim[side] = tween(500, frame, () => {
      mapSide(side, () => target)
      delete cancelAnim[side]
    })
  }

  return {
    sides: { A: emptySide(), B: emptySide() },
    trajectories: {},
    schlag: null,
    display: { ...DEFAULT_DISPLAY },
    selected: null,
    selectedPlayer: null,
    current: null,
    dirty: false,

    setTrajectory: (type, t) =>
      set((st) => {
        const trajectories = coupleTrajectories({ ...st.trajectories, [type]: clampInput(t) })
        return { trajectories, schlag: coupleSchlag(st.schlag, trajectories.zuspiel) }
      }),
    setSchlag: (a) => set((st) => ({ schlag: coupleSchlag(clampAttack(a), st.trajectories.zuspiel) })),
    removeSchlag: () => set((st) => ({ schlag: null, selected: st.selected === 'schlag' ? null : st.selected })),
    removeTrajectory: (type) =>
      set((st) => {
        const next = { ...st.trajectories }
        delete next[type]
        return { trajectories: next, selected: st.selected === type ? null : st.selected }
      }),
    clearTrajectories: () => set({ trajectories: {}, schlag: null, selected: null }),
    clearMoves: () =>
      set((st) => {
        const strip = (s: PlaySide): PlaySide =>
          s.players.some((c) => c.path || c.jump)
            ? {
                ...s,
                players: s.players.map((c) => {
                  if (!c.path && !c.jump) return c
                  const { path: _p, jump: _j, ...rest } = c
                  return rest
                })
              }
            : s
        const A = strip(st.sides.A)
        const B = strip(st.sides.B)
        return A === st.sides.A && B === st.sides.B ? {} : { sides: { A, B } }
      }),
    clearPlayerMoves: (side, playerId) =>
      mapSide(side, (s) => ({
        ...s,
        players: s.players.map((c) => {
          if (c.playerId !== playerId || (!c.path && !c.jump)) return c
          const { path: _p, jump: _j, ...rest } = c
          return rest
        })
      })),
    select: (selected) => set(selected ? { selected, selectedPlayer: null } : { selected }),
    selectPlayer: (selectedPlayer) => set(selectedPlayer ? { selectedPlayer, selected: null } : { selectedPlayer }),
    setPath: (side, playerId, path) =>
      mapSide(side, (s) => ({
        ...s,
        players: s.players.map((c) => {
          if (c.playerId !== playerId) return c
          const next = { ...c }
          if (path) next.path = path
          else delete next.path
          return next
        })
      })),
    setJump: (side, playerId, jump) =>
      mapSide(side, (s) => ({
        ...s,
        players: s.players.map((c) => {
          if (c.playerId !== playerId) return c
          const next = { ...c }
          if (jump) next.jump = jump
          else delete next.jump
          return next
        })
      })),
    setDisplay: (patch) => set((st) => ({ display: { ...st.display, ...patch } })),

    setTeam: (side, teamId) => {
      const team = teamById(teamId)
      mapSide(side, () => (team ? autoLineup(team, side, rulesOn()) : emptySide()))
    },
    autoArrange: (side) =>
      mapSide(side, (s) => {
        const team = teamById(s.teamId)
        return team ? autoLineup(team, side, rulesOn()) : s
      }),
    togglePlayer: (side, playerId) =>
      mapSide(side, (s) => {
        if (s.players.some((c) => c.playerId === playerId)) return removeFromLineup(s, playerId)
        const player = teamById(s.teamId)?.players.find((p) => p.id === playerId)
        return player ? addToLineup(s, player, side, rulesOn()) : s
      }),
    setRole: (side, playerId, role) =>
      mapSide(side, (s) => {
        const player = teamById(s.teamId)?.players.find((p) => p.id === playerId)
        if (rulesOn() && player && !allowedRoles(player, s.players, true).includes(role)) return s
        return { ...s, players: s.players.map((c) => (c.playerId === playerId ? { ...c, role } : c)) }
      }),
    applyLaeufer: (side, n, situation) => {
      const s = get().sides[side]
      const team = teamById(s.teamId)
      if (!team) return
      animateTo(side, laeuferLineup(s, team, side, n, situation))
    },
    saveFormation: (side) => {
      const s = get().sides[side]
      if (!s.teamId || !s.laeufer) return
      useTeams.getState().setFormation(s.teamId, formationKey(s.laeufer.n, s.laeufer.situation), formationOf(s, side))
    },
    resetFormation: (side) => {
      const s = get().sides[side]
      if (!s.teamId || !s.laeufer) return
      useTeams.getState().setFormation(s.teamId, formationKey(s.laeufer.n, s.laeufer.situation), null)
      get().applyLaeufer(side, s.laeufer.n, s.laeufer.situation)
    },
    setLiberoFor: (side, playerId) =>
      mapSide(side, (s) => {
        const team = teamById(s.teamId)
        return team ? setLiberoFor(s, team, playerId, side) : s
      }),
    movePlayer: (side, playerId, x, y) =>
      mapSide(side, (s) => ({
        ...s,
        players: s.players.map((c) => {
          if (c.playerId !== playerId) return c
          // Mit Regeln bleibt der Libero im Hinterfeld
          const p = rulesOn() && c.role === 'L' ? clampLibero(side, x, y) : clampToArea(x, y)
          return { ...c, ...p }
        })
      }))
  }
})

/**
 * Leerer Spielzug: noch nichts geplant (keine Flugbahn). Die Aufstellung allein zählt nicht –
 * dann muss man beim Öffnen eines anderen Spielzugs nicht nachfragen.
 */
export function isPlayEmpty(): boolean {
  const s = usePlay.getState()
  const moves = [...s.sides.A.players, ...s.sides.B.players].some((c) => c.path || c.jump)
  return !s.trajectories.annahme && !s.trajectories.zuspiel && !s.schlag && !moves
}

// Jede inhaltliche Änderung markiert den Spielzug als ungespeichert
usePlay.subscribe((s, prev) => {
  if (!s.dirty && (s.sides !== prev.sides || s.trajectories !== prev.trajectories || s.schlag !== prev.schlag || s.display !== prev.display))
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
    const synced = syncWithTeam(s, team)
    if (synced !== s) {
      next[side] = synced
      changed = true
    }
  }
  if (changed) usePlay.setState({ sides: next })
})
