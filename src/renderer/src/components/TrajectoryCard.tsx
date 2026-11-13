import { useEffect, useId } from 'react'
import { TRAJECTORY_LABELS } from '@shared/types'
import {
  APEX_EPS,
  APEX_H_MAX,
  START_H_MAX,
  hitRanges,
  moveHitAlongParabola,
  solveTrajectory,
  type TrajectoryInput
} from '@renderer/core/physics/trajectory'
import { usePlay } from '@renderer/store/playStore'
import { useUi } from '@renderer/store/settingsStore'
import { Icon } from './Icon'

const m = (v: number) => `${v.toFixed(2).replace('.', ',')} m`

/**
 * Karte zur gewählten Flugbahn: Höhen per Schieberegler (ziehen, live) und die berechneten Werte.
 * Dieselben Höhen lassen sich in der Netzansicht direkt an den Griffen ziehen; die Karte wirkt auch in 3D.
 */
export function TrajectoryCard() {
  // Diese Karte gilt für Annahme und Zuspiel; der Schlag hat seine eigene Karte
  const selected = usePlay((s) => (s.selected === 'schlag' ? null : s.selected))
  const t = usePlay((s) => (s.selected && s.selected !== 'schlag' ? s.trajectories[s.selected] : undefined))
  const coupled = usePlay((s) => s.selected === 'zuspiel' && !!s.trajectories.annahme)
  const annahme = usePlay((s) => s.trajectories.annahme)
  const { setTrajectory, removeTrajectory, select } = usePlay()

  // Entf löscht die gewählte Flugbahn, Esc hebt die Auswahl auf (nicht in Eingabefeldern)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const sel = usePlay.getState().selected
      if (!sel) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (sel === 'schlag') usePlay.getState().removeSchlag()
        else removeTrajectory(sel)
      }
      if (e.key === 'Escape' && useUi.getState().tool === 'select') select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [removeTrajectory, select])

  if (!selected || !t) return null
  const sol = solveTrajectory(t)
  const speed = Math.hypot(sol.vH, sol.vZ0) * 3.6
  const minApex = Math.max(t.start.h, t.hitH) + APEX_EPS

  return (
    <aside className="traj-card" aria-label={`${TRAJECTORY_LABELS[selected]} bearbeiten`}>
      <header>
        <h3>{TRAJECTORY_LABELS[selected]}</h3>
        <button className="icon-only plain" title="Flugbahn löschen (Entf)" aria-label="Flugbahn löschen" onClick={() => removeTrajectory(selected)}>
          <Icon name="trash" />
        </button>
        <button className="icon-only plain" title="Schließen (Esc)" aria-label="Auswahl aufheben" onClick={() => select(null)}>
          <Icon name="close" />
        </button>
      </header>
      {coupled && annahme ? (
        // Zuspielhöhe = Ende der Annahme: verschiebt den Schlagpunkt der Annahme, beide Bahnen folgen
        <HitSlider label="Zuspiel" input={annahme} hint="Ende der Annahme – verschiebt beide Flugbahnen" onChange={(n) => setTrajectory('annahme', n)} />
      ) : (
        <MeterSlider
          label={selected === 'annahme' ? 'Annahme' : 'Zuspiel'}
          value={t.start.h}
          min={0}
          max={START_H_MAX}
          onChange={(h) => setTrajectory(selected, { ...t, start: { ...t.start, h } })}
        />
      )}
      <MeterSlider label="Höchster Punkt" value={sol.apexH} min={minApex} max={APEX_H_MAX} onChange={(apexH) => setTrajectory(selected, { ...t, apexH })} />
      <HitSlider
        // Ende der Annahme ist die Höhe, auf der gespielt wird (Zuspiel); beim Zuspiel der Schlagpunkt des Angriffs
        label={selected === 'annahme' ? 'Zuspiel' : 'Schlagpunkt'}
        input={t}
        onChange={(n) => setTrajectory(selected, n)}
      />
      <dl className="traj-stats">
        <div>
          <dt>Distanz</dt>
          <dd>{m(sol.D)}</dd>
        </div>
        <div>
          <dt>Flugzeit</dt>
          <dd>{sol.tHit.toFixed(2).replace('.', ',')} s</dd>
        </div>
        <div>
          <dt>Abflug</dt>
          <dd>{Math.round(speed)} km/h</dd>
        </div>
      </dl>
    </aside>
  )
}

/**
 * Schlagpunkt entlang der Flugkurve: ein durchgehender Regler vom Start über den höchsten Punkt bis zum Boden.
 * Links vom Strich (Scheitel) wird der Ball noch steigend getroffen, rechts fallend. Angezeigt wird die Höhe.
 */
function HitSlider({ label, input, hint, onChange }: { label: string; input: TrajectoryInput; hint?: string; onChange: (t: TrajectoryInput) => void }) {
  const id = useId()
  const sol = solveTrajectory(input)
  const { rising, falling } = hitRanges(sol)
  const lo = rising ? rising[0] : falling[0]
  const hi = Math.max(lo + 0.01, falling[1])
  return (
    <label className="traj-slider">
      <span className="row">
        <span className="grow">{label}</span>
        {sol.rising && <span className="tag-rising">vor dem höchsten Punkt</span>}
        <span className="value">{m(input.hitH)}</span>
      </span>
      <input
        type="range"
        min={lo}
        max={hi}
        step={0.005}
        list={id}
        value={Math.min(hi, Math.max(lo, sol.D))}
        title="Über den höchsten Punkt ziehen: Schlagpunkt vor dem Scheitel (Ball steigt noch)"
        onChange={(e) => onChange(moveHitAlongParabola(input, Number(e.target.value)))}
      />
      {/* Markierung am höchsten Punkt */}
      <datalist id={id}>{rising && <option value={sol.sA} />}</datalist>
      {hint && <span className="caption">{hint}</span>}
    </label>
  )
}

export function MeterSlider(props: {
  label: string
  value: number
  min: number
  max: number
  disabled?: boolean
  hint?: string
  onChange: (v: number) => void
}) {
  const { label, value, min, max, disabled, hint, onChange } = props
  return (
    <label className={`traj-slider ${disabled ? 'disabled' : ''}`}>
      <span className="row">
        <span className="grow">{label}</span>
        <span className="value">{m(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={Math.min(max, Math.max(min, value))}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <span className="caption">{hint}</span>}
    </label>
  )
}
