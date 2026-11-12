import { useMemo } from 'react'
import type { CourtSide, Role } from '@shared/types'
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
        out.push({ key: `${side}:${p.id}`, side, playerId: p.id, role: c.role, number: p.number, name: p.name, x: c.x, y: c.y })
      }
    }
    return out
  }, [sides, teams])
}
