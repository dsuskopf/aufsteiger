import type { ReactNode } from 'react'
import { BALL_TYPES, ROLE_LABELS, type BallType, type CourtSide } from '@shared/types'
import { JUMP_HEIGHT, RUN_SPEED, jumpRise, pathCurve, pathEnd } from '@renderer/core/motion/motion'
import { usePlay } from '@renderer/store/playStore'
import { useScene } from '@renderer/store/playbackStore'
import { useCourtPlayers } from '@renderer/store/selectors'
import { useUi } from '@renderer/store/settingsStore'
import { rewind } from '@renderer/store/actions'
import { Icon, type IconName } from './Icon'
import { NumberField } from './NumberField'

const fmt = (v: number, d = 2) => v.toFixed(d).replace('.', ',')
const CONTACT: Record<BallType, string> = { annahme: 'Annahme', zuspiel: 'Zuspiel', schlag: 'Angriff' }

/**
 * Was der gewählte Spieler im Spielzug tut – als Liste von Aufgaben in klarer Sprache:
 * Spielt den Ball · Läuft · Springt · Blockt · Täuscht an. Jede Aufgabe sagt in einem Satz, was gerade passiert;
 * eingeschaltete Aufgaben zeigen darunter ihre Einstellungen.
 * Mit Ballkontakt oder Block läuft und springt er von selbst passend; eigene Angaben haben Vorrang.
 */
export function PlayerEditor({ side, playerId }: { side: CourtSide; playerId: string }) {
  const { setPath, setJump, setBlock, setFake, setContact } = usePlay()
  const players = useCourtPlayers()
  const scene = useScene()
  const contacts = usePlay((s) => s.contacts)
  const hasAnnahme = usePlay((s) => !!s.trajectories.annahme)
  const hasZuspiel = usePlay((s) => !!s.trajectories.zuspiel)
  const hasSchlag = usePlay((s) => !!s.schlag)
  const flights = { annahme: hasAnnahme, zuspiel: hasZuspiel, schlag: hasSchlag }
  const tool = useUi((s) => s.tool)

  const p = players.find((q) => q.side === side && q.playerId === playerId)
  if (!p) return null
  const c = p.court
  const path = c.path
  const jump = c.jump
  const plan = scene.plans.get(p.key)
  const length = path ? pathCurve(c, path).length : 0
  const hasAction = !!plan && plan.actions.length > 0
  const autoJump = !jump && plan && plan.jumps.length > 0 ? plan.jumps[0] : null
  const autoRun = !path && plan && plan.legs.length > 0
  const timeMax = Math.max(3, Math.ceil(scene.total + 1))
  const plays = (type: BallType) => contacts[type]?.side === side && contacts[type]?.playerId === playerId
  const played = BALL_TYPES.filter(plays)
  const available = BALL_TYPES.filter((t) => flights[t])
  const drawingPath = tool === 'laufweg'

  return (
    <div className="tasks">
      <Task
        icon="ball"
        title="Spielt den Ball"
        state={played.length ? played.map((t) => CONTACT[t]).join(' und ') : available.length ? 'Nein – antippen, um ihn zu koppeln' : 'Noch keine Ballwege gezeichnet'}
        on={played.length > 0}
      >
        {available.length > 0 && (
          <div className="chips" role="group" aria-label="Ballkontakte des Spielers">
            {available.map((type) => (
              <button
                key={type}
                className={`chip ${plays(type) ? 'selected' : ''}`}
                aria-pressed={plays(type)}
                onClick={() => {
                  rewind()
                  setContact(type, plays(type) ? null : { side, playerId })
                }}
              >
                {CONTACT[type]}
              </button>
            ))}
          </div>
        )}
      </Task>

      <Task
        icon="run"
        title="Läuft"
        state={path ? `Eigener Laufweg · ${fmt(length, 1)} m, Ankunft nach ${fmt(pathEnd(c, path))} s` : autoRun ? 'Von selbst rechtzeitig zum Ball' : drawingPath ? 'Im Feld vom Spieler aus den Weg ziehen' : 'Bleibt auf seinem Platz'}
        on={!!path || !!autoRun}
        control={
          path ? (
            <button className="icon-only plain small" title="Laufweg löschen" aria-label="Laufweg löschen" onClick={() => setPath(side, playerId, null)}>
              <Icon name="trash" size={18} />
            </button>
          ) : (
            <button className={`small ${drawingPath ? 'selected' : ''}`} onClick={() => useUi.getState().setTool(drawingPath ? 'select' : 'laufweg')}>
              <Icon name={drawingPath ? 'close' : 'pencil'} size={16} />
              {drawingPath ? 'Abbrechen' : 'Zeichnen'}
            </button>
          )
        }
      >
        {path && (
          <>
            <ValueSlider label="Startet nach" value={path.delay} min={0} max={timeMax} step={0.05} unit="s" onChange={(delay) => setPath(side, playerId, { ...path, delay })} />
            <ValueSlider label="Tempo" value={path.speed} min={RUN_SPEED.min} max={RUN_SPEED.max} step={0.1} unit="m/s" digits={1} onChange={(speed) => setPath(side, playerId, { ...path, speed })} />
          </>
        )}
      </Task>

      <Task
        icon="jump"
        title="Springt"
        state={jump ? `${fmt(jump.height)} m hoch${jump.sync && hasAction ? ', genau zum Ballkontakt' : `, am höchsten nach ${fmt(jump.at + jumpRise(jump.height))} s`}` : autoJump ? `Von selbst ${fmt(autoJump.height)} m – so hoch, wie der Ball es verlangt` : 'Nein'}
        on={!!jump || !!autoJump}
        control={
          <label className="switch-label" title={jump ? 'Eigenen Sprung entfernen' : 'Sprung selbst festlegen'}>
            <span className="sr-only">Eigener Sprung</span>
            <input
              type="checkbox"
              className="switch"
              checked={!!jump}
              onChange={(e) =>
                setJump(
                  side,
                  playerId,
                  e.target.checked
                    ? {
                        at: autoJump ? Math.max(0, Math.round(autoJump.at * 100) / 100) : path ? pathEnd(c, path) : 0.5,
                        height: autoJump ? Math.round(autoJump.height * 100) / 100 : JUMP_HEIGHT.default,
                        ...(hasAction ? { sync: true } : {})
                      }
                    : null
                )
              }
            />
          </label>
        }
      >
        {jump && (
          <>
            {hasAction && (
              <label className="field-row">
                <span className="grow">Höchster Punkt genau beim Ballkontakt</span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={!!jump.sync}
                  onChange={(e) => {
                    const at = Math.max(0, Math.round((plan?.jumps[0]?.at ?? jump.at) * 100) / 100)
                    setJump(side, playerId, e.target.checked ? { ...jump, sync: true } : { at, height: jump.height })
                  }}
                />
              </label>
            )}
            {!(jump.sync && hasAction) && (
              <ValueSlider
                label="Am höchsten nach"
                value={jump.at + jumpRise(jump.height)}
                min={jumpRise(jump.height)}
                max={timeMax}
                step={0.02}
                unit="s"
                onChange={(apex) => setJump(side, playerId, { ...jump, at: Math.max(0, Math.round((apex - jumpRise(jump.height)) * 1000) / 1000) })}
              />
            )}
            <ValueSlider
              label="Sprunghöhe"
              value={jump.height}
              min={JUMP_HEIGHT.min}
              max={JUMP_HEIGHT.max}
              step={0.01}
              unit="m"
              // Der höchste Punkt bleibt, wo er ist: Ein höherer Sprung beginnt früher
              onChange={(height) => {
                const apex = jump.at + jumpRise(jump.height)
                setJump(side, playerId, { ...jump, height, at: Math.max(0, Math.round((apex - jumpRise(height)) * 1000) / 1000) })
              }}
            />
          </>
        )}
      </Task>

      <Task
        icon="block"
        title="Blockt"
        state={c.block ? 'Springt mit beiden Armen hoch, wenn der Schlag kommt' : 'Nein'}
        on={!!c.block}
        control={
          <label className="switch-label">
            <span className="sr-only">Blockt</span>
            <input
              type="checkbox"
              className="switch"
              checked={!!c.block}
              onChange={(e) => {
                rewind()
                setBlock(side, playerId, e.target.checked)
              }}
            />
          </label>
        }
      >
        {c.block && <p className="caption">Trifft der Ball seine Hände, prallt er ab. Im Feld in die Schlagbahn schieben.</p>}
      </Task>

      <Task
        icon="spike"
        title="Täuscht einen Schlag an"
        state={plays('schlag') ? 'Er schlägt selbst' : c.fake ? (jump && !jump.sync ? 'Schlägt am höchsten Punkt seines Sprungs ins Leere' : 'Schlägt ins Leere, wenn das Zuspiel ihm am nächsten kommt') : 'Nein'}
        on={!!c.fake}
        control={
          <label className="switch-label">
            <span className="sr-only">Schlag antäuschen</span>
            <input
              type="checkbox"
              className="switch"
              checked={!!c.fake}
              disabled={plays('schlag')}
              onChange={(e) => {
                rewind()
                setFake(side, playerId, e.target.checked)
              }}
            />
          </label>
        }
      />
    </div>
  )
}

/** Eine Aufgabe: Symbol, Name, Zustand in einem Satz, Schalter oder Knopf – darunter die Einstellungen */
function Task({ icon, title, state, on, control, children }: { icon: IconName; title: string; state: string; on: boolean; control?: ReactNode; children?: ReactNode }) {
  return (
    <section className={`task ${on ? 'on' : ''}`}>
      <div className="task-head">
        <span className="task-icon">
          <Icon name={icon} size={18} />
        </span>
        <span className="task-text">
          <span className="task-title">{title}</span>
          <span className="task-state">{state}</span>
        </span>
        {control}
      </div>
      {children && <div className="task-body">{children}</div>}
    </section>
  )
}

export { ROLE_LABELS }

function ValueSlider(props: { label: string; value: number; min: number; max: number; step: number; unit: string; digits?: number; onChange: (v: number) => void }) {
  const { label, value, min, max, step, unit, digits = 2, onChange } = props
  return (
    <label className="traj-slider">
      <span className="row">
        <span className="grow">{label}</span>
        <NumberField label={label} value={value} min={min} max={max} digits={digits} unit={unit} onCommit={onChange} />
      </span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
