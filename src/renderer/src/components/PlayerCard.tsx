import { useEffect } from 'react'
import { ROLE_LABELS } from '@shared/types'
import { JUMP_HEIGHT, RUN_SPEED, jumpRise, pathCurve, pathEnd } from '@renderer/core/motion/motion'
import { usePlay } from '@renderer/store/playStore'
import { currentTimeline, totalDuration, useTotalDuration } from '@renderer/store/playbackStore'
import { useCourtPlayers } from '@renderer/store/selectors'
import { useUi } from '@renderer/store/settingsStore'
import { Icon } from './Icon'

const fmt = (v: number, d = 2) => v.toFixed(d).replace('.', ',')

/**
 * Karte zum gewählten Spieler: Laufweg (Start, Tempo, löschen) und Sprung (an/aus, Absprung, Höhe).
 * Erscheint an derselben Stelle wie die Flugbahn-Karte; beide schließen sich gegenseitig aus.
 */
export function PlayerCard() {
  const sel = usePlay((s) => s.selectedPlayer)
  const { selectPlayer, setPath, setJump } = usePlay()
  const players = useCourtPlayers()
  const total = useTotalDuration()
  const hasZuspiel = usePlay((s) => !!s.trajectories.zuspiel)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === 'Escape' && usePlay.getState().selectedPlayer) selectPlayer(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectPlayer])

  const p = sel ? players.find((q) => q.side === sel.side && q.playerId === sel.playerId) : undefined
  if (!sel || !p) return null
  const c = p.court
  const path = c.path
  const jump = c.jump
  const length = path ? pathCurve(c, path).length : 0

  /** Absprung so, dass der höchste Punkt des Sprungs mit dem Schlagpunkt des Zuspiels zusammenfällt */
  const atHit = (height: number) => {
    const tl = currentTimeline()
    const seg = tl.segments.find((s) => s.type === 'zuspiel')
    return Math.max(0, (seg ? seg.t1 : 0) - jumpRise(height))
  }
  const defaultJumpAt = (height: number) => (hasZuspiel ? atHit(height) : path ? pathEnd(c, path) : 0)
  const jumpMax = Math.max(3, Math.ceil(totalDuration() + 1))

  return (
    <aside className="traj-card player-card" aria-label="Spieler bearbeiten">
      <header>
        <h3>
          #{p.number} {p.name || ROLE_LABELS[p.role]}
        </h3>
        <button className="icon-only plain" title="Schließen (Esc)" aria-label="Auswahl aufheben" onClick={() => selectPlayer(null)}>
          <Icon name="close" />
        </button>
      </header>

      <section className="card-section">
        <div className="row">
          <Icon name="run" size={18} />
          <span className="grow section-title">Laufweg</span>
          {path ? (
            <button className="icon-only plain" title="Laufweg löschen" aria-label="Laufweg löschen" onClick={() => setPath(sel.side, sel.playerId, null)}>
              <Icon name="trash" />
            </button>
          ) : (
            <button className="plain" onClick={() => useUi.getState().setTool('laufweg')}>
              Zeichnen
            </button>
          )}
        </div>
        {path ? (
          <>
            <ValueSlider
              label="Start nach"
              value={path.delay}
              min={0}
              max={Math.max(3, Math.ceil(total))}
              step={0.05}
              unit="s"
              onChange={(delay) => setPath(sel.side, sel.playerId, { ...path, delay })}
            />
            <ValueSlider
              label="Tempo"
              value={path.speed}
              min={RUN_SPEED.min}
              max={RUN_SPEED.max}
              step={0.1}
              unit="m/s"
              digits={1}
              onChange={(speed) => setPath(sel.side, sel.playerId, { ...path, speed })}
            />
            <p className="caption">
              {fmt(length, 1)} m · Ankunft nach {fmt(pathEnd(c, path))} s · Punkte an den Griffen verschieben
            </p>
          </>
        ) : (
          <p className="caption">Werkzeug „Laufweg“: auf dem Spieler aufsetzen und den Weg ziehen – auch in Kurven.</p>
        )}
      </section>

      <section className="card-section">
        <label className="row">
          <Icon name="jump" size={18} />
          <span className="grow section-title">Sprung</span>
          <input
            type="checkbox"
            className="switch"
            checked={!!jump}
            onChange={(e) =>
              setJump(sel.side, sel.playerId, e.target.checked ? { at: defaultJumpAt(JUMP_HEIGHT.default), height: JUMP_HEIGHT.default } : null)
            }
          />
        </label>
        {jump && (
          <>
            <ValueSlider
              label="Absprung bei"
              value={jump.at}
              min={0}
              max={jumpMax}
              step={0.02}
              unit="s"
              onChange={(at) => setJump(sel.side, sel.playerId, { ...jump, at })}
            />
            <ValueSlider
              label="Sprunghöhe"
              value={jump.height}
              min={JUMP_HEIGHT.min}
              max={JUMP_HEIGHT.max}
              step={0.01}
              unit="m"
              onChange={(height) => setJump(sel.side, sel.playerId, { ...jump, height })}
            />
            {hasZuspiel && (
              <button className="plain" title="Höchster Punkt des Sprungs genau beim Schlagpunkt des Zuspiels" onClick={() => setJump(sel.side, sel.playerId, { ...jump, at: atHit(jump.height) })}>
                Zum Schlagpunkt
              </button>
            )}
          </>
        )}
      </section>
    </aside>
  )
}

function ValueSlider(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  digits?: number
  onChange: (v: number) => void
}) {
  const { label, value, min, max, step, unit, digits = 2, onChange } = props
  return (
    <label className="traj-slider">
      <span className="row">
        <span className="grow">{label}</span>
        <span className="value">
          {fmt(value, digits)} {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
