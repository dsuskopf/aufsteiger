import { useUi, type SidebarTab } from '@renderer/store/settingsStore'
import { LineupTab } from './LineupPanel'
import { PlayPanel } from './PlayPanel'

const TABS: { id: SidebarTab; label: string; title: string }[] = [
  { id: 'play', label: 'Spielzug', title: 'Ablauf: Annahme, Zuspiel, Schlag – und was die Spieler tun' },
  { id: 'lineup', label: 'Aufstellung', title: 'Teams, Rotation und wer auf dem Feld steht' }
]

/**
 * Seitenleiste links: alles, was man am Spielzug einstellt, an einem Ort (statt schwebender Karten über dem Feld).
 * Ausblendbar über den Button in der Toolbar – dann gehört die ganze Fläche dem Feld.
 */
export function Sidebar({ onManageTeams }: { onManageTeams: () => void }) {
  const tab = useUi((s) => s.sidebarTab)
  const showSidebar = useUi((s) => s.showSidebar)
  return (
    <aside className="sidebar" aria-label="Spielzug bearbeiten">
      <div className="segmented fill sidebar-tabs" role="tablist" aria-label="Bereich">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'selected' : ''} title={t.title} onClick={() => showSidebar(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'play' ? <PlayPanel /> : <LineupTab onManageTeams={onManageTeams} />}
    </aside>
  )
}
