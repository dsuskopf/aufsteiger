import { useState } from 'react'
import type { CourtSide, Situation } from '@shared/types'
import { LAEUFER, SITUATIONS, SITUATION_LABELS, currentLaeufer, formationChanged, formationKey } from '@renderer/core/lineup/rotation'
import { usePlay } from '@renderer/store/playStore'
import { useTeams } from '@renderer/store/teamsStore'
import { usePlayback } from '@renderer/store/playbackStore'
import { Icon } from './Icon'

/**
 * Läufersystem in der zweiten Toolbar-Reihe: Läufer 1–6 (= Position des Stellers) und Annahme/Aufschlag.
 * Antippen springt sofort zur Aufstellung (Spieler gleiten hin); „Sichern“ speichert die aktuellen Plätze
 * für diesen Läufer im Team, „Standard“ verwirft sie wieder. Gespeicherte Läufer tragen einen Punkt.
 */
export function LaeuferBar() {
  const sides = usePlay((s) => s.sides)
  const { applyLaeufer, saveFormation, resetFormation } = usePlay()
  const teams = useTeams((s) => s.teams)
  const [picked, setPicked] = useState<CourtSide>('A')

  const usable = (['A', 'B'] as const).filter((sd) => sides[sd].teamId && sides[sd].players.some((c) => c.slot))
  if (usable.length === 0) return null
  const side = usable.includes(picked) ? picked : usable[0]
  const s = sides[side]
  const team = teams.find((t) => t.id === s.teamId)
  const active = s.laeufer
  const situation: Situation = active?.situation ?? 'annahme'
  const now = currentLaeufer(s, team)
  const changed = formationChanged(s, team, side)
  const stored = active ? team?.rotations?.[formationKey(active.n, active.situation)] : undefined

  const go = (n: number, sit: Situation) => {
    // Sprung zu einer Aufstellung: Animation anhalten und an den Anfang, damit man die Grundstellung sieht
    usePlayback.getState().pause()
    usePlayback.setState({ t: 0 })
    applyLaeufer(side, n, sit)
  }

  return (
    <div className="laeufer-bar" role="group" aria-label="Läufersystem">
      <span className="bar-label" title="Läufer = Position des Stellers (Läufer 1: Steller auf Position 1)">
        Läufer
      </span>
      {usable.length > 1 && (
        <div className="segmented sides" role="radiogroup" aria-label="Feldseite">
          {usable.map((sd) => (
            <button key={sd} role="radio" aria-checked={sd === side} className={sd === side ? 'selected' : ''} onClick={() => setPicked(sd)}>
              {sd}
            </button>
          ))}
        </div>
      )}
      <div className="segmented nums" role="radiogroup" aria-label="Läufer">
        {LAEUFER.map((n) => {
          const saved = !!team?.rotations?.[formationKey(n, situation)]
          const sel = active ? active.n === n : false
          return (
            <button
              key={n}
              role="radio"
              aria-checked={sel}
              className={`${sel ? 'selected' : ''} ${saved ? 'saved' : ''} ${!active && now === n ? 'current' : ''}`}
              title={`Läufer ${n}: Steller auf Position ${n}${saved ? ' · gespeichert' : ''}`}
              onClick={() => go(n, situation)}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div className="segmented" role="radiogroup" aria-label="Situation">
        {SITUATIONS.map((sit) => (
          <button
            key={sit}
            role="radio"
            aria-checked={situation === sit && !!active}
            className={situation === sit && active ? 'selected' : ''}
            onClick={() => go(active?.n ?? now ?? 1, sit)}
          >
            {SITUATION_LABELS[sit]}
          </button>
        ))}
      </div>
      <button
        className="plain"
        disabled={!active || !changed}
        title={active ? `Aktuelle Plätze als Läufer ${active.n} · ${SITUATION_LABELS[active.situation]} im Team speichern` : 'Erst einen Läufer wählen'}
        onClick={() => saveFormation(side)}
      >
        <Icon name="save" />
        Sichern
        {changed && <span className="changed-dot" aria-label="geändert" />}
      </button>
      <button
        className="icon-only plain"
        disabled={!stored}
        title="Gespeicherte Plätze dieses Läufers verwerfen (Standardplätze)"
        aria-label="Standardplätze"
        onClick={() => resetFormation(side)}
      >
        <Icon name="reset" />
      </button>
    </div>
  )
}
