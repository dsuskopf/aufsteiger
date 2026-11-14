import { BALL_TYPES, type BallType, type CourtSide } from '@shared/types'
import { JUMP_HEIGHT, RUN_SPEED, jumpRise, pathCurve, pathEnd } from '@renderer/core/motion/motion'
import { usePlay } from '@renderer/store/playStore'
import { useScene } from '@renderer/store/playbackStore'
import { useCourtPlayers } from '@renderer/store/selectors'
import { useUi } from '@renderer/store/settingsStore'
import { rewind } from '@renderer/store/actions'
import { Icon } from './Icon'
import { NumberField } from './NumberField'

const fmt = (v: number, d = 2) => v.toFixed(d).replace('.', ',')
const CONTACT_VERB: Record<BallType, string> = { annahme: 'Nimmt an', zuspiel: 'Stellt', schlag: 'Schlägt' }

/**
 * Was der gewählte Spieler im Spielzug tut: Ballkontakt (annehmen, stellen, schlagen), Laufweg, Sprung, Block.
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
  const anyFlight = BALL_TYPES.some((t) => flights[t])

  return (
    <>
      {anyFlight && (
        <section className="card-section">
          <div className="row">
            <Icon name="ball" size={18} />
            <span className="grow section-title">Am Ball</span>
          </div>
          <div className="chips" role="group" aria-label="Ballkontakt des Spielers">
            {BALL_TYPES.filter((t) => flights[t]).map((type) => (
              <button
                key={type}
                className={`chip ${plays(type) ? 'selected' : ''}`}
                aria-pressed={plays(type)}
                title={plays(type) ? 'Kopplung lösen' : `Dieser Spieler spielt den Ball (${CONTACT_VERB[type]})`}
                onClick={() => {
                  rewind()
                  setContact(type, plays(type) ? null : { side, playerId })
                }}
              >
                {CONTACT_VERB[type]}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card-section">
        <div className="row">
          <Icon name="run" size={18} />
          <span className="grow section-title">Laufweg</span>
          {path ? (
            <button className="icon-only plain small" title="Laufweg löschen" aria-label="Laufweg löschen" onClick={() => setPath(side, playerId, null)}>
              <Icon name="trash" size={18} />
            </button>
          ) : (
            <button className={`small ${tool === 'laufweg' ? 'selected' : ''}`} onClick={() => useUi.getState().setTool(tool === 'laufweg' ? 'select' : 'laufweg')}>
              <Icon name="pencil" size={16} />
              {tool === 'laufweg' ? 'Abbrechen' : 'Zeichnen'}
            </button>
          )}
        </div>
        {path ? (
          <>
            <ValueSlider label="Start nach" value={path.delay} min={0} max={timeMax} step={0.05} unit="s" onChange={(delay) => setPath(side, playerId, { ...path, delay })} />
            <ValueSlider
              label="Tempo"
              value={path.speed}
              min={RUN_SPEED.min}
              max={RUN_SPEED.max}
              step={0.1}
              unit="m/s"
              digits={1}
              onChange={(speed) => setPath(side, playerId, { ...path, speed })}
            />
            <p className="caption">
              {fmt(length, 1)} m · Ankunft nach {fmt(pathEnd(c, path))} s
            </p>
          </>
        ) : (
          <p className="caption">{autoRun ? 'Läuft von selbst rechtzeitig zum Ball. Ein gezeichneter Laufweg hat Vorrang.' : 'Im Feld vom Spieler aus den Weg ziehen – auch in Kurven.'}</p>
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
        {autoJump && <p className="caption">Springt von selbst {fmt(autoJump.height)} m – so hoch, wie der Ball es verlangt. Einschalten, um Höhe und Zeitpunkt selbst festzulegen.</p>}
        {jump && (
          <>
            {hasAction && (
              <label className="field-row">
                <span className="grow">
                  Zeitpunkt automatisch
                  <span className="caption block">Höchster Punkt genau beim Ballkontakt bzw. Block</span>
                </span>
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
              // Eingestellt wird, wann er am höchsten ist (dort trifft er den Ball); der Absprung ergibt sich
              <ValueSlider
                label="Höchster Punkt bei"
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
            <p className="caption">Absprung bei {fmt(Math.max(0, plan?.jumps[0]?.at ?? jump.at))} s</p>
          </>
        )}
      </section>

      <section className="card-section">
        <label className="row">
          <Icon name="block" size={18} />
          <span className="grow section-title">Block</span>
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
        <p className="caption">
          {c.block
            ? 'Springt mit beiden Armen hoch, wenn der Schlag kommt. Trifft der Ball seine Hände, prallt er ab – stell ihn ans Netz in die Bahn.'
            : 'Spieler ans Netz stellen und blocken lassen: Der Schlag prallt an seinen Händen ab.'}
        </p>
      </section>

      <section className="card-section">
        <label className="row">
          <Icon name="spike" size={18} />
          <span className="grow section-title">Schlag antäuschen</span>
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
        <p className="caption">
          {plays('schlag')
            ? 'Er schlägt selbst – antäuschen können nur die anderen Angreifer.'
            : c.fake
              ? jump && !jump.sync
                ? 'Holt aus und schlägt am höchsten Punkt seines Sprungs – ohne Ball.'
                : 'Springt mit dem echten Angriff hoch und schlägt ins Leere – das bindet den Block.'
              : 'Täuschen: Er springt und macht die Schlagbewegung, ohne den Ball zu treffen.'}
        </p>
      </section>
    </>
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
        <NumberField label={label} value={value} min={min} max={max} digits={digits} unit={unit} onCommit={onChange} />
      </span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
