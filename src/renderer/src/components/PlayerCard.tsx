import { BALL_TYPES, ROLE_LABELS, type BallType, type CourtSide, type Jump } from '@shared/types'
import { JUMP_HEIGHT, RUN_SPEED, jumpRise, pathCurve, pathEnd } from '@renderer/core/motion/motion'
import type { ActionKind, PlayerPlan } from '@renderer/core/motion/plan'
import { usePlay } from '@renderer/store/playStore'
import { useScene } from '@renderer/store/playbackStore'
import { useCourtPlayers } from '@renderer/store/selectors'
import { useUi } from '@renderer/store/settingsStore'
import { rewind } from '@renderer/store/actions'
import { Icon, type IconName } from './Icon'
import { NumberField } from './NumberField'
import { Section } from './sidebar/common'

const fmt = (v: number, d = 2) => v.toFixed(d).replace('.', ',')
const round = (v: number, k = 100) => Math.max(0, Math.round(v * k) / k)

/** Aufgaben im Spielzug: die drei Ballkontakte, Antäuschen und Block */
type TaskId = BallType | 'fake' | 'block'
const TASK: Record<TaskId, { label: string; icon: IconName; verb: string }> = {
  annahme: { label: 'Annahme', icon: 'ball', verb: 'nimmt an' },
  zuspiel: { label: 'Zuspiel', icon: 'arc', verb: 'stellt' },
  schlag: { label: 'Angriff', icon: 'spike', verb: 'greift an' },
  fake: { label: 'Antäuschen', icon: 'spike', verb: 'täuscht einen Angriff an' },
  block: { label: 'Block', icon: 'block', verb: 'blockt' }
}
/** Woran der Sprung gekoppelt ist („am höchsten beim …“) */
const AT_ACTION: Record<ActionKind, string> = { annahme: 'Bei der Annahme', zuspiel: 'Beim Zuspiel', schlag: 'Beim Angriff', fake: 'Beim Antäuschen', block: 'Beim Block' }

/** Seite, auf der ein Ballweg startet – reaktiv (dort steht, wer ihn spielt) */
function useStartSides(): Record<BallType, CourtSide | null> {
  const sideOf = (x: number | undefined) => (x === undefined ? null : x <= 0 ? 'A' : 'B')
  const annahme = usePlay((s) => sideOf(s.trajectories.annahme?.start.x))
  const zuspiel = usePlay((s) => sideOf(s.trajectories.zuspiel?.start.x))
  const schlag = usePlay((s) => sideOf(s.schlag?.start.x))
  return { annahme, zuspiel, schlag }
}

/** Laufweg im Feld zeichnen – geht nur in der Draufsicht; nochmal antippen bricht ab */
function togglePathDrawing() {
  const ui = useUi.getState()
  if (ui.tool === 'laufweg') return ui.setTool('select')
  rewind()
  if (ui.viewMode !== '2d') ui.setViewMode('2d')
  if (ui.main2D !== 'top') ui.swapMain2D()
  ui.setTool('laufweg')
}

/**
 * Was der gewählte Spieler im Spielzug tut, in drei Blöcken:
 *  1. Aufgabe – was er mit dem Ball (oder am Netz) macht. Daraus ergeben sich Laufen und Springen von selbst.
 *  2. Laufen  – automatisch oder ein eigener, im Feld gezeichneter Weg.
 *  3. Springen – automatisch oder eine eigene Höhe/ein eigener Zeitpunkt.
 * Eigene Angaben haben Vorrang vor den automatischen.
 */
export function PlayerEditor({ side, playerId }: { side: CourtSide; playerId: string }) {
  const players = useCourtPlayers()
  const scene = useScene()
  const p = players.find((q) => q.side === side && q.playerId === playerId)
  if (!p) return null
  const plan = scene.plans.get(p.key)
  const timeMax = Math.max(3, Math.ceil(scene.total + 1))
  return (
    <>
      <TaskSection side={side} playerId={playerId} isLibero={p.role === 'L'} block={!!p.court.block} fake={!!p.court.fake} />
      <RunSection side={side} playerId={playerId} plan={plan} timeMax={timeMax} />
      <JumpSection side={side} playerId={playerId} plan={plan} timeMax={timeMax} />
    </>
  )
}

/* ---------- 1. Aufgabe ---------- */

function TaskSection({ side, playerId, isLibero, block, fake }: { side: CourtSide; playerId: string; isLibero: boolean; block: boolean; fake: boolean }) {
  const contacts = usePlay((s) => s.contacts)
  const starts = useStartSides()
  const plays = (t: BallType) => contacts[t]?.side === side && contacts[t]?.playerId === playerId
  // Angreifende Seite: wo die Ballwege starten (Annahme, Zuspiel und Angriff liegen auf derselben Seite)
  const attacking = starts.schlag ?? starts.zuspiel ?? starts.annahme
  const ownSide = attacking === null || attacking === side

  const isOn = (t: TaskId) => (t === 'block' ? block : t === 'fake' ? fake : plays(t))
  // Angeboten wird nur, was für ihn passt – was schon eingeschaltet ist, bleibt immer zum Ausschalten da
  const offered = (t: TaskId) => {
    if (isOn(t)) return true
    if (isLibero && (t === 'schlag' || t === 'fake' || t === 'block')) return false // Regel: Libero greift nicht an und blockt nicht
    if (t === 'block') return !ownSide
    if (t === 'fake') return ownSide
    return starts[t] === side
  }
  const ids = ([...BALL_TYPES, 'fake', 'block'] as TaskId[]).filter(offered)
  const on = ids.filter(isOn)

  const toggle = (t: TaskId) => {
    const { setContact, setBlock, setFake } = usePlay.getState()
    rewind()
    const next = !isOn(t)
    if (t === 'block') return setBlock(side, playerId, next)
    if (t === 'fake') {
      // Antäuschen statt selbst angreifen
      if (next && plays('schlag')) setContact('schlag', null)
      return setFake(side, playerId, next)
    }
    if (t === 'schlag' && next && fake) setFake(side, playerId, false)
    setContact(t, next ? { side, playerId } : null)
  }

  // Zum Ball läuft er von selbst; Block und Antäuschen bleiben am Platz (oder auf dem eigenen Laufweg)
  const hasBallTask = on.some((t) => t !== 'block' && t !== 'fake')
  const hint =
    on.length > 0
      ? `Er ${joinAnd(on.map((t) => TASK[t].verb))}.${hasBallTask ? ' Laufen und Springen passen sich von selbst an.' : ' Springen passt sich von selbst an.'}`
      : ids.length > 0
        ? 'Keine – er steht nur auf dem Feld. Tippe an, was er tun soll.'
        : 'Ballkontakte gibt es, sobald Ballwege gezeichnet sind.'

  return (
    <Section title="Aufgabe" icon="person" hint={hint}>
      {ids.length > 0 && (
        <div className="chips" role="group" aria-label="Aufgaben des Spielers">
          {ids.map((t) => (
            <button key={t} className={`chip task-chip ${isOn(t) ? 'selected' : ''}`} aria-pressed={isOn(t)} onClick={() => toggle(t)}>
              <Icon name={isOn(t) ? 'check' : TASK[t].icon} size={16} />
              {TASK[t].label}
            </button>
          ))}
        </div>
      )}
      {block && <p className="sb-hint">Schiebe ihn im Feld in die Schlagbahn – trifft der Ball seine Hände, prallt er ab.</p>}
    </Section>
  )
}

/* ---------- 2. Laufen ---------- */

function RunSection({ side, playerId, plan, timeMax }: { side: CourtSide; playerId: string; plan: PlayerPlan | undefined; timeMax: number }) {
  const setPath = usePlay((s) => s.setPath)
  const c = usePlay((s) => s.sides[side].players.find((q) => q.playerId === playerId))
  const drawing = useUi((s) => s.tool === 'laufweg')
  if (!c) return null
  const path = c.path && c.path.points.length > 0 ? c.path : null
  const own = !!path || drawing
  const autoRuns = !path && !!plan && plan.legs.length > 0

  const state = path
    ? `Eigener Weg: ${fmt(pathCurve(c, path).length, 1)} m, kommt nach ${fmt(pathEnd(c, path))} s an.`
    : drawing
      ? 'Ziehe im Feld vom Spieler aus seinen Weg.'
      : autoRuns
        ? `Läuft von selbst rechtzeitig zum Ball (ab ${fmt(plan!.legs[0].t0)} s).`
        : 'Bleibt auf seinem Platz.'

  return (
    <Section title="Laufen" icon="run" hint={<span className={drawing && !path ? 'sb-now' : undefined}>{state}</span>}>
      <Choice
        label="Laufweg"
        own={own}
        ownLabel="Eigener Weg"
        onAuto={() => {
          if (drawing) useUi.getState().setTool('select')
          if (path) setPath(side, playerId, null)
        }}
        onOwn={() => {
          if (!path && !drawing) togglePathDrawing()
        }}
      />
      {path && (
        <>
          <ValueSlider label="Startet nach" value={path.delay} min={0} max={timeMax} step={0.05} unit="s" onChange={(delay) => setPath(side, playerId, { ...path, delay })} />
          <ValueSlider label="Tempo" value={path.speed} min={RUN_SPEED.min} max={RUN_SPEED.max} step={0.1} unit="m/s" digits={1} onChange={(speed) => setPath(side, playerId, { ...path, speed })} />
        </>
      )}
      {(path || drawing) && (
        <button className={`small start ${drawing ? 'selected' : 'plain'}`} onClick={togglePathDrawing}>
          <Icon name={drawing ? 'close' : 'pencil'} size={16} />
          {drawing ? 'Zeichnen abbrechen' : 'Im Feld neu zeichnen'}
        </button>
      )}
    </Section>
  )
}

/* ---------- 3. Springen ---------- */

function JumpSection({ side, playerId, plan, timeMax }: { side: CourtSide; playerId: string; plan: PlayerPlan | undefined; timeMax: number }) {
  const setJump = usePlay((s) => s.setJump)
  const c = usePlay((s) => s.sides[side].players.find((q) => q.playerId === playerId))
  if (!c) return null
  const jump = c.jump
  const actions = plan?.actions ?? []
  // Wie im Bewegungsplan: Ein eigener Sprung koppelt sich an Block/Angriff/Antäuschen, sonst ans Zuspiel, sonst an den ersten Kontakt
  const anchor = actions.find((a) => a.kind === 'block' || a.kind === 'schlag' || a.kind === 'fake') ?? actions.find((a) => a.kind === 'zuspiel') ?? actions[0]
  const autoJumps = !jump && plan ? plan.jumps : []
  const synced = !!jump?.sync && !!anchor
  const set = (j: Jump | null) => setJump(side, playerId, j)

  const apexOf = (j: Jump) => j.at + jumpRise(j.height)
  const state = jump
    ? `Eigener Sprung: ${fmt(jump.height)} m hoch, am höchsten ${synced ? AT_ACTION[anchor!.kind].replace(/^B/, 'b') :`nach ${fmt(apexOf(jump))} s`}.`
    : autoJumps.length > 0
      ? `Springt von selbst ${autoJumps.map((j) => `${fmt(j.height)} m`).join(' und ')} hoch – so hoch, wie ${anchor?.kind === 'block' || anchor?.kind === 'fake' ? 'es seine Aufgabe' : 'der Ball es'} verlangt.`
      : 'Springt nicht.'

  return (
    <Section title="Springen" icon="jump" hint={state}>
      <Choice
        label="Sprung"
        own={!!jump}
        ownLabel="Eigener Sprung"
        onAuto={() => set(null)}
        onOwn={() => {
          const auto = autoJumps[0]
          set({
            at: auto ? round(auto.at) : 0.5,
            height: auto ? round(auto.height) : JUMP_HEIGHT.default,
            ...(anchor ? { sync: true } : {})
          })
        }}
      />
      {jump && (
        <>
          <ValueSlider
            label="Sprunghöhe"
            value={jump.height}
            min={JUMP_HEIGHT.min}
            max={JUMP_HEIGHT.max}
            step={0.01}
            unit="m"
            // Der höchste Punkt bleibt, wo er ist: Ein höherer Sprung beginnt früher
            onChange={(height) => set({ ...jump, height, at: round(apexOf(jump) - jumpRise(height), 1000) })}
          />
          {anchor && (
            <div className="field-col">
              <span className="field-label">Am höchsten</span>
              <div className="segmented small fill" role="radiogroup" aria-label="Zeitpunkt des Sprungs">
                <button role="radio" aria-checked={synced} className={synced ? 'selected' : ''} onClick={() => !synced && set({ ...jump, sync: true })}>
                  {AT_ACTION[anchor.kind]}
                </button>
                <button
                  role="radio"
                  aria-checked={!synced}
                  className={!synced ? 'selected' : ''}
                  // Beim Lösen bleibt der Sprung, wo er gerade ist
                  onClick={() => synced && set({ at: round(plan?.jumps[0]?.at ?? jump.at), height: jump.height })}
                >
                  Feste Zeit
                </button>
              </div>
            </div>
          )}
          {!synced && (
            <ValueSlider
              label="Am höchsten nach"
              value={apexOf(jump)}
              min={jumpRise(jump.height)}
              max={timeMax}
              step={0.02}
              unit="s"
              onChange={(apex) => set({ ...jump, at: round(apex - jumpRise(jump.height), 1000) })}
            />
          )}
        </>
      )}
    </Section>
  )
}

/* ---------- Bausteine ---------- */

/** Automatisch oder selbst festlegen – zwei Segmente */
function Choice({ label, own, ownLabel, onAuto, onOwn }: { label: string; own: boolean; ownLabel: string; onAuto: () => void; onOwn: () => void }) {
  return (
    <div className="segmented small fill" role="radiogroup" aria-label={label}>
      <button role="radio" aria-checked={!own} className={!own ? 'selected' : ''} onClick={onAuto}>
        Automatisch
      </button>
      <button role="radio" aria-checked={own} className={own ? 'selected' : ''} onClick={onOwn}>
        {ownLabel}
      </button>
    </div>
  )
}

/** „a“, „a und b“, „a, b und c“ */
function joinAnd(parts: string[]): string {
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} und ${parts[parts.length - 1]}`
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
