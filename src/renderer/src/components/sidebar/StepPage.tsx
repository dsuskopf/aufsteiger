import { BALL_TYPES, type BallType, type CourtSide } from '@shared/types'
import { usePlayback } from '@renderer/store/playbackStore'
import { formatTime } from '@renderer/core/timeline/timeline'
import { usePlay } from '@renderer/store/playStore'
import { useScene } from '@renderer/store/playbackStore'
import { useCourtPlayers } from '@renderer/store/selectors'
import { useUi } from '@renderer/store/settingsStore'
import { rewind } from '@renderer/store/actions'
import { Icon } from '../Icon'
import { SchlagEditor } from '../SchlagCard'
import { TrajectoryEditor } from '../TrajectoryCard'
import { PageHeader, PlayerPicker, STEP_EXPLAIN, STEP_LABELS, Section, sideOfStart, startDrawing } from './common'

const STEP_INDEX: Record<BallType, number> = { annahme: 1, zuspiel: 2, schlag: 3 }
const WHO_HINT: Record<BallType, string> = {
  annahme: 'Wer nimmt an? Der Ball startet dann vor ihm.',
  zuspiel: 'Wer stellt? Er läuft und springt von selbst zum Ball.',
  schlag: 'Wer schlägt? Er läuft an und springt so hoch, dass er den Ball trifft.'
}

/**
 * Detailseite eines Ballkontakts: wer spielt ihn, wie fliegt der Ball – beim Angriff außerdem,
 * wer auf der anderen Seite blockt und wer auf der eigenen Seite antäuscht.
 */
export function StepPage({ type }: { type: BallType }) {
  const scene = useScene()
  const players = useCourtPlayers()
  const contact = usePlay((s) => s.contacts[type])
  const tool = useUi((s) => s.tool)
  const seg = scene.timeline.segments.find((s) => s.type === type)
  const side = sideOfStart(type)
  // Der Libero darf nicht angreifen (Regel): beim Angriff nicht zur Wahl
  const own = players.filter((p) => p.side === side && !(type === 'schlag' && p.role === 'L'))
  const back = () => usePlay.getState().select(null)
  const remove = () => (type === 'schlag' ? usePlay.getState().removeSchlag() : usePlay.getState().removeTrajectory(type))

  return (
    <div className="panel-body sb-page">
      <PageHeader
        title={
          <>
            <span className="sb-step-nr">{STEP_INDEX[type]}</span>
            {STEP_LABELS[type]}
          </>
        }
        sub={seg ? `${STEP_EXPLAIN[type]} Ab ${formatTime(seg.t0)}.` : 'Findet nicht statt – der Ball ist vorher aus dem Spiel.'}
        onBack={back}
        trailing={
          <button className="icon-only plain" title={`${STEP_LABELS[type]} löschen (Entf)`} aria-label={`${STEP_LABELS[type]} löschen`} onClick={remove}>
            <Icon name="trash" />
          </button>
        }
      />

      <Section title="Wer spielt den Ball?" icon="person" hint={WHO_HINT[type]}>
        <PlayerPicker
          players={own}
          isOn={(p) => contact?.side === p.side && contact.playerId === p.playerId}
          onPick={(p) => {
            rewind()
            const on = contact?.side === p.side && contact.playerId === p.playerId
            usePlay.getState().setContact(type, on ? null : { side: p.side, playerId: p.playerId })
          }}
          none={{ label: 'Nur Ball', active: !contact, onPick: () => usePlay.getState().setContact(type, null) }}
        />
      </Section>

      <Section title={type === 'schlag' ? 'Schlag' : 'Flugbahn'} icon={type === 'schlag' ? 'spike' : 'arc'} hint={type === 'schlag' ? undefined : 'Höhen auch in der Netzansicht direkt an den Punkten ziehen.'}>
        {type === 'schlag' ? <SchlagEditor /> : <TrajectoryEditor type={type} />}
        <button className={`small ${tool === type ? 'selected' : 'plain'} start`} onClick={() => startDrawing(type)}>
          <Icon name="pencil" size={16} />
          {tool === type ? 'Zeichnen abbrechen' : 'Im Feld neu zeichnen'}
        </button>
      </Section>

      {type === 'schlag' && side && <BlockSection attacking={side} />}

      <StepNav type={type} />
    </div>
  )
}

/**
 * Unten auf jeder Schritt-Seite: direkt zum nächsten Schritt (oder ihn zeichnen), zurück zum vorigen –
 * ohne Umweg über die Übersicht. Nach dem Angriff geht es zur Übersicht mit dem Ergebnis.
 */
function StepNav({ type }: { type: BallType }) {
  const i = BALL_TYPES.indexOf(type)
  const prev = BALL_TYPES[i - 1]
  const next = BALL_TYPES[i + 1]
  const nextExists = usePlay((s) => (next ? (next === 'schlag' ? !!s.schlag : !!s.trajectories[next]) : false))
  const scene = useScene()
  const go = (t: BallType) => {
    usePlay.getState().select(t)
    const seg = scene.timeline.segments.find((s) => s.type === t)
    if (seg && !usePlayback.getState().playing) usePlayback.getState().setT(seg.t0)
  }
  return (
    <nav className="step-nav" aria-label="Schritte">
      {prev && (
        <button className="plain small" onClick={() => go(prev)} title={`Zurück zu ${STEP_LABELS[prev]}`}>
          <Icon name="chevronLeft" size={16} />
          {STEP_INDEX[prev]} · {STEP_LABELS[prev]}
        </button>
      )}
      {next ? (
        nextExists ? (
          <button className="prominent grow" onClick={() => go(next)}>
            Weiter: {STEP_INDEX[next]} · {STEP_LABELS[next]}
            <Icon name="chevronRight" size={18} />
          </button>
        ) : (
          <button
            className="prominent grow"
            onClick={() => {
              // Zurück zur Übersicht: dort steht beim nächsten Schritt, was im Feld zu tun ist
              usePlay.getState().select(null)
              startDrawing(next)
            }}
          >
            <Icon name="pencil" size={16} />
            Weiter: {STEP_LABELS[next]} zeichnen
          </button>
        )
      ) : (
        <button className="grow" onClick={() => usePlay.getState().select(null)}>
          Fertig – zum Ergebnis
          <Icon name="chevronRight" size={18} />
        </button>
      )}
    </nav>
  )
}

/** Beim Angriff: Block der anderen Seite und Antäuschen auf der eigenen Seite – jeweils per Antippen */
function BlockSection({ attacking }: { attacking: CourtSide }) {
  const players = useCourtPlayers()
  const scene = useScene()
  const contact = usePlay((s) => s.contacts.schlag)
  const defending: CourtSide = attacking === 'A' ? 'B' : 'A'
  const defenders = players.filter((p) => p.side === defending && p.role !== 'L')
  const mates = players.filter((p) => p.side === attacking && p.role !== 'L' && !(contact?.side === p.side && contact.playerId === p.playerId))
  const blocked = scene.deflection?.kind === 'block'
  const blockers = defenders.filter((p) => p.court.block)
  const toggle = (side: CourtSide, id: string, key: 'block' | 'fake', on: boolean) => {
    rewind()
    if (key === 'block') usePlay.getState().setBlock(side, id, on)
    else usePlay.getState().setFake(side, id, on)
  }
  return (
    <>
      <Section
        title={`Block (Seite ${defending})`}
        icon="block"
        hint="Wer springt am Netz hoch? Schieb die Blocker im Feld in die Bahn des Balls: Trifft er ihre Hände, prallt er ab."
      >
        <PlayerPicker players={defenders} isOn={(p) => !!p.court.block} onPick={(p) => toggle(p.side, p.playerId, 'block', !p.court.block)} empty="Auf der anderen Seite steht noch kein Team." />
        {blockers.length > 0 && (
          <p className={`sb-status ${blocked ? 'good' : 'warn'}`}>
            <Icon name={blocked ? 'check' : 'close'} size={14} />
            {blocked ? 'Der Ball prallt am Block ab.' : 'Der Ball kommt am Block vorbei.'}
          </p>
        )}
      </Section>
      <Section title="Schlag antäuschen" icon="spike" hint="Wer springt mit und schlägt ins Leere? Er springt, wenn ihm das Zuspiel am nächsten ist, und bindet so den Block.">
        <PlayerPicker players={mates} isOn={(p) => !!p.court.fake} onPick={(p) => toggle(p.side, p.playerId, 'fake', !p.court.fake)} />
      </Section>
    </>
  )
}
