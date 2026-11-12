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

  const is2d = viewMode === '2d'
  const show3d = viewMode === '3d'
  const main2D = useUi((s) => s.main2D)
  const netTitle = `Netz · Blick von ${netViewFrom}`
  const pipTitle = main2D === 'top' ? netTitle : 'Draufsicht'

  return (
    <div className="app">
      <Toolbar />
      <main className="views">
        {is2d && (
          // Große 2D-Ansicht
          <section className="pane" aria-label={main2D === 'top' ? 'Draufsicht' : 'Netzansicht'}>
            <div className="pane-title">{main2D === 'top' ? 'Draufsicht' : netTitle}</div>
            {main2D === 'top' ? <TopView /> : <NetView />}
          </section>
        )}
        {is2d && !netPipCollapsed && (
          // Die andere 2D-Ansicht als verschiebbares, vergrößerbares Pop-up (Overlay)
          <PipWindow title={pipTitle}>{main2D === 'top' ? <NetView compact /> : <TopView compact />}</PipWindow>
        )}
        {is2d && netPipCollapsed && (
          <button className="pip-chip" onClick={() => setNetPipCollapsed(false)} aria-label={`${pipTitle} einblenden`}>
            <Icon name={main2D === 'top' ? 'net' : 'formation'} />
            {main2D === 'top' ? 'Netz' : 'Draufsicht'}
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
