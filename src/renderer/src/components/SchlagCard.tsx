import { ATTACK_SPEED, END_H_MAX, SPIN_MAX, netClearance, solveAttack } from '@renderer/core/physics/attack'
import { usePlay } from '@renderer/store/playStore'
import { useUi } from '@renderer/store/settingsStore'
import { Icon } from './Icon'

const fmt = (v: number, d = 2) => v.toFixed(d).replace('.', ',')

/**
 * Karte zum Schlag: Abschlaggeschwindigkeit, Drall (Topspin/Backspin, links/rechts) und Zielhöhe.
 * Winkel, Flugzeit und höchster Punkt werden daraus berechnet; Hinweise, wenn das Ziel nicht erreichbar ist
 * oder der Ball ins Netz geht.
 */
export function SchlagCard() {
  const selected = usePlay((s) => s.selected === 'schlag')
  const schlag = usePlay((s) => s.schlag)
  const { setSchlag, removeSchlag, select } = usePlay()
  const netHeight = useUi((s) => s.netHeight)
  if (!selected || !schlag) return null
  const sol = solveAttack(schlag)
  const dist = Math.hypot(sol.landing.x - schlag.start.x, sol.landing.y - schlag.start.y)
  const miss = Math.hypot(sol.landing.x - schlag.end.x, sol.landing.y - schlag.end.y)
  const net = netClearance(sol, netHeight)
  const topLabel = schlag.topspin > 0.05 ? 'Topspin' : schlag.topspin < -0.05 ? 'Backspin' : 'ohne'
  const sideLabel = schlag.sidespin > 0.05 ? 'nach rechts' : schlag.sidespin < -0.05 ? 'nach links' : 'ohne'

  return (
    <aside className="traj-card" aria-label="Schlag bearbeiten">
      <header>
        <h3>Schlag</h3>
        <button className="icon-only plain" title="Schlag löschen (Entf)" aria-label="Schlag löschen" onClick={removeSchlag}>
          <Icon name="trash" />
        </button>
        <button className="icon-only plain" title="Schließen (Esc)" aria-label="Auswahl aufheben" onClick={() => select(null)}>
          <Icon name="close" />
        </button>
      </header>
      <Slider
        label="Abschlag"
        value={schlag.speed * 3.6}
        min={ATTACK_SPEED.min * 3.6}
        max={ATTACK_SPEED.max * 3.6}
        step={1}
        text={`${Math.round(schlag.speed * 3.6)} km/h`}
        onChange={(v) => setSchlag({ ...schlag, speed: v / 3.6 })}
      />
      <Slider
        label="Backspin ← → Topspin"
        value={schlag.topspin}
        min={-SPIN_MAX}
        max={SPIN_MAX}
        step={0.1}
        text={`${topLabel}${topLabel !== 'ohne' ? ` ${fmt(Math.abs(schlag.topspin), 1)} U/s` : ''}`}
        onChange={(v) => setSchlag({ ...schlag, topspin: Math.abs(v) < 0.15 ? 0 : v })}
      />
      <Slider
        label="Drall links ← → rechts"
        value={schlag.sidespin}
        min={-SPIN_MAX}
        max={SPIN_MAX}
        step={0.1}
        text={`${sideLabel}${sideLabel !== 'ohne' ? ` ${fmt(Math.abs(schlag.sidespin), 1)} U/s` : ''}`}
        onChange={(v) => setSchlag({ ...schlag, sidespin: Math.abs(v) < 0.15 ? 0 : v })}
      />
      <Slider
        label="Zielhöhe"
        value={schlag.endH}
        min={0}
        max={END_H_MAX}
        step={0.01}
        text={schlag.endH < 0.005 ? 'Boden' : `${fmt(schlag.endH)} m`}
        onChange={(v) => setSchlag({ ...schlag, endH: v < 0.02 ? 0 : v })}
      />
      {!sol.reachable && (
        <p className="caption warn">
          {dist < Math.hypot(schlag.end.x - schlag.start.x, schlag.end.y - schlag.start.y)
            ? `Zu langsam für diese Weite – der Ball landet ${fmt(miss, 1)} m vor dem Ziel.`
            : `Zu schnell für dieses nahe Ziel – der Ball landet ${fmt(miss, 1)} m dahinter.`}
        </p>
      )}
      {net !== null && net < 0 && <p className="caption warn">Der Ball geht ins Netz ({fmt(-net)} m zu tief).</p>}
      <dl className="traj-stats">
        <div>
          <dt>Abschlag</dt>
          <dd>{fmt(sol.elevation, 0)}°</dd>
        </div>
        <div>
          <dt>Flugzeit</dt>
          <dd>{fmt(sol.tHit)} s</dd>
        </div>
        <div>
          <dt>Höchster Punkt</dt>
          <dd>{fmt(sol.apexH)} m</dd>
        </div>
      </dl>
    </aside>
  )
}

function Slider(props: { label: string; value: number; min: number; max: number; step: number; text: string; onChange: (v: number) => void }) {
  const { label, value, min, max, step, text, onChange } = props
  return (
    <label className="traj-slider">
      <span className="row">
        <span className="grow">{label}</span>
        <span className="value">{text}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
