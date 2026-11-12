import { MAX_PLAYERS_PER_SIDE, ROLE_LABELS, type CourtSide } from '@shared/types'
import { selectableRoles } from '@renderer/core/lineup/lineup'
import { usePlay } from '@renderer/store/playStore'
import { useTeams } from '@renderer/store/teamsStore'
import { TEAM_COLORS } from '@renderer/theme/colors'

/** Seitenleiste: pro Feldseite Team wählen, Spieler (max. 6) aufs Feld nehmen und Rolle festlegen. */
export function LineupPanel({ onClose, onManageTeams }: { onClose: () => void; onManageTeams: () => void }) {
  return (
    <aside className="drawer" aria-label="Aufstellung">
      <header className="modal-head">
        <h2>Aufstellung</h2>
        <button onClick={onClose} aria-label="Aufstellung schließen">
          ✕
        </button>
      </header>
      <div className="drawer-body">
        <SideSection side="A" />
        <SideSection side="B" />
        <button className="add" onClick={onManageTeams}>
          Teams verwalten …
        </button>
      </div>
    </aside>
  )
}

function SideSection({ side }: { side: CourtSide }) {
  const teams = useTeams((s) => s.teams)
  const { sides, setTeam, togglePlayer, setRole, autoArrange } = usePlay()
  const s = sides[side]
  const team = teams.find((t) => t.id === s.teamId)
  const full = s.players.length >= MAX_PLAYERS_PER_SIDE

  return (
    <section className="side-section">
      <div className="row">
        <span className="side-badge" style={{ background: TEAM_COLORS[side].fill, borderColor: TEAM_COLORS[side].stroke }}>
          {side}
        </span>
        <select
          className="grow"
          aria-label={`Team Seite ${side}`}
          value={s.teamId ?? ''}
          onChange={(e) => setTeam(side, e.target.value || null)}
        >
          <option value="">— kein Team —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name || 'Ohne Namen'}
            </option>
          ))}
        </select>
      </div>

      {team && (
        <>
          <div className="row dim small">
            <span className="grow">
              Auf dem Feld: {s.players.length} / {MAX_PLAYERS_PER_SIDE}
            </span>
            <button onClick={() => autoArrange(side)} title="Spieler auf die Grundpositionen (Rotation 1) setzen">
              Grundaufstellung
            </button>
          </div>
          <ul className="lineup-list">
            {team.players.map((p) => {
              const onCourt = s.players.find((c) => c.playerId === p.id)
              const roles = selectableRoles(p)
              return (
                <li key={p.id} className={onCourt ? 'on' : ''}>
                  <button
                    className={`toggle ${onCourt ? 'active' : ''}`}
                    disabled={!onCourt && full}
                    aria-pressed={!!onCourt}
                    title={onCourt ? 'Vom Feld nehmen' : full ? 'Schon 6 Spieler auf dem Feld' : 'Aufs Feld nehmen'}
                    onClick={() => togglePlayer(side, p.id)}
                  >
                    {p.number}
                  </button>
                  <span className="grow name">{p.name || <span className="dim">Ohne Namen</span>}</span>
                  {onCourt ? (
                    roles.length > 1 ? (
                      <select
                        className="role-select"
                        title={ROLE_LABELS[onCourt.role]}
                        aria-label={`Rolle von ${p.name}`}
                        value={onCourt.role}
                        onChange={(e) => setRole(side, p.id, e.target.value as typeof onCourt.role)}
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
                    )
                  ) : (
                    <span className="dim small">{p.positions.join(' · ')}</span>
                  )}
                </li>
              )
            })}
            {team.players.length === 0 && <li className="dim">Dieses Team hat noch keine Spieler.</li>}
          </ul>
        </>
      )}
    </section>
  )
}
