import { useRef } from 'react'
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
      <div className="spin-row">
        <SpinPad topspin={schlag.topspin} sidespin={schlag.sidespin} onChange={(topspin, sidespin) => setSchlag({ ...schlag, topspin, sidespin })} />
        <dl className="spin-values">
          {topLabel === 'ohne' && sideLabel === 'ohne' && (
            <div>
              <dt>Drall</dt>
              <dd>ohne</dd>
            </div>
          )}
          {topLabel !== 'ohne' && (
            <div>
              <dt>{topLabel}</dt>
              <dd>{fmt(Math.abs(schlag.topspin), 1)} U/s</dd>
            </div>
          )}
          {sideLabel !== 'ohne' && (
            <div>
              <dt>{sideLabel === 'nach rechts' ? 'Rechts' : 'Links'}</dt>
              <dd>{fmt(Math.abs(schlag.sidespin), 1)} U/s</dd>
            </div>
          )}
          <p className="caption">Punkt im Kreis setzen · Doppelklick = ohne Drall</p>
        </dl>
      </div>
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

/**
 * Drall-Kreis: Punkt setzen oder ziehen – oben Topspin, unten Backspin, rechts/links Seitendrall.
 * Abstand zur Mitte = Stärke (Rand = 10 U/s); nahe der Mitte rastet er auf „ohne Drall“ ein.
 * Pfeiltasten verstellen in Schritten von 0,5 U/s.
 */
function SpinPad({ topspin, sidespin, onChange }: { topspin: number; sidespin: number; onChange: (topspin: number, sidespin: number) => void }) {
  const ref = useRef<SVGSVGElement>(null)
  const dragging = useRef<number | null>(null)
  const SIZE = 132
  const R = 54
  const C = SIZE / 2
  const toValue = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect()
    let dx = ((clientX - r.left) / r.width) * SIZE - C
    let dy = ((clientY - r.top) / r.height) * SIZE - C
    const d = Math.hypot(dx, dy)
    if (d > R) {
      dx = (dx / d) * R
      dy = (dy / d) * R
    }
    const k = SPIN_MAX / R
    let side = dx * k
    let top = -dy * k
    // Mitte rastet ein, kleine Werte auf eine Achse
    if (Math.hypot(side, top) < 0.6) side = top = 0
    if (Math.abs(side) < 0.3) side = 0
    if (Math.abs(top) < 0.3) top = 0
    onChange(Math.round(top * 10) / 10, Math.round(side * 10) / 10)
  }
  const px = C + (sidespin / SPIN_MAX) * R
  const py = C - (topspin / SPIN_MAX) * R
  const step = (dt: number, ds: number) => {
    let t = topspin + dt
    let s = sidespin + ds
    const m = Math.hypot(t, s)
    if (m > SPIN_MAX) {
      t = (t / m) * SPIN_MAX
      s = (s / m) * SPIN_MAX
    }
    onChange(Math.round(t * 10) / 10, Math.round(s * 10) / 10)
  }
  return (
    <svg
      ref={ref}
      className="spin-pad"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      role="slider"
      tabIndex={0}
      aria-label="Drall: oben Topspin, unten Backspin, rechts und links Seitendrall"
      aria-valuetext={`Topspin ${topspin}, Seitendrall ${sidespin} Umdrehungen pro Sekunde`}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        dragging.current = e.pointerId
        e.currentTarget.setPointerCapture(e.pointerId)
        toValue(e.clientX, e.clientY)
      }}
      onPointerMove={(e) => dragging.current === e.pointerId && toValue(e.clientX, e.clientY)}
      onPointerUp={(e) => {
        if (dragging.current === e.pointerId) dragging.current = null
      }}
      onPointerCancel={() => (dragging.current = null)}
      onDoubleClick={() => onChange(0, 0)}
      onKeyDown={(e) => {
        const d = 0.5
        if (e.key === 'ArrowUp') step(d, 0)
        else if (e.key === 'ArrowDown') step(-d, 0)
        else if (e.key === 'ArrowRight') step(0, d)
        else if (e.key === 'ArrowLeft') step(0, -d)
        else if (e.key === 'Home' || e.key === '0') onChange(0, 0)
        else return
        e.preventDefault()
      }}
    >
      <circle cx={C} cy={C} r={R} className="pad-ring" />
      <circle cx={C} cy={C} r={R / 2} className="pad-mid" />
      <line x1={C - R} y1={C} x2={C + R} y2={C} className="pad-axis" />
      <line x1={C} y1={C - R} x2={C} y2={C + R} className="pad-axis" />
      <text x={C} y={C - R - 4} className="pad-label" textAnchor="middle">
        Top
      </text>
      <text x={C} y={C + R + 11} className="pad-label" textAnchor="middle">
        Back
      </text>
      <text x={C - R - 4} y={C + 3} className="pad-label" textAnchor="end">
        L
      </text>
      <text x={C + R + 4} y={C + 3} className="pad-label" textAnchor="start">
        R
      </text>
      {(topspin !== 0 || sidespin !== 0) && <line x1={C} y1={C} x2={px} y2={py} className="pad-vector" />}
      <circle cx={px} cy={py} r={7} className="pad-dot" />
    </svg>
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
