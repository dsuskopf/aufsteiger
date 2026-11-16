import { useRef } from 'react'
import { ATTACK_SPEED, FINTE_ARC, FINTE_DEPTH, SPIN_MAX, netClearance, solveAttack } from '@renderer/core/physics/attack'
import type { Attack } from '@shared/types'
import { rewind } from '@renderer/store/actions'
import { usePlay } from '@renderer/store/playStore'
import { useUi } from '@renderer/store/settingsStore'
import { useScene } from '@renderer/store/playbackStore'
import { NumberField } from './NumberField'

const fmt = (v: number, d = 2) => v.toFixed(d).replace('.', ',')

/** Finte: Ziel kurz hinter das Netz legen (gleiche Richtung), falls es weiter weg liegt */
function toFinte(a: Attack): Attack {
  const dx = a.end.x - a.start.x
  const dy = a.end.y - a.start.y
  const face = Math.sign(dx) || 1
  const depth = Math.abs(a.end.x)
  let end = a.end
  if (depth > FINTE_DEPTH + 0.5 && Math.abs(dx) > 0.3) {
    const k = (face * FINTE_DEPTH - a.start.x) / dx
    if (k > 0 && k < 1) end = { x: Math.round((a.start.x + dx * k) * 100) / 100, y: Math.round((a.start.y + dy * k) * 100) / 100 }
  }
  return { ...a, end, finte: true, arc: a.arc ?? FINTE_ARC.default }
}

/**
 * Einstellungen zum Schlag. Angriff: Abschlaggeschwindigkeit und Drall (Topspin/Backspin, links/rechts).
 * Finte: nur die Bogenhöhe – der Ball wird leicht über den Block getippt.
 * Winkel, Flugzeit und höchster Punkt werden berechnet; Hinweise, wenn das Ziel nicht erreichbar ist
 * oder der Ball ins Netz geht.
 */
export function SchlagEditor() {
  const schlag = usePlay((s) => s.schlag)
  const setSchlag = usePlay((s) => s.setSchlag)
  const netHeight = useUi((s) => s.netHeight)
  const scene = useScene()
  if (!schlag) return null
  const blocked = scene.deflection?.type === 'schlag' && scene.deflection.kind === 'block'
  const sol = solveAttack(schlag)
  const dist = Math.hypot(sol.landing.x - schlag.start.x, sol.landing.y - schlag.start.y)
  const miss = Math.hypot(sol.landing.x - schlag.end.x, sol.landing.y - schlag.end.y)
  const net = netClearance(sol, netHeight)

  return (
    <>
      <div className="segmented small fill" role="radiogroup" aria-label="Art des Schlags">
        <button
          role="radio"
          aria-checked={!schlag.finte}
          className={!schlag.finte ? 'selected' : ''}
          title="Harter Schlag mit Tempo und Drall"
          onClick={() => {
            rewind()
            setSchlag({ ...schlag, finte: false })
          }}
        >
          Schlag
        </button>
        <button
          role="radio"
          aria-checked={!!schlag.finte}
          className={schlag.finte ? 'selected' : ''}
          title="Finte: den Ball leicht im Bogen über den Block tippen"
          onClick={() => {
            rewind()
            setSchlag(toFinte(schlag))
          }}
        >
          Finte
        </button>
      </div>
      {schlag.finte ? (
        <>
          <Slider
            label="Bogen über dem Schlagpunkt"
            value={schlag.arc ?? FINTE_ARC.default}
            min={FINTE_ARC.min}
            max={FINTE_ARC.max}
            step={0.05}
            digits={2}
            unit="m"
            onChange={(v) => setSchlag({ ...schlag, arc: v })}
          />
          <p className="caption">Der Angreifer tippt den Ball knapp über den Block. Das Ziel verschiebst du im Feld, das Tempo ergibt sich aus Bogen und Weite.</p>
        </>
      ) : (
        <>
          <Slider
            label="Abschlag"
            value={schlag.speed * 3.6}
            min={ATTACK_SPEED.min * 3.6}
            max={ATTACK_SPEED.max * 3.6}
            step={1}
            digits={0}
            unit="km/h"
            onChange={(v) => setSchlag({ ...schlag, speed: v / 3.6 })}
          />
          {/* Drall ist für Fortgeschrittene: eingeklappt, die Zusammenfassung sagt, was eingestellt ist */}
          <details className="disclosure">
            <summary>
              <span className="grow">Drall</span>
              <span className="secondary">{spinSummary(schlag.topspin, schlag.sidespin)}</span>
            </summary>
            <div className="spin-row">
              <SpinPad topspin={schlag.topspin} sidespin={schlag.sidespin} onChange={(topspin, sidespin) => setSchlag({ ...schlag, topspin, sidespin })} />
            </div>
            <p className="caption">Der Punkt zeigt, wo die Hand den Ball trifft. Oben getroffen fällt er steiler (Topspin), unten getroffen trägt er weiter. Rechts getroffen kurvt er nach links, links getroffen nach rechts.</p>
          </details>
        </>
      )}
      {!sol.reachable && (
        <p className="caption warn">
          {dist < Math.hypot(schlag.end.x - schlag.start.x, schlag.end.y - schlag.start.y)
            ? `Zu langsam für diese Weite – der Ball landet ${fmt(miss, 1)} m vor dem Ziel.`
            : `Zu schnell für dieses nahe Ziel – der Ball landet ${fmt(miss, 1)} m dahinter.`}
        </p>
      )}
      {net !== null && net < 0 && !blocked && <p className="caption warn">Der Ball geht ins Netz ({fmt(-net)} m zu tief) und prallt dort ab.</p>}
      <dl className="traj-stats">
        <div>
          <dt>{schlag.finte ? 'Tempo' : 'Abschlag'}</dt>
          <dd>{schlag.finte ? `${Math.round(sol.speed * 3.6)} km/h` : `${fmt(sol.elevation, 0)}°`}</dd>
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
    </>
  )
}

/** Drall in Worten, z. B. „Topspin 3 · Rechtsdrall 1“ */
function spinSummary(top: number, side: number): string {
  const parts: string[] = []
  if (top > 0) parts.push(`Topspin ${fmt(top, 1)}`)
  if (top < 0) parts.push(`Rückwärts ${fmt(-top, 1)}`)
  if (side > 0) parts.push(`Rechtsdrall ${fmt(side, 1)}`)
  if (side < 0) parts.push(`Linksdrall ${fmt(-side, 1)}`)
  return parts.length ? parts.join(' · ') + ' U/s' : 'ohne'
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
      aria-label="Drall als Trefferstelle: oben Topspin, unten Backspin, rechts getroffen kurvt nach links, links getroffen nach rechts"
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

function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  digits: number
  unit: string
  display?: string
  onChange: (v: number) => void
}) {
  const { label, value, min, max, step, digits, unit, display, onChange } = props
  return (
    <label className="traj-slider">
      <span className="row">
        <span className="grow">{label}</span>
        <NumberField label={label} value={value} min={min} max={max} digits={digits} unit={display ? undefined : unit} display={display} onCommit={onChange} />
      </span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
