import { useMemo } from 'react'
import { SPEEDS, buildTimeline, formatTime } from '@renderer/core/timeline/timeline'
import { usePlay } from '@renderer/store/playStore'
import { usePlayback } from '@renderer/store/playbackStore'
import { useVisibleTrajectories } from '@renderer/store/selectors'
import { Icon } from './Icon'
import { speedLabel } from './SettingsDialog'

/**
 * Playbar unter den Ansichten: Abspielen/Pause, Timeline (pausiert frei ziehbar),
 * Schleife, Tempo und die Anzeige-Optionen der Flugbahnen.
 * Ist die Timeline fokussiert und pausiert, gehen ←/→ Frame für Frame (1/60 s).
 */
export function Playbar() {
  const { t, playing, loop, speed, setT, toggle, pause, setLoop, setSpeed, step } = usePlayback()
  const display = usePlay((s) => s.display)
  const setDisplay = usePlay((s) => s.setDisplay)
  const hasAnnahme = usePlay((s) => !!s.trajectories.annahme)
  const hasZuspiel = usePlay((s) => !!s.trajectories.zuspiel)
  const visible = useVisibleTrajectories()
  const total = useMemo(() => buildTimeline(visible.map((v) => ({ type: v.type, input: v.input }))).total, [visible])
  const empty = total <= 0

  return (
    <footer className="playbar" aria-label="Animation">
      <button
        className="icon-only play"
        disabled={empty}
        title={playing ? 'Pause (Leertaste)' : 'Abspielen (Leertaste)'}
        aria-label={playing ? 'Pause' : 'Abspielen'}
        onClick={toggle}
      >
        <Icon name={playing ? 'pause' : 'play'} />
      </button>
      <input
        className="scrubber"
        type="range"
        aria-label="Zeit"
        aria-valuetext={`${formatTime(t)} von ${formatTime(total)}`}
        min={0}
        max={Math.max(total, 0.001)}
        step={0.001}
        value={Math.min(t, total)}
        disabled={empty}
        onPointerDown={pause}
        onChange={(e) => setT(Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
          e.preventDefault()
          if (!playing) step(e.key === 'ArrowRight' ? 1 : -1)
        }}
      />
      <span className="time">
        {formatTime(Math.min(t, total))} <span className="secondary">/ {formatTime(total)}</span>
      </span>
      <button
        className={`icon-only ${loop ? 'selected' : ''}`}
        aria-pressed={loop}
        title={loop ? 'Schleife an' : 'Schleife aus (einmal abspielen)'}
        aria-label="In Schleife abspielen"
        onClick={() => setLoop(!loop)}
      >
        <Icon name="loop" />
      </button>
      <select aria-label="Abspielgeschwindigkeit" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
        {SPEEDS.map((v) => (
          <option key={v} value={v}>
            {speedLabel(v)}
          </option>
        ))}
      </select>
      <span className="playbar-sep" aria-hidden="true" />
      <div className="playbar-toggles" role="group" aria-label="Flugbahnen anzeigen">
        <label className={hasAnnahme ? '' : 'muted'}>
          <input type="checkbox" checked={display.showAnnahme} onChange={(e) => setDisplay({ showAnnahme: e.target.checked })} />
          Annahme
        </label>
        <label className={hasZuspiel ? '' : 'muted'}>
          <input type="checkbox" checked={display.showZuspiel} onChange={(e) => setDisplay({ showZuspiel: e.target.checked })} />
          Zuspiel
        </label>
        <label>
          <input type="checkbox" checked={display.showAfterHit} onChange={(e) => setDisplay({ showAfterHit: e.target.checked })} />
          Nach Schlagpunkt
        </label>
        <label title="Beim Abspielen nur den Ball zeigen, die Flugbahnen ausblenden">
          <input type="checkbox" checked={display.ballOnly} onChange={(e) => setDisplay({ ballOnly: e.target.checked })} />
          Nur Ball
        </label>
      </div>
    </footer>
  )
}
