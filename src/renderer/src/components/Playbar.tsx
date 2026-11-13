import { SPEEDS, formatTime } from '@renderer/core/timeline/timeline'
import { usePlay } from '@renderer/store/playStore'
import { usePlayback, useTotalDuration } from '@renderer/store/playbackStore'
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
  const total = useTotalDuration()
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
        <label title="Flugbahnen auch beim Abspielen zeigen (aus: nur der Ball fliegt)">
          <input type="checkbox" checked={!display.ballOnly} onChange={(e) => setDisplay({ ballOnly: !e.target.checked })} />
          Flugbahn
        </label>
      </div>
    </footer>
  )
}
