import { useMemo } from 'react'
import { TRAJECTORY_TYPES, type CourtSide, type PlayDisplay, type Role, type Trajectory, type TrajectoryType } from '@shared/types'
import { solveTrajectory, type SolvedTrajectory } from '@renderer/core/physics/trajectory'
import { jerseyFor, type JerseyStyle } from '@shared/teamColors'
import { usePlay } from './playStore'
import { useTeams } from './teamsStore'

/** Alles, was eine Ansicht zum Zeichnen eines Spielers braucht. */
export interface CourtPlayerView {
  key: string
  side: CourtSide
  playerId: string
  role: Role
  number: number
  name: string
  x: number
  y: number
  /** Trikot: Libero automatisch in der Libero-Farbe, sonst Teamfarbe */
  jersey: JerseyStyle
  /** Körpergröße in Metern (inkl. Kopf) */
  height: number
}

/** Spieler beider Seiten mit Nummer und Name aus dem Team. */
export function useCourtPlayers(): CourtPlayerView[] {
  const sides = usePlay((s) => s.sides)
  const teams = useTeams((s) => s.teams)
  return useMemo(() => {
    const out: CourtPlayerView[] = []
    for (const side of ['A', 'B'] as const) {
      const team = teams.find((t) => t.id === sides[side].teamId)
      if (!team) continue
      for (const c of sides[side].players) {
        const p = team.players.find((pl) => pl.id === c.playerId)
        if (!p) continue
        out.push({
          key: `${side}:${p.id}`,
          side,
          playerId: p.id,
          role: c.role,
          number: p.number,
          name: p.name,
          x: c.x,
          y: c.y,
          jersey: jerseyFor(team, c.role),
          height: p.height
        })
      }
    }
    return out
  }, [sides, teams])
}

/** Eine sichtbare, gelöste Flugbahn */
export interface TrajectoryView {
  type: TrajectoryType
  input: Trajectory
  sol: SolvedTrajectory
  /** Zuspiel hängt an der Annahme (Start nicht separat verschiebbar) */
  coupled: boolean
}

export function visibleTrajectories(
  trajectories: Partial<Record<TrajectoryType, Trajectory>>,
  display: PlayDisplay
): TrajectoryView[] {
  const out: TrajectoryView[] = []
  for (const type of TRAJECTORY_TYPES) {
    const input = trajectories[type]
    if (!input) continue
    if (type === 'annahme' ? !display.showAnnahme : !display.showZuspiel) continue
    out.push({ type, input, sol: solveTrajectory(input), coupled: type === 'zuspiel' && !!trajectories.annahme })
  }
  return out
}

/** Sichtbare Flugbahnen (nach Anzeige-Optionen), gelöst */
export function useVisibleTrajectories(): TrajectoryView[] {
  const trajectories = usePlay((s) => s.trajectories)
  const display = usePlay((s) => s.display)
  return useMemo(() => visibleTrajectories(trajectories, display), [trajectories, display])
}
