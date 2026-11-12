import { useEffect } from 'react'
import { TRAJECTORY_LABELS } from '@shared/types'
import {
  APEX_EPS,
  APEX_H_MAX,
  RISE_EPS,
  START_H_MAX,
  hitRanges,
  setHitHeight,
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
  const annahme = usePlay((s) => s.trajectories.annahme)
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
  const rising = !!t.rising
  const canRise = hitRanges(sol).rising !== null
  // Schlagpunkt über seine Höhe auf dem gewählten Ast (Distanz folgt aus der Bahn)
  const setHitH = (h: number) => setTrajectory(selected, setHitHeight(t, h, rising))
  // Ast wechseln: gleiche Höhe auf dem anderen Ast, sonst die Mitte zwischen Start und Scheitel
  const setBranch = (up: boolean) => {
    if (up === rising) return
    const h = up && t.hitH <= t.start.h + RISE_EPS ? (t.start.h + sol.apexH) / 2 : t.hitH
    setTrajectory(selected, setHitHeight(t, h, up))
  }
  // Zuspielhöhe = Ende der Annahme: im Zuspiel (gekoppelt) verschiebt sie den Schlagpunkt der Annahme – beide Bahnen folgen
  const setStartH = (h: number) => {
    if (coupled && annahme) setTrajectory('annahme', setHitHeight(annahme, h, !!annahme.rising))
    else setTrajectory(selected, { ...t, start: { ...t.start, h } })
  }
  const hitMin = rising ? t.start.h + RISE_EPS : 0
  const hitMax = Math.max(hitMin + 0.01, sol.apexH - APEX_EPS)
  const annSol = coupled && annahme ? solveTrajectory(annahme) : null

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
        label={selected === 'annahme' ? 'Annahme' : 'Zuspiel'}
        value={t.start.h}
        min={annSol && annahme?.rising ? annahme.start.h + RISE_EPS : 0}
        max={annSol ? Math.max(0.01, annSol.apexH - APEX_EPS) : START_H_MAX}
        hint={coupled ? 'Ende der Annahme – verschiebt beide Flugbahnen' : undefined}
        onChange={setStartH}
      />
      <MeterSlider label="Höchster Punkt" value={sol.apexH} min={minApex} max={APEX_H_MAX} onChange={(apexH) => setTrajectory(selected, { ...t, apexH })} />
      <MeterSlider
        // Ende der Annahme ist die Höhe, auf der gespielt wird (Zuspiel); beim Zuspiel der Schlagpunkt des Angriffs
        label={selected === 'annahme' ? 'Zuspiel' : 'Schlagpunkt'}
        value={t.hitH}
        min={hitMin}
        max={hitMax}
        onChange={setHitH}
      />
      <div className="segmented branch" role="radiogroup" aria-label="Schlagpunkt auf der Flugkurve">
        <button role="radio" aria-checked={rising} className={rising ? 'selected' : ''} disabled={!canRise} title="Schlagpunkt vor dem höchsten Punkt (Ball steigt noch)" onClick={() => setBranch(true)}>
          Steigend
        </button>
        <button role="radio" aria-checked={!rising} className={!rising ? 'selected' : ''} title="Schlagpunkt nach dem höchsten Punkt (Ball fällt)" onClick={() => setBranch(false)}>
          Fallend
        </button>
      </div>
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
