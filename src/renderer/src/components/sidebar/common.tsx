import type { ReactNode } from 'react'
import { BALL_LABELS, ROLE_LABELS, type BallType, type CourtSide } from '@shared/types'
import type { CourtPlayerView } from '@renderer/store/selectors'
import { usePlay } from '@renderer/store/playStore'
import { useUi } from '@renderer/store/settingsStore'
import { rewind } from '@renderer/store/actions'
import { Avatar } from '../LookPopover'
import { Icon, type IconName } from '../Icon'

/** Namen der Schritte in der Seitenleiste: aus Sicht des Spiels („Angriff“ statt „Schlag“) */
export const STEP_LABELS: Record<BallType, string> = { annahme: 'Annahme', zuspiel: 'Zuspiel', schlag: 'Angriff' }
/** Was in diesem Schritt passiert – ein Satz für Einsteiger */
export const STEP_EXPLAIN: Record<BallType, string> = {
  annahme: 'Der Ball kommt über das Netz und wird zum Steller gespielt.',
  zuspiel: 'Der Steller spielt den Ball hoch zum Angreifer.',
  schlag: 'Der Angreifer schlägt den Ball über das Netz.'
}
export { BALL_LABELS }

export const playerLabel = (p: CourtPlayerView) => `#${p.number} ${p.name || ROLE_LABELS[p.role]}`

/** Ballweg im Feld zeichnen (in der Draufsicht); nochmal antippen bricht ab */
export function startDrawing(type: BallType) {
  rewind()
  const ui = useUi.getState()
  if (ui.tool === type) return ui.setTool('select')
  if (ui.viewMode !== '2d') ui.setViewMode('2d')
  if (ui.main2D !== 'top') ui.swapMain2D()
  ui.setTool(type)
}

/** Kopf einer Detailseite: zurück zur Übersicht, Titel, rechts eine Aktion */
export function PageHeader({ title, sub, onBack, backLabel = 'Spielzug', trailing }: { title: ReactNode; sub?: ReactNode; onBack: () => void; backLabel?: string; trailing?: ReactNode }) {
  return (
    <header className="sb-page-head">
      <button className="plain sb-back" onClick={onBack} title="Zurück (Esc)">
        <Icon name="chevronLeft" size={18} />
        {backLabel}
      </button>
      <div className="sb-title-row">
        <div className="grow">
          <h2>{title}</h2>
          {sub && <p className="sb-sub">{sub}</p>}
        </div>
        {trailing}
      </div>
    </header>
  )
}

/** Abschnitt einer Seite: Überschrift, ein erklärender Satz, Inhalt */
export function Section({ title, hint, children, icon }: { title: string; hint?: ReactNode; children?: ReactNode; icon?: IconName }) {
  return (
    <section className="sb-section">
      <h3 className="sb-section-title">
        {icon && <Icon name={icon} size={16} />}
        {title}
      </h3>
      {hint && <p className="sb-hint">{hint}</p>}
      {children}
    </section>
  )
}

/**
 * Spieler zum Antippen, als Gesichter mit Rückennummer und Position (statt einer Klappliste).
 * isOn: ob der Spieler gewählt ist; none: zusätzlicher Knopf „Niemand“.
 */
export function PlayerPicker({
  players,
  isOn,
  onPick,
  none,
  empty = 'Auf dieser Seite steht noch kein Team.'
}: {
  players: CourtPlayerView[]
  isOn: (p: CourtPlayerView) => boolean
  onPick: (p: CourtPlayerView) => void
  none?: { label: string; active: boolean; onPick: () => void }
  empty?: string
}) {
  if (players.length === 0) return <p className="sb-hint">{empty}</p>
  return (
    <div className="picker" role="group">
      {players.map((p) => {
        const on = isOn(p)
        return (
          <button key={p.key} className={`pick ${on ? 'on' : ''}`} aria-pressed={on} title={`${playerLabel(p)} – ${ROLE_LABELS[p.role]}`} onClick={() => onPick(p)}>
            <Avatar look={p.look} jersey={p.jersey.fill} size={36} />
            <span className="pick-nr">#{p.number}</span>
            <span className="pick-role">{p.role}</span>
            {on && (
              <span className="pick-check" aria-hidden="true">
                <Icon name="check" size={12} />
              </span>
            )}
          </button>
        )
      })}
      {none && (
        <button className={`pick none ${none.active ? 'on' : ''}`} aria-pressed={none.active} onClick={none.onPick}>
          <span className="pick-none-icon">
            <Icon name="ball" size={20} />
          </span>
          <span className="pick-nr">{none.label}</span>
        </button>
      )}
    </div>
  )
}

/** Seite, auf der ein Ballweg startet (dort steht, wer ihn spielt) */
export function sideOfStart(type: BallType): CourtSide | null {
  const s = usePlay.getState()
  const f = type === 'schlag' ? s.schlag : s.trajectories[type]
  if (!f) return null
  return f.start.x <= 0 ? 'A' : 'B'
}
