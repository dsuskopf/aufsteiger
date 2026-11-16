import { BALL_TYPES, type BallType } from '@shared/types'
import { ballIn } from '@renderer/core/geometry/court'
import { SITUATION_LABELS } from '@renderer/core/lineup/rotation'
import { BALL_RADIUS } from '@renderer/core/physics/trajectory'
import { formatTime } from '@renderer/core/timeline/timeline'
import { usePlay } from '@renderer/store/playStore'
import { usePlayback, useScene, type Scene } from '@renderer/store/playbackStore'
import { useCourtPlayers, type CourtPlayerView } from '@renderer/store/selectors'
import { useUi } from '@renderer/store/settingsStore'
import { useTeams } from '@renderer/store/teamsStore'
import { rewind } from '@renderer/store/actions'
import { ConfirmButton } from '../ConfirmButton'
import { Icon, type IconName } from '../Icon'
import { Avatar } from '../LookPopover'
import { STEP_EXPLAIN, STEP_LABELS, playerLabel, startDrawing } from './common'

/** Was der Nutzer beim Zeichnen im Feld tun muss */
const DRAW_HINT: Record<BallType, { free: string; chained: string }> = {
  annahme: { free: 'Ziehe im Feld vom Annehmer zum Steller.', chained: 'Ziehe im Feld vom Annehmer zum Steller.' },
  zuspiel: { free: 'Ziehe im Feld vom Steller zum Angreifer.', chained: 'Tippe im Feld dorthin, wo der Angreifer den Ball trifft.' },
  schlag: { free: 'Ziehe im Feld vom Schlagpunkt zum Ziel.', chained: 'Tippe im Feld dorthin, wo der Ball landen soll.' }
}

/**
 * Übersicht: der Spielzug als Geschichte von oben nach unten – 0 Aufstellung, 1 Annahme, 2 Zuspiel, 3 Angriff,
 * dann das Ergebnis. Es gibt immer genau einen hervorgehobenen nächsten Schritt. Antippen öffnet die Detailseite.
 */
export function Overview() {
  const scene = useScene()
  const players = useCourtPlayers()
  const hasAnnahme = usePlay((s) => !!s.trajectories.annahme)
  const hasZuspiel = usePlay((s) => !!s.trajectories.zuspiel)
  const hasSchlag = usePlay((s) => !!s.schlag)
  const hasExtra = usePlay((s) => [...s.sides.A.players, ...s.sides.B.players].some((c) => c.path || c.jump || c.block || c.fake))
  const ex = { annahme: hasAnnahme, zuspiel: hasZuspiel, schlag: hasSchlag }
  const next = BALL_TYPES.find((t) => !ex[t]) ?? null
  const empty = !ex.annahme && !ex.zuspiel && !ex.schlag
  const anything = !empty || hasExtra

  return (
    <div className="panel-body sb-overview">
      <ol className="story" aria-label="Ablauf des Spielzugs">
        <LineupStep />
        {BALL_TYPES.map((type, i) => (
          <BallStep key={type} type={type} index={i + 1} exists={ex[type]} isNext={type === next} scene={scene} players={players} />
        ))}
        <ResultStep scene={scene} players={players} />
      </ol>

      <MovesCard players={players} />

      {empty && <HowTo />}

      {anything && (
        <div className="sb-footer">
          <ConfirmButton
            label="Spielzug leeren"
            confirmLabel="Alle Ballwege und Bewegungen löschen?"
            icon="trash"
            text
            onConfirm={() => {
              rewind()
              usePlay.getState().clearTrajectories()
              usePlay.getState().clearMoves()
            }}
          />
        </div>
      )}
    </div>
  )
}

/** Schritt 0: wer gegen wen, Rotation, Netz – öffnet die Aufstellung */
function LineupStep() {
  const sides = usePlay((s) => s.sides)
  const teams = useTeams((s) => s.teams)
  const netHeight = useUi((s) => s.netHeight)
  const a = teams.find((t) => t.id === sides.A.teamId)
  const b = teams.find((t) => t.id === sides.B.teamId)
  const l = sides.A.laeufer
  return (
    <li className="story-step done">
      <span className="story-dot">0</span>
      <button className="story-card" onClick={() => useUi.getState().showSidebar('lineup')}>
        <span className="story-text">
          <span className="story-title">Aufstellung</span>
          <span className="story-teams">
            <TeamTag name={a?.name} color={a?.color} />
            <span className="secondary">gegen</span>
            <TeamTag name={b?.name} color={b?.color} missing="Kein Gegner" />
          </span>
          <span className="story-sub">
            {l ? `Läufer ${l.n} · ${SITUATION_LABELS[l.situation]} · ` : ''}Netz {netHeight.toFixed(2).replace('.', ',')} m
          </span>
        </span>
        <Icon name="chevronRight" size={18} />
      </button>
    </li>
  )
}

function TeamTag({ name, color, missing = 'Kein Team' }: { name?: string; color?: string; missing?: string }) {
  if (!name && !color) return <span className="team-tag missing">{missing}</span>
  return (
    <span className="team-tag">
      <span className="chip-dot" style={{ background: color, borderColor: 'var(--swatch-ring)' }} />
      {name || 'Ohne Namen'}
    </span>
  )
}

/** Ein Ballkontakt in der Geschichte: gezeichnet (Zusammenfassung), als Nächstes dran (Aufforderung) oder später */
function BallStep({ type, index, exists, isNext, scene, players }: { type: BallType; index: number; exists: boolean; isNext: boolean; scene: Scene; players: CourtPlayerView[] }) {
  const tool = useUi((s) => s.tool)
  const contact = usePlay((s) => s.contacts[type])
  const chained = usePlay((s) => (type === 'zuspiel' ? !!s.trajectories.annahme : type === 'schlag' ? !!s.trajectories.zuspiel : false))
  const backset = usePlay((s) => type === 'zuspiel' && !!s.trajectories.zuspiel?.backset)
  const drawing = tool === type
  const seg = scene.timeline.segments.find((s) => s.type === type)
  const by = contact ? players.find((p) => p.side === contact.side && p.playerId === contact.playerId) : undefined
  const event = scene.events.find((e) => e.kind === type)

  if (!exists) {
    return (
      <li className={`story-step ${isNext ? 'next' : 'later'} ${drawing ? 'drawing' : ''}`}>
        <span className="story-dot">{index}</span>
        <div className="story-card static">
          <span className="story-text">
            <span className="story-title">{STEP_LABELS[type]}</span>
            <span className="story-sub">{drawing ? (chained ? DRAW_HINT[type].chained : DRAW_HINT[type].free) : isNext ? STEP_EXPLAIN[type] : 'Kommt danach'}</span>
          </span>
          {(isNext || drawing) && (
            <button className={drawing ? 'small' : 'small prominent'} onClick={() => startDrawing(type)}>
              <Icon name={drawing ? 'close' : 'pencil'} size={16} />
              {drawing ? 'Abbrechen' : 'Zeichnen'}
            </button>
          )}
          {!isNext && !drawing && (
            <button className="small plain" onClick={() => startDrawing(type)} title={`${STEP_LABELS[type]} schon jetzt zeichnen`}>
              Zeichnen
            </button>
          )}
        </div>
      </li>
    )
  }

  // Beim Angriff: wer blockt, wer täuscht an
  const blockers = type === 'schlag' ? players.filter((p) => p.court.block) : []
  const fakers = type === 'schlag' ? players.filter((p) => p.court.fake) : []
  return (
    <li className={`story-step done ${seg ? '' : 'gone'}`}>
      <span className="story-dot">{index}</span>
      <button
        className="story-card"
        onClick={() => {
          usePlay.getState().select(type)
          if (seg && !usePlayback.getState().playing) usePlayback.getState().setT(seg.t0)
        }}
      >
        {by ? <Avatar look={by.look} jersey={by.jersey.fill} size={34} /> : <span className="story-ball"><Icon name="ball" size={18} /></span>}
        <span className="story-text">
          <span className="story-title">
            {STEP_LABELS[type]}
            {type === 'schlag' && event?.finte && <span className="tag">Finte</span>}
            {type === 'zuspiel' && backset && <span className="tag">Backset</span>}
          </span>
          <span className="story-sub">
            {by ? playerLabel(by) : 'Niemand gekoppelt'}
            {seg ? ` · ${formatTime(seg.t0)}` : ' · findet nicht statt'}
            {type === 'schlag' && event && !event.finte ? ` · ${Math.round(event.speed * 3.6)} km/h` : ''}
          </span>
          {(blockers.length > 0 || fakers.length > 0) && (
            <span className="story-extra">
              {blockers.length > 0 && <span>Block {blockers.map((p) => `#${p.number}`).join(', ')}</span>}
              {fakers.length > 0 && <span>Täuscht an {fakers.map((p) => `#${p.number}`).join(', ')}</span>}
            </span>
          )}
        </span>
        <Icon name="chevronRight" size={18} />
      </button>
    </li>
  )
}

/** Ende der Geschichte: wie der Ballwechsel ausgeht */
function ResultStep({ scene, players }: { scene: Scene; players: CourtPlayerView[] }) {
  const result = outcome(scene, players)
  if (!result) return null
  return (
    <li className={`story-step result ${result.tone}`}>
      <span className="story-dot">
        <Icon name={result.icon} size={14} />
      </span>
      <button
        className="story-card"
        title="Zu diesem Moment springen"
        onClick={() => {
          usePlayback.getState().pause()
          usePlayback.getState().setT(result.t)
        }}
      >
        <span className="story-text">
          <span className="story-title">{result.title}</span>
          <span className="story-sub">
            {result.sub} · {formatTime(result.t)}
          </span>
        </span>
      </button>
    </li>
  )
}

function outcome(scene: Scene, players: CourtPlayerView[]): { icon: IconName; title: string; sub: string; t: number; tone: 'good' | 'bad' | 'neutral' } | null {
  if (!scene.timeline.segments.some((s) => s.type === 'schlag') && !scene.deflection) return null
  const ev = (k: string) => scene.events.find((e) => e.kind === k)
  const ant = ev('antenne')
  if (ant) return { icon: 'net', title: 'Fehler: Antenne berührt', sub: 'Der Ball ist aus', t: ant.t, tone: 'bad' }
  const net = ev('netz')
  if (net) return { icon: 'net', title: 'Ball im Netz', sub: 'Er fällt auf der eigenen Seite herunter', t: net.t, tone: 'bad' }
  const floor = ev('boden')
  const block = ev('block')
  const by = block ? players.find((p) => p.key === block.by) : undefined
  const inCourt = floor ? ballIn(floor.x, floor.y, BALL_RADIUS) : false
  const side = floor ? (floor.x < 0 ? 'A' : 'B') : ''
  if (block) {
    const sub = floor ? (inCourt ? `Landet im Feld ${side}` : `Landet im Aus`) : 'Prallt ab'
    return { icon: 'block', title: `Geblockt${by ? ` von #${by.number}` : ''}`, sub, t: block.t, tone: 'neutral' }
  }
  const roll = ev('netzkante')
  if (floor) return { icon: 'ball', title: inCourt ? `Punkt: Ball im Feld ${side}` : 'Ball im Aus', sub: roll ? 'Nach einem Netzroller' : `Aufprall mit ${Math.round(floor.speed * 3.6)} km/h`, t: floor.t, tone: inCourt ? 'good' : 'bad' }
  return null
}

/** Bewegungen ohne Ball: wer läuft, springt, blockt, täuscht an – oder der Hinweis, wie man das einstellt */
function MovesCard({ players }: { players: CourtPlayerView[] }) {
  const movers = players.filter((p) => p.court.path || p.court.jump || p.court.block || p.court.fake)
  return (
    <section className="sb-card">
      <h3 className="sb-section-title">
        <Icon name="person" size={16} />
        Spieler
      </h3>
      {movers.length === 0 ? (
        <p className="sb-hint">Tippe im Feld einen Spieler an: Dort stellst du ein, ob er läuft, springt, blockt oder einen Schlag antäuscht.</p>
      ) : (
        <ul className="mover-list">
          {movers.map((p) => (
            <li key={p.key}>
              <button className="mover" onClick={() => usePlay.getState().selectPlayer({ side: p.side, playerId: p.playerId })}>
                <Avatar look={p.look} jersey={p.jersey.fill} size={28} />
                <span className="grow">
                  {playerLabel(p)}
                  <span className="story-sub">{[p.court.path && 'läuft', p.court.jump && 'springt', p.court.block && 'blockt', p.court.fake && 'täuscht an'].filter(Boolean).join(' · ')}</span>
                </span>
                <Icon name="chevronRight" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Für den Anfang: in drei Sätzen, wie die App funktioniert */
function HowTo() {
  return (
    <section className="sb-card howto">
      <h3 className="sb-section-title">
        <Icon name="play" size={16} />
        So geht’s
      </h3>
      <ol>
        <li>
          <b>Ballwege zeichnen:</b> oben mit „Zeichnen“ starten, dann im Feld ziehen.
        </li>
        <li>
          <b>Spieler einstellen:</b> im Feld antippen – laufen, springen, blocken.
        </li>
        <li>
          <b>Abspielen:</b> unten auf ▶ oder die Leertaste – am schönsten in 3D.
        </li>
        <li>
          <b>Nur schnell etwas aufmalen?</b> Oben auf „Skizze“: Stift nehmen und loszeichnen.
        </li>
      </ol>
    </section>
  )
}
