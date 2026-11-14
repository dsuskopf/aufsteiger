import type { NetPresetId } from '@shared/types'
import { ROLE_LABELS } from '@shared/types'
import { NET_HEIGHT_MAX, NET_HEIGHT_MIN, NET_PRESETS } from '@renderer/core/geometry/court'
import { usePlay } from '@renderer/store/playStore'
import { useCourtPlayers } from '@renderer/store/selectors'
import { useUi } from '@renderer/store/settingsStore'
import { Avatar } from '../LookPopover'
import { LineupTab } from '../LineupPanel'
import { NumberField } from '../NumberField'
import { PlayerEditor } from '../PlayerCard'
import { Overview } from './Overview'
import { StepPage } from './StepPage'
import { PageHeader, Section, playerLabel } from './common'

/**
 * Seitenleiste als Navigation in Ebenen (wie die Einstellungen am iPhone):
 * Übersicht (der Spielzug als Geschichte) → Detailseite des Gewählten, mit „‹ Spielzug“ zurück.
 * Was gezeigt wird, folgt der Auswahl: Spieler im Feld → Spielerseite, Ballweg → Schrittseite,
 * sonst Übersicht oder Aufstellung.
 */
export function Sidebar({ onManageTeams }: { onManageTeams: () => void }) {
  const selected = usePlay((s) => s.selected)
  const selectedPlayer = usePlay((s) => s.selectedPlayer)
  const page = useUi((s) => s.sidebarPage)
  const key = selectedPlayer ? `p:${selectedPlayer.side}:${selectedPlayer.playerId}` : selected ? `s:${selected}` : page
  return (
    <aside className="sidebar" aria-label="Spielzug bearbeiten">
      {/* Neuer Schlüssel = neue Seite (startet oben, gleitet herein) */}
      <div className="sb-stack" key={key}>
        {selectedPlayer ? (
          <PlayerPage side={selectedPlayer.side} playerId={selectedPlayer.playerId} />
        ) : selected ? (
          <StepPage type={selected} />
        ) : page === 'lineup' ? (
          <LineupPage onManageTeams={onManageTeams} />
        ) : (
          <Overview />
        )}
      </div>
    </aside>
  )
}

function PlayerPage({ side, playerId }: { side: 'A' | 'B'; playerId: string }) {
  const players = useCourtPlayers()
  const p = players.find((q) => q.side === side && q.playerId === playerId)
  const back = () => usePlay.getState().selectPlayer(null)
  if (!p) return null
  return (
    <div className="panel-body sb-page">
      <PageHeader
        title={playerLabel(p)}
        sub={`${ROLE_LABELS[p.role]} · Seite ${p.side}${p.court.slot ? ` · Position ${p.court.slot}` : ''}`}
        onBack={back}
        trailing={<Avatar look={p.look} jersey={p.jersey.fill} size={48} />}
      />
      <PlayerEditor side={side} playerId={playerId} />
    </div>
  )
}

function LineupPage({ onManageTeams }: { onManageTeams: () => void }) {
  return (
    <div className="panel-body sb-page">
      <PageHeader
        title={
          <>
            <span className="sb-step-nr">0</span>Aufstellung
          </>
        }
        sub="Wer spielt gegen wen, in welcher Rotation – und wie hoch ist das Netz."
        onBack={() => useUi.getState().showSidebar('overview')}
      />
      <LineupTab onManageTeams={onManageTeams} />
      <NetSection />
    </div>
  )
}

const fmt = (v: number) => v.toFixed(2).replace('.', ',')

/** Netzhöhe des Spielzugs: Vorgabe wählen oder frei einstellen */
function NetSection() {
  const { netPreset, setNetPreset, netHeight, setNetHeight } = useUi()
  return (
    <Section title="Netz" icon="net" hint="Herren, Damen, Mixed – oder frei einstellen.">
      <div className="row">
        <div className="segmented small fill grow" role="radiogroup" aria-label="Netzhöhe Vorgabe">
          {(Object.entries(NET_PRESETS) as [Exclude<NetPresetId, 'custom'>, { label: string; height: number }][]).map(([id, p]) => (
            <button key={id} role="radio" aria-checked={netPreset === id} className={netPreset === id ? 'selected' : ''} title={`${fmt(p.height)} m`} onClick={() => setNetPreset(id)}>
              {p.label}
            </button>
          ))}
        </div>
        <NumberField label="Netzhöhe" value={netHeight} min={NET_HEIGHT_MIN} max={NET_HEIGHT_MAX} unit="m" onCommit={setNetHeight} />
      </div>
      <input type="range" className="wide" aria-label="Netzhöhe" min={NET_HEIGHT_MIN} max={NET_HEIGHT_MAX} step={0.01} value={netHeight} onChange={(e) => setNetHeight(Number(e.target.value))} />
    </Section>
  )
}
