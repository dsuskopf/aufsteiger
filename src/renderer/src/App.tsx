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
import { TrajectoryCard } from './components/TrajectoryCard'
import { Playbar } from './components/Playbar'
import { SettingsDialog } from './components/SettingsDialog'
import { useSettings } from './store/appSettings'
import { usePlayback } from './store/playbackStore'
import { SaveDialog } from './components/SaveDialog'
import { Library } from './components/Library'
import { ExportDialog } from './components/ExportDialog'
import './store/playDocs'

const HINTS = {
  annahme: 'Annahme: Klick Start, Klick Ende – oder in einem Zug ziehen · Esc bricht ab',
  zuspiel: 'Zuspiel: Klick Start, Klick Ende – oder ziehen · Esc bricht ab',
  zuspielCoupled: 'Zuspiel startet am Schlagpunkt der Annahme: Ziel antippen oder hinziehen · Esc bricht ab'
}

export function App() {
  const viewMode = useUi((s) => s.viewMode)
  const { lineupOpen, teamsOpen, setLineupOpen, setTeamsOpen, netViewFrom, netPipCollapsed, setNetPipCollapsed } = useUi()

  const { settingsOpen, setSettingsOpen, tool, dialog, setDialog } = useUi()
  const hasAnnahme = usePlay((s) => !!s.trajectories.annahme)

  // Einstellungen laden und als Startwerte übernehmen (Netzhöhe, Schleife, Tempo)
  useEffect(() => {
    void useSettings
      .getState()
      .load()
      .then((st) => {
        useUi.getState().setNetHeight(st.netHeight)
        usePlayback.setState({ loop: st.defaultLoop, speed: st.defaultSpeed })
        usePlay.setState({ dirty: false })
      })
  }, [])

  // Tastatur: Leertaste spielt ab/pausiert (nicht in Eingabefeldern)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' && (e.target as HTMLInputElement).type !== 'range') return
      if (tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === ' ' && !e.repeat && !useUi.getState().teamsOpen && !useUi.getState().dialog) {
        e.preventDefault()
        usePlayback.getState().toggle()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        useUi.getState().setDialog('save')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Teams laden; beim Start Seite A mit dem ersten Team belegen, damit gleich Spieler zu sehen sind
  useEffect(() => {
    void useTeams
      .getState()
      .load()
      .then(() => {
        const first = useTeams.getState().teams[0]
        if (first && usePlay.getState().sides.A.teamId === null) usePlay.getState().setTeam('A', first.id)
        usePlay.setState({ dirty: false })
      })
  }, [])

  const is2d = viewMode === '2d'
  const show3d = viewMode === '3d'
  const main2D = useUi((s) => s.main2D)
  const netAngle = useUi((s) => s.netAngle)
  const netTitle = `Netz · Blick von ${netViewFrom}${netAngle ? ` · ${netAngle > 0 ? '+' : ''}${netAngle}°` : ''}`
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
        {is2d && tool !== 'select' && (
          <div className="draw-hint" role="status">
            {tool === 'annahme' ? HINTS.annahme : hasAnnahme ? HINTS.zuspielCoupled : HINTS.zuspiel}
          </div>
        )}
        <TrajectoryCard />
        {lineupOpen && (
          <LineupPanel onClose={() => setLineupOpen(false)} onManageTeams={() => setTeamsOpen(true)} />
        )}
      </main>
      <Playbar />
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {dialog === 'save' && <SaveDialog onClose={() => setDialog(null)} />}
      {dialog === 'library' && <Library onClose={() => setDialog(null)} />}
      {dialog === 'export' && <ExportDialog onClose={() => setDialog(null)} />}
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
