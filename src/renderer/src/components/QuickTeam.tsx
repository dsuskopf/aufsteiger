import type { CourtSide } from '@shared/types'
import { jerseyFor } from '@shared/teamColors'
import { usePlay } from '@renderer/store/playStore'
import { useTeams } from '@renderer/store/teamsStore'
import { Icon } from './Icon'

/** Teams, die man auf eine leere Feldseite stellen kann (nicht schon auf der anderen Seite) */
function useFreeTeams(side: CourtSide) {
  const sides = usePlay((s) => s.sides)
  const teams = useTeams((s) => s.teams)
  const other = sides[side === 'A' ? 'B' : 'A'].teamId
  return sides[side].teamId ? [] : teams.filter((t) => t.id !== other)
}

/**
 * Schwebender Knopf über dem Feld, solange eine Seite leer ist: das nächste Team mit einem Tipp aufs Feld.
 * Mehrere Teams zur Auswahl stehen in der Aufstellung.
 */
export function QuickTeamChip() {
  const freeB = useFreeTeams('B')
  const freeA = useFreeTeams('A')
  const side: CourtSide | null = freeB.length ? 'B' : freeA.length ? 'A' : null
  if (!side) return null
  const team = (side === 'B' ? freeB : freeA)[0]
  return (
    <button
      className="quick-team"
      title={`${team.name || 'Team'} auf Seite ${side} stellen – andere Teams in der Aufstellung`}
      onClick={() => usePlay.getState().setTeam(side, team.id)}
    >
      <span className="chip-dot" style={{ background: team.color, borderColor: jerseyFor(team, 'S').stroke }} />
      <Icon name="plus" size={16} />
      {team.name || 'Team'} auf Seite {side}
    </button>
  )
}

/** In der Aufstellung bei leerer Seite: alle freien Teams als Knöpfe */
export function QuickTeamList({ side }: { side: CourtSide }) {
  const free = useFreeTeams(side)
  if (free.length === 0) return null
  return (
    <div className="chips" role="group" aria-label={`Team auf Seite ${side} stellen`}>
      {free.map((t) => (
        <button key={t.id} className="chip" onClick={() => usePlay.getState().setTeam(side, t.id)}>
          <span className="chip-dot" style={{ background: t.color, borderColor: jerseyFor(t, 'S').stroke }} />
          {t.name || 'Ohne Namen'}
        </button>
      ))}
    </div>
  )
}
