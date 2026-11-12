import { useEffect, useState } from 'react'
import { ROLES, ROLE_LABELS, type Player } from '@shared/types'
import { useTeams } from '@renderer/store/teamsStore'
import { ConfirmButton } from './ConfirmButton'

/**
 * Teamverwaltung: beliebig viele Teams, je Spieler Name, Rückennummer und eine oder mehrere Positionen.
 * Änderungen werden sofort (verzögert) gespeichert.
 */
export function TeamManager({ onClose }: { onClose: () => void }) {
  const { teams, addTeam, renameTeam, deleteTeam, addPlayer, saveError } = useTeams()
  const [selectedId, setSelectedId] = useState<string | null>(teams[0]?.id ?? null)
  const team = teams.find((t) => t.id === selectedId) ?? teams[0]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal team-manager" role="dialog" aria-label="Teams verwalten">
        <header className="modal-head">
          <h2>Teams</h2>
          {saveError && <span className="error">Speichern fehlgeschlagen</span>}
          <button onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </header>

        <div className="team-manager-body">
          <aside className="team-list">
            {teams.map((t) => (
              <button
                key={t.id}
                className={t.id === team?.id ? 'active' : ''}
                onClick={() => setSelectedId(t.id)}
              >
                <span className="team-name">{t.name || 'Ohne Namen'}</span>
                <span className="dim">{t.players.length}</span>
              </button>
            ))}
            <button className="add" onClick={() => setSelectedId(addTeam())}>
              + Neues Team
            </button>
          </aside>

          <section className="team-edit">
            {!team ? (
              <p className="dim">Noch kein Team. Lege links ein neues an.</p>
            ) : (
              <>
                <div className="row">
                  <input
                    className="text grow"
                    aria-label="Teamname"
                    value={team.name}
                    placeholder="Teamname"
                    onChange={(e) => renameTeam(team.id, e.target.value)}
                  />
                  <ConfirmButton
                    label="Team löschen"
                    confirmLabel="Wirklich löschen?"
                    onConfirm={() => {
                      deleteTeam(team.id)
                      setSelectedId(null)
                    }}
                  />
                </div>

                <div className="player-table">
                  <div className="player-row head">
                    <span>Nr.</span>
                    <span>Name</span>
                    <span>Positionen</span>
                    <span />
                  </div>
                  {team.players.map((p) => (
                    <PlayerRow key={p.id} teamId={team.id} player={p} />
                  ))}
                </div>
                <button className="add" onClick={() => addPlayer(team.id)}>
                  + Spieler hinzufügen
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function PlayerRow({ teamId, player }: { teamId: string; player: Player }) {
  const { updatePlayer, togglePosition, deletePlayer } = useTeams()
  return (
    <div className="player-row">
      <NumberInput value={player.number} onCommit={(n) => updatePlayer(teamId, player.id, { number: n })} />
      <input
        className="text"
        aria-label="Name"
        value={player.name}
        placeholder="Name"
        onChange={(e) => updatePlayer(teamId, player.id, { name: e.target.value })}
      />
      <div className="chips" role="group" aria-label="Positionen">
        {ROLES.map((r) => (
          <button
            key={r}
            className={`chip ${player.positions.includes(r) ? 'active' : ''}`}
            title={ROLE_LABELS[r]}
            aria-pressed={player.positions.includes(r)}
            onClick={() => togglePosition(teamId, player.id, r)}
          >
            {r}
          </button>
        ))}
      </div>
      <ConfirmButton label="✕" confirmLabel="Löschen?" title="Spieler löschen" onConfirm={() => deletePlayer(teamId, player.id)} />
    </div>
  )
}

/** Rückennummer: Entwurf lokal, übernommen bei Enter oder Verlassen. */
function NumberInput({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const n = Number(draft.trim())
    if (draft.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 99) onCommit(n)
    else setDraft(String(value))
  }
  return (
    <input
      className="num"
      inputMode="numeric"
      aria-label="Rückennummer"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  )
}
