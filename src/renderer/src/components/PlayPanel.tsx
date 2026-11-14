import { useEffect, useRef } from 'react'
import type { NetPresetId } from '@shared/types'
import { BALL_LABELS, BALL_TYPES, ROLE_LABELS, type BallType, type CourtSide } from '@shared/types'
import { NET_HEIGHT_MAX, NET_HEIGHT_MIN, NET_PRESETS, ballIn } from '@renderer/core/geometry/court'
import { BALL_RADIUS } from '@renderer/core/physics/trajectory'
import { formatTime } from '@renderer/core/timeline/timeline'
import type { BallEvent } from '@renderer/core/physics/rally'
import { usePlay } from '@renderer/store/playStore'
import { usePlayback, useScene, type Scene } from '@renderer/store/playbackStore'
import { useCourtPlayers, type CourtPlayerView } from '@renderer/store/selectors'
import { useUi } from '@renderer/store/settingsStore'
import { rewind } from '@renderer/store/actions'
import { ConfirmButton } from './ConfirmButton'
import { Icon } from './Icon'
import { NumberField } from './NumberField'
import { PlayerEditor } from './PlayerCard'
import { SchlagEditor } from './SchlagCard'
import { TrajectoryEditor } from './TrajectoryCard'

const STEP_HINT: Record<BallType, string> = {
  annahme: 'Im Feld von der Annahme zum Steller ziehen',
  zuspiel: 'Ziel des Zuspiels im Feld antippen',
  schlag: 'Ziel des Schlags im Feld antippen'
}
const FREE_HINT: Record<BallType, string> = {
  annahme: STEP_HINT.annahme,
  zuspiel: 'Im Feld vom Steller zum Angreifer ziehen',
  schlag: 'Im Feld vom Schlagpunkt zum Ziel ziehen'
}
const playerLabel = (p: CourtPlayerView) => `#${p.number} ${p.name || ROLE_LABELS[p.role]}`

/**
 * Reiter „Spielzug“: der Ablauf als Folge der Ballkontakte (Annahme → Zuspiel → Schlag) mit allen Einstellungen
 * des gewählten Schritts, darunter der gewählte Spieler (Ballkontakt, Laufweg, Sprung, Block) und das Netz.
 * Fehlende Schritte zeichnet man von hier aus; es gibt kein eigenes Werkzeug-Menü mehr.
 */
export function PlayPanel() {
  const scene = useScene()
  const players = useCourtPlayers()
  const selected = usePlay((s) => s.selected)
  const selectedPlayer = usePlay((s) => s.selectedPlayer)
  const hasAnything = usePlay(
    (s) => !!s.trajectories.annahme || !!s.trajectories.zuspiel || !!s.schlag || [...s.sides.A.players, ...s.sides.B.players].some((c) => c.path || c.jump || c.block || c.fake)
  )

  const sp = selectedPlayer ? players.find((p) => p.side === selectedPlayer.side && p.playerId === selectedPlayer.playerId) : undefined
  const movers = players.filter((p) => p.court.path || p.court.jump || p.court.block || p.court.fake)

  return (
    <div className="panel-body">
      <section className="panel-section">
        <header className="panel-head">
          <h3>Ablauf</h3>
          <ConfirmButton
            label="Alles löschen"
            confirmLabel="Wirklich alles löschen?"
            icon="trash"
            text
            disabled={!hasAnything}
            onConfirm={() => {
              rewind()
              usePlay.getState().clearTrajectories()
              usePlay.getState().clearMoves()
            }}
          />
        </header>
        <ol className="steps">
          {BALL_TYPES.map((type, i) => (
            <Step key={type} type={type} index={i + 1} scene={scene} players={players} open={selected === type} />
          ))}
        </ol>
        <Outcome scene={scene} players={players} />
      </section>

      <section className="panel-section">
        <header className="panel-head">
          <h3>{sp ? playerLabel(sp) : 'Spieler'}</h3>
          {sp && (
            <>
              <span className="role-pill" title={ROLE_LABELS[sp.role]}>
                {sp.role}
              </span>
              <button className="icon-only plain small" title="Auswahl aufheben (Esc)" aria-label="Auswahl aufheben" onClick={() => usePlay.getState().selectPlayer(null)}>
                <Icon name="close" size={18} />
              </button>
            </>
          )}
        </header>
        {sp ? (
          <div className="inspector-card">
            <PlayerEditor side={sp.side} playerId={sp.playerId} />
          </div>
        ) : (
          <>
            <p className="caption">Spieler im Feld antippen: Laufweg, Sprung, Block – oder ihn an einen Ballkontakt koppeln.</p>
            {movers.length > 0 && (
              <div className="chips">
                {movers.map((p) => (
                  <button key={p.key} className="chip" onClick={() => usePlay.getState().selectPlayer({ side: p.side, playerId: p.playerId })}>
                    <span className="chip-dot" style={{ background: p.jersey.fill, borderColor: p.jersey.stroke }} />#{p.number}
                    <span className="secondary">{[p.court.path && 'Lauf', p.court.jump && 'Sprung', p.court.block && 'Block', p.court.fake && 'Täuscht an'].filter(Boolean).join(' · ')}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <NetSection />
    </div>
  )
}

/** Ein Schritt des Ablaufs: vorhanden (antippen öffnet die Einstellungen) oder noch zu zeichnen */
function Step({ type, index, scene, players, open }: { type: BallType; index: number; scene: Scene; players: CourtPlayerView[]; open: boolean }) {
  const exists = usePlay((s) => (type === 'schlag' ? !!s.schlag : !!s.trajectories[type]))
  const contact = usePlay((s) => s.contacts[type])
  const coupledStart = usePlay((s) => (type === 'zuspiel' ? !!s.trajectories.annahme : type === 'schlag' ? !!s.trajectories.zuspiel : false))
  const tool = useUi((s) => s.tool)
  const viewMode = useUi((s) => s.viewMode)
  const ref = useRef<HTMLLIElement>(null)
  const drawing = tool === type
  const seg = scene.timeline.segments.find((s) => s.type === type)
  const by = contact ? players.find((p) => p.side === contact.side && p.playerId === contact.playerId) : undefined
  const event = scene.events.find((e) => e.kind === type)

  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [open])

  const draw = () => {
    rewind()
    const ui = useUi.getState()
    // Gezeichnet wird in der Draufsicht
    if (ui.viewMode !== '2d') ui.setViewMode('2d')
    if (ui.main2D !== 'top') ui.swapMain2D()
    ui.setTool(drawing ? 'select' : type)
  }
  const remove = () => (type === 'schlag' ? usePlay.getState().removeSchlag() : usePlay.getState().removeTrajectory(type))

  if (!exists)
    return (
      <li className={`step missing ${drawing ? 'drawing' : ''}`} ref={ref}>
        <button className="step-head" onClick={draw} aria-pressed={drawing} title={`${BALL_LABELS[type]} zeichnen`}>
          <span className="step-nr">{index}</span>
          <span className="step-text">
            <span className="step-title">{BALL_LABELS[type]}</span>
            <span className="step-sub">{drawing ? (coupledStart ? STEP_HINT[type] : FREE_HINT[type]) : 'Noch nicht gezeichnet'}</span>
          </span>
          <span className="step-action">
            <Icon name={drawing ? 'close' : 'pencil'} size={16} />
            {drawing ? 'Abbrechen' : 'Zeichnen'}
          </span>
        </button>
      </li>
    )

  return (
    <li className={`step ${open ? 'open' : ''} ${seg ? '' : 'gone'}`} ref={ref}>
      <button
        className="step-head"
        aria-expanded={open}
        onClick={() => {
          usePlay.getState().select(open ? null : type)
          // Auf den Kontakt springen, damit man sieht, worum es geht
          if (!open && seg && !usePlayback.getState().playing && viewMode === '3d') usePlayback.getState().setT(seg.t0)
        }}
      >
        <span className="step-nr">{index}</span>
        <span className="step-text">
          <span className="step-title">{BALL_LABELS[type]}</span>
          <span className="step-sub">
            {seg ? formatTime(seg.t0) : 'findet nicht statt'}
            {by ? ` · ${playerLabel(by)}` : ''}
            {type === 'schlag' && event ? (event.finte ? ' · Finte' : ` · ${Math.round(event.speed * 3.6)} km/h`) : ''}
          </span>
        </span>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={18} />
      </button>
      {open && (
        <div className="step-body">
          <label className="field-row">
            <span className="grow">Gespielt von</span>
            <select
              className="small"
              aria-label={`${BALL_LABELS[type]} gespielt von`}
              value={contact ? `${contact.side}:${contact.playerId}` : ''}
              onChange={(e) => {
                rewind()
                const [side, playerId] = e.target.value.split(':')
                usePlay.getState().setContact(type, e.target.value ? { side: side as CourtSide, playerId } : null)
              }}
            >
              <option value="">Niemand (nur Ball)</option>
              {(['A', 'B'] as const).map((side) => {
                const list = players.filter((p) => p.side === side)
                return list.length ? (
                  <optgroup key={side} label={`Seite ${side}`}>
                    {list.map((p) => (
                      <option key={p.key} value={p.key}>
                        {playerLabel(p)} ({p.role})
                      </option>
                    ))}
                  </optgroup>
                ) : null
              })}
            </select>
          </label>
          {type === 'schlag' ? <SchlagEditor /> : <TrajectoryEditor type={type} />}
          <div className="row end">
            <button className="plain small" onClick={draw} title="Im Feld neu zeichnen (ersetzt diesen Ballweg)">
              <Icon name="pencil" size={16} />
              Neu zeichnen
            </button>
            <button className="plain small danger-text" onClick={remove} title="Löschen (Entf)">
              <Icon name="trash" size={16} />
              Löschen
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/** Wie der Ballwechsel ausgeht: Block, Netz oder wo der Ball landet */
function Outcome({ scene, players }: { scene: Scene; players: CourtPlayerView[] }) {
  const hasSchlag = scene.timeline.segments.some((s) => s.type === 'schlag') || !!scene.deflection
  if (!hasSchlag) return null
  const parts: { icon: 'block' | 'net' | 'ball'; text: string; t: number; warn?: boolean }[] = []
  for (const e of scene.events) {
    if (e.kind === 'block') {
      const by = players.find((p) => p.key === e.by)
      parts.push({ icon: 'block', t: e.t, text: `Block${by ? ` von #${by.number}` : ''} – der Ball prallt ab` })
    } else if (e.kind === 'netz') parts.push({ icon: 'net', t: e.t, text: 'Der Ball bleibt im Netz hängen' })
    else if (e.kind === 'netzkante') parts.push({ icon: 'net', t: e.t, text: 'Netzroller – der Ball fällt über die Kante' })
    else if (e.kind === 'antenne') parts.push({ icon: 'net', t: e.t, text: 'Antenne berührt – Fehler, der Ball ist aus (auch wenn er weiterfliegt)', warn: true })
  }
  const landing = scene.events.find((e) => e.kind === 'boden')
  if (landing && !scene.fault) parts.push({ icon: 'ball', t: landing.t, text: landingText(landing), warn: !ballIn(landing.x, landing.y, BALL_RADIUS) })
  if (parts.length === 0) return null
  return (
    <ul className="outcome" aria-label="Ausgang">
      {parts.map((p, i) => (
        <li key={i}>
          <button
            className={`plain small ${p.warn ? 'danger-text' : ''}`}
            title="Zu diesem Moment springen"
            onClick={() => {
              usePlayback.getState().pause()
              usePlayback.getState().setT(p.t)
            }}
          >
            <Icon name={p.icon} size={16} />
            <span className="grow">{p.text}</span>
            <span className="secondary">{formatTime(p.t)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Im Feld zählt schon, wenn der Ball die Linie berührt (Vogelperspektive: irgendein Stück des Balls darüber) */
function landingText(e: BallEvent): string {
  const side = e.x < 0 ? 'A' : 'B'
  return ballIn(e.x, e.y, BALL_RADIUS) ? `Der Ball landet im Feld ${side}` : `Der Ball landet im Aus (Seite ${side})`
}

const fmt = (v: number) => v.toFixed(2).replace('.', ',')

/** Netzhöhe des Spielzugs: Vorgabe wählen oder frei einstellen */
function NetSection() {
  const { netPreset, setNetPreset, netHeight, setNetHeight } = useUi()
  return (
    <section className="panel-section">
      <header className="panel-head">
        <h3>Netz</h3>
        <NumberField label="Netzhöhe" value={netHeight} min={NET_HEIGHT_MIN} max={NET_HEIGHT_MAX} unit="m" onCommit={setNetHeight} />
      </header>
      <div className="segmented small fill" role="radiogroup" aria-label="Netzhöhe Vorgabe">
        {(Object.entries(NET_PRESETS) as [Exclude<NetPresetId, 'custom'>, { label: string; height: number }][]).map(([id, p]) => (
          <button key={id} role="radio" aria-checked={netPreset === id} className={netPreset === id ? 'selected' : ''} title={`${fmt(p.height)} m`} onClick={() => setNetPreset(id)}>
            {p.label}
          </button>
        ))}
      </div>
      <input type="range" className="wide" aria-label="Netzhöhe" min={NET_HEIGHT_MIN} max={NET_HEIGHT_MAX} step={0.01} value={netHeight} onChange={(e) => setNetHeight(Number(e.target.value))} />
    </section>
  )
}

/** Entf löscht das Gewählte (Ballweg bzw. Laufweg/Sprung/Block des Spielers), Esc hebt die Auswahl auf */
export function useSelectionKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const play = usePlay.getState()
      const ui = useUi.getState()
      if (e.key === 'Escape') {
        if (ui.tool !== 'select') ui.setTool('select')
        else if (play.selected) play.select(null)
        else if (play.selectedPlayer) play.selectPlayer(null)
        return
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (play.selected === 'schlag') play.removeSchlag()
      else if (play.selected) play.removeTrajectory(play.selected)
      else if (play.selectedPlayer) play.clearPlayerMoves(play.selectedPlayer.side, play.selectedPlayer.playerId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
