import { useEffect } from 'react'
import { TRAJECTORY_LABELS } from '@shared/types'
import {
  APEX_EPS,
  APEX_H_MAX,
  START_H_MAX,
  moveHitAlongParabola,
  solveTrajectory
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
  const selected = usePlay((s) => s.selected)
  const t = usePlay((s) => (s.selected ? s.trajectories[s.selected] : undefined))
  const coupled = usePlay((s) => s.selected === 'zuspiel' && !!s.trajectories.annahme)
  const { setTrajectory, removeTrajectory, select } = usePlay()

  // Entf löscht die gewählte Flugbahn, Esc hebt die Auswahl auf (nicht in Eingabefeldern)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const sel = usePlay.getState().selected
      if (!sel) return
      if (e.key === 'Delete' || e.key === 'Backspace') removeTrajectory(sel)
      if (e.key === 'Escape' && useUi.getState().tool === 'select') select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [removeTrajectory, select])

  if (!selected || !t) return null
  const sol = solveTrajectory(t)
  const speed = Math.hypot(sol.vH, sol.vZ0) * 3.6
  const minApex = Math.max(t.start.h, t.hitH) + APEX_EPS
  // Schlagpunkt über seine Höhe auf dem fallenden Ast (Distanz folgt)
  const setHitH = (h: number) => {
    const hc = Math.min(sol.apexH - APEX_EPS, Math.max(0, h))
    setTrajectory(selected, moveHitAlongParabola(t, sol.sA + Math.sqrt((sol.apexH - hc) / sol.k)))
  }

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
      <MeterSlider
        label="Starthöhe"
        value={t.start.h}
        min={0}
        max={START_H_MAX}
        disabled={coupled}
        hint={coupled ? 'folgt dem Schlagpunkt der Annahme' : undefined}
        onChange={(h) => setTrajectory(selected, { ...t, start: { ...t.start, h } })}
      />
      <MeterSlider label="Scheitel" value={sol.apexH} min={minApex} max={APEX_H_MAX} onChange={(apexH) => setTrajectory(selected, { ...t, apexH })} />
      <MeterSlider
        label="Schlagpunkt"
        value={t.hitH}
        min={0}
        max={Math.max(0.01, sol.apexH - APEX_EPS)}
        hint="verschiebt sich entlang der Parabel"
        onChange={setHitH}
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
