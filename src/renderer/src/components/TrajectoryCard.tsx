import type { TrajectoryType } from '@shared/types'
import {
  APEX_EPS,
  APEX_H_MAX,
  START_H_MAX,
  RISE_EPS,
  setHitHeightFixed,
  HIT_H_MAX,
  solveTrajectory,
  type TrajectoryInput
} from '@renderer/core/physics/trajectory'
import { usePlay } from '@renderer/store/playStore'
import { NumberField } from './NumberField'

const m = (v: number) => `${v.toFixed(2).replace('.', ',')} m`

/**
 * Höhen einer Flugbahn (Annahme oder Zuspiel) per Schieberegler und die berechneten Werte.
 * Dieselben Höhen lassen sich in der Netzansicht direkt an den Griffen ziehen.
 */
export function TrajectoryEditor({ type: selected }: { type: TrajectoryType }) {
  const t = usePlay((s) => s.trajectories[selected])
  const coupled = usePlay((s) => selected === 'zuspiel' && !!s.trajectories.annahme)
  const annahme = usePlay((s) => s.trajectories.annahme)
  const setTrajectory = usePlay((s) => s.setTrajectory)
  if (!t) return null
  const sol = solveTrajectory(t)
  const speed = Math.hypot(sol.vH, sol.vZ0) * 3.6
  const minApex = Math.max(t.start.h, t.hitH) + APEX_EPS

  return (
    <>
      {selected === 'zuspiel' && (
        // Backset: Der Steller steht mit dem Rücken zum Ziel und stellt über den Kopf nach hinten
        <div className="field-col">
          <span className="field-label">Stellen</span>
          <div className="segmented small fill" role="radiogroup" aria-label="Richtung des Zuspiels">
            <button role="radio" aria-checked={!t.backset} className={!t.backset ? 'selected' : ''} onClick={() => t.backset && setTrajectory('zuspiel', { ...t, backset: false })}>
              Nach vorn
            </button>
            <button role="radio" aria-checked={!!t.backset} className={t.backset ? 'selected' : ''} title="Backset: mit dem Rücken zum Ziel über den Kopf nach hinten stellen" onClick={() => !t.backset && setTrajectory('zuspiel', { ...t, backset: true })}>
              Über Kopf
            </button>
          </div>
        </div>
      )}
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
    </>
  )
}

/**
 * Höhe des Schlagpunkts: Der Punkt bleibt, wo er im Feld ist – nur seine Höhe ändert sich, die Kurve passt sich an
 * (ihr höchster Punkt wandert und wird bei Bedarf angehoben). Darunter lässt sich wählen, ob der Ball noch steigend
 * (vor dem höchsten Punkt) getroffen wird.
 */
function HitSlider({ label, input, hint, onChange }: { label: string; input: TrajectoryInput; hint?: string; onChange: (t: TrajectoryInput) => void }) {
  const rising = !!input.rising
  const lo = rising ? input.start.h + RISE_EPS : 0
  const hi = Math.max(HIT_H_MAX, input.hitH)
  // Steigend treffen geht nur, wenn der Schlagpunkt über dem Start liegt
  const canRise = input.hitH > input.start.h + RISE_EPS
  return (
    <div className="traj-slider">
      <span className="row">
        <span className="grow">{label}</span>
        <NumberField label={label} value={input.hitH} min={lo} max={hi} unit="m" onCommit={(h) => onChange(setHitHeightFixed(input, h))} />
      </span>
      <input
        type="range"
        min={lo}
        max={hi}
        step={0.01}
        aria-label={label}
        value={Math.min(hi, Math.max(lo, input.hitH))}
        title="Höhe ändern – der Punkt im Feld bleibt, die Kurve passt sich an"
        onChange={(e) => onChange(setHitHeightFixed(input, Number(e.target.value)))}
      />
      {(canRise || rising) && (
        <label className="row rising-row">
          <span className="grow caption">Ball noch steigend treffen (vor dem höchsten Punkt)</span>
          <input
            type="checkbox"
            className="switch small-switch"
            checked={rising}
            onChange={(e) => onChange(setHitHeightFixed(input, input.hitH, e.target.checked))}
          />
        </label>
      )}
      {hint && <span className="caption">{hint}</span>}
    </div>
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
        <NumberField label={label} value={value} min={min} max={max} unit="m" onCommit={onChange} />
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        aria-label={label}
        value={Math.min(max, Math.max(min, value))}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <span className="caption">{hint}</span>}
    </label>
  )
}
