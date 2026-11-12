import { MAX_PLAYERS_PER_SIDE, ROLE_LABELS, type CourtSide, type Role } from '@shared/types'
import { jerseyFor } from '@shared/teamColors'
import { selectableRoles } from '@renderer/core/lineup/lineup'
import { usePlay } from '@renderer/store/playStore'
import { useTeams } from '@renderer/store/teamsStore'
import { teamStyle } from '@renderer/theme/teamStyle'
import { Icon } from './Icon'

/** Inspector rechts: pro Feldseite Team wählen, Spieler (max. 6) aufs Feld nehmen und Rolle festlegen. */
export function LineupPanel({ onClose, onManageTeams }: { onClose: () => void; onManageTeams: () => void }) {
  return (
    <aside className="inspector" aria-labelledby="lineup-title">
      <header className="inspector-head">
        <h2 id="lineup-title">Aufstellung</h2>
        <button className="plain" onClick={onManageTeams}>
          <Icon name="people" />
          Teams
        </button>
        <button className="icon-only plain" aria-label="Aufstellung schließen" title="Schließen" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <div className="inspector-body">
        <SideCard side="A" />
        <SideCard side="B" />
      </div>
    </aside>
  )
}

function SideCard({ side }: { side: CourtSide }) {
  const teams = useTeams((s) => s.teams)
  const { sides, setTeam, togglePlayer, setRole, autoArrange } = usePlay()
  const s = sides[side]
  const team = teams.find((t) => t.id === s.teamId)
  const full = s.players.length >= MAX_PLAYERS_PER_SIDE

  return (
    <section className="side-card team-scope" aria-label={`Seite ${side}`} style={teamStyle(team)}>
      <div className="head">
        <span
          className="side-badge"
          style={team ? { background: team.color, color: jerseyFor(team, 'S').text } : undefined}
          aria-hidden="true"
        >
          {side}
        </span>
        <select
          className="grow"
          aria-label={`Team auf Seite ${side}`}
          value={s.teamId ?? ''}
          onChange={(e) => setTeam(side, e.target.value || null)}
        >
          <option value="">Kein Team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name || 'Ohne Namen'}
            </option>
          ))}
        </select>
      </div>

      {team && (
        <>
          <div className="meta">
            <span className="caption">
              {s.players.length} von {MAX_PLAYERS_PER_SIDE} auf dem Feld
            </span>
            <button
              className="plain"
              onClick={() => autoArrange(side)}
              title="Spieler auf die Grundpositionen (Rotation 1) setzen"
            >
              <Icon name="formation" />
              Grundaufstellung
            </button>
          </div>
          <div className="lineup" role="list">
            {team.players.map((p) => {
              const onCourt = s.players.find((c) => c.playerId === p.id)
              const role: Role = onCourt?.role ?? p.positions[0] ?? 'A'
              const jersey = jerseyFor(team, role)
              const roles = selectableRoles(p)
              return (
                <div className={`lineup-row ${onCourt ? 'on' : ''}`} role="listitem" key={p.id}>
                  <button
                    className="pick"
                    aria-pressed={!!onCourt}
                    disabled={!onCourt && full}
                    title={onCourt ? 'Vom Feld nehmen' : full ? 'Schon 6 Spieler auf dem Feld' : 'Aufs Feld nehmen'}
                    onClick={() => togglePlayer(side, p.id)}
                  >
                    <span
                      className="chip-nr"
                      style={onCourt ? { background: jersey.fill, borderColor: jersey.stroke, color: jersey.text } : undefined}
                    >
                      {p.number}
                    </span>
                    <span className="name">{p.name || <span className="secondary">Ohne Namen</span>}</span>
                    {!onCourt && <span className="pos">{p.positions.join(' · ')}</span>}
                    {onCourt && (
                      <span className="check" aria-label="auf dem Feld">
                        <Icon name="check" />
                      </span>
                    )}
                  </button>
                  {onCourt &&
                    (roles.length > 1 ? (
                      <select
                        className="role"
                        title={ROLE_LABELS[onCourt.role]}
                        aria-label={`Rolle von ${p.name || 'Spieler ' + p.number}`}
                        value={onCourt.role}
                        onChange={(e) => setRole(side, p.id, e.target.value as Role)}
                      >
                        {roles.map((r) => (
                          <option key={r} value={r} title={ROLE_LABELS[r]}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="role-tag" title={ROLE_LABELS[onCourt.role]}>
                        {onCourt.role}
                      </span>
                    ))}
                </div>
              )
            })}
            {team.players.length === 0 && <p className="empty">Dieses Team hat noch keine Spieler.</p>}
          </div>
        </>
      )}
    </section>
  )
}
