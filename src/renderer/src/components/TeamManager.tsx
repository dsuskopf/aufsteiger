import { useEffect, useRef, useState } from 'react'
import { ROLES, ROLE_LABELS, type Player, type Team } from '@shared/types'
import { JERSEY_COLORS, LIBERO_COLORS, jerseyFor, textOn } from '@shared/teamColors'
import { useTeams } from '@renderer/store/teamsStore'
import { teamStyle } from '@renderer/theme/teamStyle'
import { ConfirmButton } from './ConfirmButton'
import { ColorPopover } from './ColorPopover'
import { Icon } from './Icon'

/**
 * Teamverwaltung als Sheet: links die Teams, rechts Name, Farben und Spieler des gewählten Teams.
 * Änderungen speichern sich selbst; „Fertig“ schließt.
 */
export function TeamManager({ onClose }: { onClose: () => void }) {
  const { teams, addTeam, saveError } = useTeams()
  const [selectedId, setSelectedId] = useState<string | null>(teams[0]?.id ?? null)
  /** Spieler, dessen Namensfeld den Fokus bekommen soll (neues Team / neuer Spieler) */
  const [focusPlayerId, setFocusPlayerId] = useState<string | null>(null)
  const team = teams.find((t) => t.id === selectedId) ?? teams[0]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const newTeam = () => {
    const { teamId, playerId } = addTeam()
    setSelectedId(teamId)
    setFocusPlayerId(playerId)
  }

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="teams-title">
        <header className="sheet-head">
          <h2 id="teams-title">Teams</h2>
          {saveError && <span className="error">Konnte nicht gespeichert werden. Bitte erneut ändern.</span>}
          <button className="prominent" onClick={onClose}>
            Fertig
          </button>
        </header>

        <div className="teams-body">
          <nav className="team-list" aria-label="Teams">
            <button className="add-row new-team" onClick={newTeam}>
              <Icon name="plus" />
              Neues Team
            </button>
            {teams.map((t) => (
              <button
                key={t.id}
                className={`team-item ${t.id === team?.id ? 'selected' : ''}`}
                style={teamStyle(t)}
                aria-current={t.id === team?.id}
                onClick={() => setSelectedId(t.id)}
              >
                <span className="dot" style={{ background: t.color }} />
                <span className="name">{t.name || 'Ohne Namen'}</span>
                <span className="count">{t.players.length}</span>
              </button>
            ))}
          </nav>

          {team ? (
            <TeamEditor
              key={team.id}
              team={team}
              focusPlayerId={focusPlayerId}
              onFocused={() => setFocusPlayerId(null)}
              onAddedPlayer={setFocusPlayerId}
              onDeleted={() => setSelectedId(null)}
            />
          ) : (
            <div className="team-edit">
              <p className="secondary">Noch kein Team. Lege links ein neues an.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TeamEditor({
  team,
  focusPlayerId,
  onFocused,
  onAddedPlayer,
  onDeleted
}: {
  team: Team
  focusPlayerId: string | null
  onFocused: () => void
  onAddedPlayer: (id: string) => void
  onDeleted: () => void
}) {
  const { renameTeam, deleteTeam, addPlayer, setTeamColor, setLiberoColor } = useTeams()
  const main = jerseyFor(team, 'S')
  const libero = jerseyFor(team, 'L')

  return (
    <div className="team-edit team-scope" style={teamStyle(team)}>
      <div className="row">
        <input
          className="field title grow"
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
            onDeleted()
          }}
        />
      </div>

      <section aria-labelledby="colors-title">
        <h3 className="section-title" id="colors-title">
          Farben
        </h3>
        <div className="colors">
          <div className="jersey-preview" aria-hidden="true">
            <div className="jersey" style={{ background: main.fill, borderColor: main.stroke, color: main.text }}>
              <span className="role">S</span>
              <span className="nr">7</span>
            </div>
            <div className="jersey" style={{ background: libero.fill, borderColor: libero.stroke, color: libero.text }}>
              <span className="role">L</span>
              <span className="nr">11</span>
            </div>
          </div>
          <SwatchRow
            label="Trikot"
            colors={JERSEY_COLORS}
            value={team.color}
            onChange={(c) => setTeamColor(team.id, c)}
          />
          <SwatchRow
            label="Libero"
            colors={LIBERO_COLORS}
            value={team.liberoColor}
            onChange={(c) => setLiberoColor(team.id, c)}
          />
        </div>
      </section>

      <section aria-labelledby="players-title">
        <h3 className="section-title" id="players-title">
          Spieler
        </h3>
        <div className="players" role="table" aria-labelledby="players-title">
          <div className="player-row head" role="row">
            <span role="columnheader">Nr.</span>
            <span role="columnheader">Name</span>
            <span role="columnheader">Positionen</span>
            <span />
          </div>
          {team.players.map((p) => (
            <PlayerRow
              key={p.id}
              teamId={team.id}
              player={p}
              autoFocus={p.id === focusPlayerId}
              onFocused={onFocused}
            />
          ))}
        </div>
        <button className="add-row" onClick={() => onAddedPlayer(addPlayer(team.id))}>
          <Icon name="plus" />
          Spieler hinzufügen
        </button>
      </section>
    </div>
  )
}

function SwatchRow({
  label,
  colors,
  value,
  onChange
}: {
  label: string
  colors: readonly { hex: string; name: string }[]
  value: string
  onChange: (hex: string) => void
}) {
  const isCustom = !colors.some((c) => c.hex === value)
  const [open, setOpen] = useState(false)
  return (
    <div className="swatch-row" role="radiogroup" aria-label={`${label}farbe`}>
      <span className="label">{label}</span>
      {colors.map((c) => (
        <button
          key={c.hex}
          role="radio"
          aria-checked={c.hex === value}
          aria-label={c.name}
          title={c.name}
          className={`swatch ${c.hex === value ? 'selected' : ''}`}
          style={{ background: c.hex }}
          onClick={() => onChange(c.hex)}
        />
      ))}
      {/* Eigene Farbe: öffnet den Farbwähler (mit Hex-Code). Das Stift-Symbol zeigt, dass man hier ändern kann. */}
      <span className="custom-wrap">
        <button
          data-color-trigger
          className={`swatch custom ${isCustom ? 'selected' : ''}`}
          title="Eigene Farbe wählen"
          aria-label={`Eigene ${label}farbe wählen`}
          aria-expanded={open}
          aria-haspopup="dialog"
          style={isCustom ? { background: value, color: textOn(value) } : undefined}
          onClick={() => setOpen(!open)}
        >
          <Icon name="pencil" size={18} />
        </button>
        {open && <ColorPopover label={label} value={value} onChange={onChange} onClose={() => setOpen(false)} />}
      </span>
    </div>
  )
}

function PlayerRow({
  teamId,
  player,
  autoFocus,
  onFocused
}: {
  teamId: string
  player: Player
  autoFocus: boolean
  onFocused: () => void
}) {
  const { updatePlayer, togglePosition, deletePlayer } = useTeams()
  const nameRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!autoFocus) return
    nameRef.current?.focus()
    nameRef.current?.scrollIntoView({ block: 'nearest' })
    onFocused()
  }, [autoFocus, onFocused])

  return (
    <div className="player-row" role="row">
      <NumberInput value={player.number} onCommit={(n) => updatePlayer(teamId, player.id, { number: n })} />
      <input
        ref={nameRef}
        className="field"
        aria-label="Name"
        value={player.name}
        placeholder="Name"
        onChange={(e) => updatePlayer(teamId, player.id, { name: e.target.value })}
      />
      <div className="roles" role="group" aria-label="Positionen">
        {ROLES.map((r) => {
          const on = player.positions.includes(r)
          return (
            <button
              key={r}
              className={on ? 'selected' : ''}
              data-role={r}
              title={ROLE_LABELS[r]}
              aria-label={ROLE_LABELS[r]}
              aria-pressed={on}
              onClick={() => togglePosition(teamId, player.id, r)}
            >
              {r}
            </button>
          )
        })}
      </div>
      <ConfirmButton
        icon="trash"
        label="Spieler löschen"
        confirmLabel="Löschen?"
        onConfirm={() => deletePlayer(teamId, player.id)}
      />
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
      className="field num"
      inputMode="numeric"
      aria-label="Rückennummer"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  )
}
