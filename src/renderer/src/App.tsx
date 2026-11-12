import { Toolbar } from './components/Toolbar'
import { TopView } from './views/top/TopView'
import { SideView } from './views/side/SideView'
import { ThreeView } from './views/three/ThreeView'
import { useEffect } from 'react'
import { useUi } from './store/settingsStore'
import { useTeams } from './store/teamsStore'
import { usePlay } from './store/playStore'
import { LineupPanel } from './components/LineupPanel'
import { TeamManager } from './components/TeamManager'

export function App() {
  const viewMode = useUi((s) => s.viewMode)
  const { lineupOpen, teamsOpen, setLineupOpen, setTeamsOpen } = useUi()

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

  const showTop = viewMode === 'split' || viewMode === 'top'
  const showSide = viewMode === 'split' || viewMode === 'side'
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
        {showSide && (
          <section className="pane">
            <div className="pane-title">Seitenansicht</div>
            <SideView />
          </section>
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
