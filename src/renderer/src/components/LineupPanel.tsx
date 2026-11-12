import { MAX_PLAYERS_PER_SIDE, ROLE_LABELS, type CourtSide, type Role } from '@shared/types'
import { jerseyFor } from '@shared/teamColors'
import { addBlocker, allowedRoles, isBackRow, selectableRoles } from '@renderer/core/lineup/lineup'
import { useSettings } from '@renderer/store/appSettings'
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
  const { sides, setTeam, togglePlayer, setRole, autoArrange, setLiberoFor } = usePlay()
  const rules = useSettings((st) => st.settings.lineupRules)
  const s = sides[side]
  const team = teams.find((t) => t.id === s.teamId)
  // Hinterfeldspieler, die der Libero ersetzen kann (inkl. des gerade Ersetzten)
  const backRow = s.players.filter((c) => c.role !== 'L' && isBackRow(c.slot))
  const nameOf = (id: string) => {
    const p = team?.players.find((pl) => pl.id === id)
    return p ? `#${p.number}${p.name ? ' ' + p.name : ''}` : ''
  }

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
              title="Steller 2, MB 3, Außen 4 · Diagonal 5, MB 6, Außen 1 · Libero für den MB hinten"
            >
              <Icon name="formation" />
              Grundaufstellung
            </button>
          </div>
          <div className="lineup" role="list">
            {team.players.map((p) => {
              const onCourt = s.players.find((c) => c.playerId === p.id)
              const replaced = s.liberoFor === p.id
              const idle = s.liberoIdle === p.id
              const role: Role = onCourt?.role ?? (replaced ? s.liberoRole : undefined) ?? p.positions[0] ?? 'A'
              const jersey = jerseyFor(team, role)
              const roles = selectableRoles(p)
              const allowed = onCourt ? allowedRoles(p, s.players, rules) : roles
              const blocked = !onCourt && !replaced ? addBlocker(s, p, rules) : null
              return (
                <div className={`lineup-row ${onCourt ? 'on' : ''} ${replaced ? 'replaced' : ''}`} role="listitem" key={p.id}>
                  <button
                    className="pick"
                    aria-pressed={!!onCourt}
                    disabled={!!blocked}
                    title={onCourt ? 'Vom Feld nehmen' : replaced ? 'Zurück aufs Feld (Libero geht raus)' : blocked ?? 'Aufs Feld nehmen'}
                    onClick={() => togglePlayer(side, p.id)}
                  >
                    <span
                      className="chip-nr"
                      style={onCourt ? { background: jersey.fill, borderColor: jersey.stroke, color: jersey.text } : undefined}
                    >
                      {p.number}
                    </span>
                    <span className="name">{p.name || <span className="secondary">Ohne Namen</span>}</span>
                    {replaced && <span className="pos">ersetzt durch Libero</span>}
                    {idle && <span className="pos">in dieser Rotation draußen</span>}
                    {!onCourt && !replaced && !idle && <span className="pos">{p.positions.join(' · ')}</span>}
                    {onCourt?.slot && (
                      <span className="slot-tag" title={`Position ${onCourt.slot}`}>
                        {onCourt.slot}
                      </span>
                    )}
                    {onCourt && (
                      <span className="check" aria-label="auf dem Feld">
                        <Icon name="check" />
                      </span>
                    )}
                  </button>
                  {onCourt && onCourt.role === 'L' && s.liberoFor && backRow.length > 0 && (
                    <select
                      className="role libero-for"
                      title="Libero ersetzt diesen Hinterfeldspieler"
                      aria-label="Libero ersetzt"
                      value={s.liberoFor}
                      onChange={(e) => setLiberoFor(side, e.target.value)}
                    >
                      <option value={s.liberoFor}>für {nameOf(s.liberoFor)}</option>
                      {backRow.map((c) => (
                        <option key={c.playerId} value={c.playerId}>
                          für {nameOf(c.playerId)} ({c.role})
                        </option>
                      ))}
                    </select>
                  )}
                  {onCourt &&
                    onCourt.role !== 'L' &&
                    (roles.length > 1 ? (
                      <select
                        className="role"
                        title={ROLE_LABELS[onCourt.role]}
                        aria-label={`Rolle von ${p.name || 'Spieler ' + p.number}`}
                        value={onCourt.role}
                        onChange={(e) => setRole(side, p.id, e.target.value as Role)}
                      >
                        {roles.map((r) => (
                          <option key={r} value={r} title={ROLE_LABELS[r]} disabled={!allowed.includes(r) && r !== onCourt.role}>
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
