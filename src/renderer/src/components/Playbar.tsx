import { SPEEDS, formatTime } from '@renderer/core/timeline/timeline'
import type { BallEventKind } from '@renderer/core/physics/rally'
import { useSettings } from '@renderer/store/appSettings'
import { usePlay } from '@renderer/store/playStore'
import { usePlayback, useScene } from '@renderer/store/playbackStore'
import { Icon } from './Icon'
import { NumberField } from './NumberField'
import { speedLabel } from './SettingsDialog'

const MARK: Record<BallEventKind, { short: string; label: string }> = {
  annahme: { short: 'A', label: 'Annahme' },
  zuspiel: { short: 'Z', label: 'Zuspiel' },
  schlag: { short: 'S', label: 'Schlag' },
  block: { short: 'B', label: 'Block' },
  netz: { short: 'N', label: 'Netz' },
  netzkante: { short: 'N', label: 'Netzkante' },
  antenne: { short: '!', label: 'Antenne (Fehler)' },
  boden: { short: '', label: 'Boden' }
}

/**
 * Playbar unter den Ansichten: Abspielen/Pause, Zeitleiste mit den Ballkontakten als Marken
 * (pausiert frei ziehbar), Schleife, Tempo, Ton und die Anzeige der Flugbahnen.
 * Ist die Zeitleiste fokussiert und pausiert, gehen ←/→ Bild für Bild (1/60 s).
 */
export function Playbar() {
  const { t, playing, loop, speed, setT, toggle, pause, setLoop, setSpeed, step } = usePlayback()
  const display = usePlay((s) => s.display)
  const setDisplay = usePlay((s) => s.setDisplay)
  const sound = useSettings((s) => s.settings.sound)
  const scene = useScene()
  const total = scene.total
  const empty = total <= 0
  // Nur der erste Bodenkontakt bekommt eine Marke (das Nachspringen wäre nur Rauschen)
  const firstFloor = scene.events.find((e) => e.kind === 'boden')
  const marks = scene.events.filter((e) => e.kind !== 'boden' || e === firstFloor)

  return (
    <footer className="playbar" aria-label="Animation">
      <button className="icon-only play" disabled={empty} title={playing ? 'Pause (Leertaste)' : 'Abspielen (Leertaste)'} aria-label={playing ? 'Pause' : 'Abspielen'} onClick={toggle}>
        <Icon name={playing ? 'pause' : 'play'} />
      </button>
      <div className="scrub-wrap">
        {!empty && (
          <div className="scrub-marks">
            {marks.map((e, i) => (
              <button
                key={i}
                className={`scrub-mark ${e.kind} ${t >= e.t - 1e-6 ? 'passed' : ''}`}
                style={{ left: `calc(8px + (100% - 16px) * ${e.t / total})` }}
                title={`${e.finte ? 'Finte' : MARK[e.kind].label} bei ${formatTime(e.t)} – hierhin springen`}
                aria-label={`Zu ${MARK[e.kind].label} springen`}
                onClick={() => {
                  pause()
                  setT(e.t)
                }}
              >
                {MARK[e.kind].short}
              </button>
            ))}
          </div>
        )}
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
      </div>
      <span className="time">
        <NumberField
          label="Zeit in Sekunden"
          value={Math.min(t, total)}
          min={0}
          max={Math.max(0, total)}
          unit="s"
          onCommit={(v) => {
            pause()
            setT(v)
          }}
        />{' '}
        <span className="secondary">/ {formatTime(total)}</span>
      </span>
      <button className={`icon-only ${loop ? 'selected' : ''}`} aria-pressed={loop} title={loop ? 'Schleife an' : 'Schleife aus (einmal abspielen)'} aria-label="In Schleife abspielen" onClick={() => setLoop(!loop)}>
        <Icon name="loop" />
      </button>
      <select aria-label="Abspielgeschwindigkeit" title="Abspielgeschwindigkeit" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
        {SPEEDS.map((v) => (
          <option key={v} value={v}>
            {speedLabel(v)}
          </option>
        ))}
      </select>
      <button
        className="icon-only plain"
        aria-pressed={sound}
        title={sound ? 'Ton aus' : 'Ton an: Ballkontakte sind zu hören'}
        aria-label="Ton"
        onClick={() => useSettings.getState().update({ sound: !sound })}
      >
        <Icon name={sound ? 'sound' : 'mute'} />
      </button>
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
