import { Toolbar } from './components/Toolbar'
import { TopView } from './views/top/TopView'
import { NetView } from './views/net/NetView'
import { Icon } from './components/Icon'
import { PipWindow } from './components/PipWindow'
import { ThreeView } from './views/three/ThreeView'
import { useEffect } from 'react'
import { useUi } from './store/settingsStore'
import { useTeams } from './store/teamsStore'
import { usePlay } from './store/playStore'
import { LineupPanel } from './components/LineupPanel'
import { TeamManager } from './components/TeamManager'

export function App() {
  const viewMode = useUi((s) => s.viewMode)
  const { lineupOpen, teamsOpen, setLineupOpen, setTeamsOpen, netViewFrom, netPipCollapsed, setNetPipCollapsed } = useUi()

  // Teams laden; beim Start Seite A mit dem ersten Team belegen, damit gleich Spieler zu sehen sind
  useEffect(() => {
    void useTeams
      .getState()
      .load()
      .then(() => {
        const first = useTeams.getState().teams[0]
        if (first && usePlay.getState().sides.A.teamId === null) usePlay.getState().setTeam('A', first.id)
      })
  }, [])

  const split = viewMode === 'split'
  const showTop = split || viewMode === 'top'
  const showNet = (split && !netPipCollapsed) || viewMode === 'net'
  const show3d = viewMode === '3d'

  return (
    <div className="app">
      <Toolbar />
      <main className="views">
        {showTop && (
          <section className="pane">
            <div className="pane-title">Draufsicht</div>
            <TopView />
          </section>
        )}
        {showNet &&
          (split ? (
            // In „Beide“ als verschiebbares, vergrößerbares Bild-im-Bild über der Draufsicht
            <PipWindow title={`Netz · Blick von ${netViewFrom}`}>
              <NetView compact />
            </PipWindow>
          ) : (
            <section className="pane" aria-label="Netzansicht">
              <div className="pane-title">Netz · Blick von {netViewFrom}</div>
              <NetView />
            </section>
          ))}
        {split && netPipCollapsed && (
          <button className="pip-chip" onClick={() => setNetPipCollapsed(false)} aria-label="Netzansicht einblenden">
            <Icon name="net" />
            Netz
          </button>
        )}
        {show3d && (
          <section className="pane">
            <div className="pane-title">3D</div>
            <div className="pane-hint">Ziehen dreht · Zwei Finger zoomen und verschieben</div>
            <ThreeView />
          </section>
        )}
        {lineupOpen && (
          <LineupPanel onClose={() => setLineupOpen(false)} onManageTeams={() => setTeamsOpen(true)} />
        )}
      </main>
      {teamsOpen && (
        <TeamManager
          onClose={() => {
            useTeams.getState().flush()
            setTeamsOpen(false)
          }}
        />
      )}
    </div>
  )
}
