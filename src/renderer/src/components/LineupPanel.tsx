import { MAX_PLAYERS_PER_SIDE, ROLE_LABELS, type CourtSide, type Role, type Situation } from '@shared/types'
import { jerseyFor } from '@shared/teamColors'
import { addBlocker, allowedRoles, isBackRow, selectableRoles } from '@renderer/core/lineup/lineup'
import { LAEUFER, SITUATIONS, SITUATION_LABELS, currentLaeufer, formationChanged, formationKey } from '@renderer/core/lineup/rotation'
import { useSettings } from '@renderer/store/appSettings'
import { usePlay } from '@renderer/store/playStore'
import { useTeams } from '@renderer/store/teamsStore'
import { rewind } from '@renderer/store/actions'
import { teamStyle } from '@renderer/theme/teamStyle'
import { ConfirmButton } from './ConfirmButton'
import { Icon } from './Icon'
import { QuickTeamList } from './QuickTeam'

/** Positionen im Mini-Feld, wie man sie vom eigenen Feld aus sieht: vorne 4 · 3 · 2, hinten 5 · 6 · 1 */
const GRID = [4, 3, 2, 5, 6, 1] as const

/**
 * Aufstellung: pro Feldseite Team wählen, Rotation (Läufer) einstellen, sehen wer auf welcher Position
 * steht, und Spieler ein- und auswechseln.
 */
export function LineupTab({ onManageTeams }: { onManageTeams: () => void }) {
  return (
    <>
      <SideCard side="A" />
      <SideCard side="B" />
      <button className="plain start" onClick={onManageTeams}>
        <Icon name="people" />
        Teams und Spieler verwalten
      </button>
    </>
  )
}

function SideCard({ side }: { side: CourtSide }) {
  const teams = useTeams((s) => s.teams)
  const { sides, setTeam, togglePlayer, setRole, autoArrange, setLiberoFor } = usePlay()
  const selectedPlayer = usePlay((s) => s.selectedPlayer)
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
    <section className="panel-section side-card team-scope" aria-label={`Seite ${side}`} style={teamStyle(team)}>
      <div className="head">
        <span className="side-badge" style={team ? { background: team.color, color: jerseyFor(team, 'S').text } : undefined} aria-hidden="true">
          {side}
        </span>
        <select className="grow" aria-label={`Team auf Seite ${side}`} value={s.teamId ?? ''} onChange={(e) => setTeam(side, e.target.value || null)}>
          <option value="">Kein Team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name || 'Ohne Namen'}
            </option>
          ))}
        </select>
      </div>

      {!team && <QuickTeamList side={side} />}
      {team && (
        <>
          {/* Wer steht wo: Positionen 1–6, Netz oben */}
          <div className="mini-court" role="group" aria-label="Positionen auf dem Feld">
            <div className="mini-net" aria-hidden="true">
              Netz
            </div>
            {GRID.map((slot) => {
              const c = s.players.find((p) => p.slot === slot)
              const p = c ? team.players.find((pl) => pl.id === c.playerId) : undefined
              const jersey = c ? jerseyFor(team, c.role) : undefined
              const isSel = !!c && selectedPlayer?.side === side && selectedPlayer.playerId === c.playerId
              return (
                <button
                  key={slot}
                  className={`mini-slot ${isSel ? 'selected' : ''} ${c ? '' : 'empty'}`}
                  disabled={!c}
                  title={c && p ? `Position ${slot}: #${p.number} ${p.name} (${ROLE_LABELS[c.role]}) – antippen wählt den Spieler` : `Position ${slot} ist frei`}
                  onClick={() => c && usePlay.getState().selectPlayer(isSel ? null : { side, playerId: c.playerId })}
                >
                  <span className="slot-nr">{slot}</span>
                  {c && p && jersey ? (
                    <>
                      {/* Wie auf dem Feld: Position im Kreis, Rückennummer darunter */}
                      <span className="chip-nr role" style={{ background: jersey.fill, borderColor: jersey.stroke, color: jersey.text }}>
                        {c.role}
                      </span>
                      <span className="slot-role">#{p.number}</span>
                    </>
                  ) : (
                    <span className="secondary">frei</span>
                  )}
                </button>
              )
            })}
          </div>

          <Laeufer side={side} />

          <div className="meta">
            <span className="section-title">
              Kader · {s.players.length}/{MAX_PLAYERS_PER_SIDE} im Feld
            </span>
            <ConfirmButton
              label="Grundaufstellung"
              confirmLabel="Alle neu aufstellen?"
              icon="reset"
              text
              onConfirm={() => {
                rewind()
                autoArrange(side)
              }}
            />
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
                    <span className="chip-nr" style={onCourt ? { background: jersey.fill, borderColor: jersey.stroke, color: jersey.text } : undefined}>
                      {p.number}
                    </span>
                    <span className="name">
                      {p.name || <span className="secondary">Ohne Namen</span>}
                      <span className="pos">
                        {replaced
                          ? 'vom Libero ersetzt'
                          : idle
                            ? 'in dieser Rotation draußen'
                            : onCourt
                              ? `Position ${onCourt.slot ?? '–'}`
                              : `Bank · ${p.positions.join(' · ') || 'ohne Position'}`}
                      </span>
                    </span>
                    <span className={`in-out ${onCourt ? 'in' : ''}`}>{onCourt ? <Icon name="check" size={18} /> : <Icon name="plus" size={18} />}</span>
                  </button>
                  {onCourt && onCourt.role === 'L' && s.liberoFor && backRow.length > 0 && (
                    <select className="role libero-for" title="Libero ersetzt diesen Hinterfeldspieler" aria-label="Libero ersetzt" value={s.liberoFor} onChange={(e) => setLiberoFor(side, e.target.value)}>
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

/**
 * Läufersystem einer Seite: Läufer 1–6 (= Position des Stellers) und Annahme/Aufschlag.
 * Antippen springt zur Aufstellung (Spieler gleiten hin); „Plätze sichern“ merkt sich die aktuellen Plätze
 * für diesen Läufer im Team. Gemerkte Läufer tragen einen Punkt.
 */
function Laeufer({ side }: { side: CourtSide }) {
  const s = usePlay((st) => st.sides[side])
  const { applyLaeufer, saveFormation, resetFormation } = usePlay()
  const team = useTeams((st) => st.teams.find((t) => t.id === s.teamId))
  if (!s.players.some((c) => c.slot)) return null
  const active = s.laeufer
  const situation: Situation = active?.situation ?? 'annahme'
  const now = currentLaeufer(s, team)
  const changed = formationChanged(s, team, side)
  const stored = active ? team?.rotations?.[formationKey(active.n, active.situation)] : undefined
  const go = (n: number, sit: Situation) => {
    // Sprung zu einer Aufstellung: an den Anfang, damit man die Grundstellung sieht
    rewind()
    applyLaeufer(side, n, sit)
  }

  return (
    <div className="laeufer" role="group" aria-label="Läufersystem">
      <div className="row">
        <span className="section-title grow" title="Läufer = Position des Stellers (Läufer 1: Steller auf Position 1)">
          Läufer
        </span>
        <div className="segmented small" role="radiogroup" aria-label="Situation">
          {SITUATIONS.map((sit) => (
            <button key={sit} role="radio" aria-checked={situation === sit && !!active} className={situation === sit && active ? 'selected' : ''} onClick={() => go(active?.n ?? now ?? 1, sit)}>
              {SITUATION_LABELS[sit]}
            </button>
          ))}
        </div>
      </div>
      <div className="segmented small fill nums" role="radiogroup" aria-label="Läufer">
        {LAEUFER.map((n) => {
          const saved = !!team?.rotations?.[formationKey(n, situation)]
          const sel = active ? active.n === n : false
          return (
            <button
              key={n}
              role="radio"
              aria-checked={sel}
              className={`${sel ? 'selected' : ''} ${saved ? 'saved' : ''} ${!active && now === n ? 'current' : ''}`}
              title={`Läufer ${n}: Steller auf Position ${n}${saved ? ' · Plätze gesichert' : ''}`}
              onClick={() => go(n, situation)}
            >
              {n}
            </button>
          )
        })}
      </div>
      {active && (changed || stored) && (
        <div className="row">
          <button
            className={`small grow ${changed ? 'prominent' : ''}`}
            disabled={!changed}
            title={`Aktuelle Plätze als Läufer ${active.n} · ${SITUATION_LABELS[active.situation]} im Team merken`}
            onClick={() => saveFormation(side)}
          >
            <Icon name="save" size={16} />
            {changed ? 'Plätze sichern' : 'Plätze gesichert'}
          </button>
          <button className="small plain" disabled={!stored} title="Gesicherte Plätze dieses Läufers verwerfen (zurück zu den Standardplätzen)" onClick={() => resetFormation(side)}>
            <Icon name="reset" size={16} />
            Standard
          </button>
        </div>
      )}
    </div>
  )
}
