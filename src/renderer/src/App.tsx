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
import { TeamManager } from './components/TeamManager'
import { Playbar } from './components/Playbar'
import { SettingsDialog } from './components/SettingsDialog'
import { useSettings } from './store/appSettings'
import { onBallEvent, usePlayback } from './store/playbackStore'
import { SaveDialog } from './components/SaveDialog'
import { Library } from './components/Library'
import { ExportDialog } from './components/ExportDialog'
import { Sidebar } from './components/sidebar/Sidebar'
import { QuickTeamChip } from './components/QuickTeam'
import { useSelectionKeys } from './components/sidebar/keys'
import { quickSave } from './store/actions'
import { playSfx } from './audio/sfx'
import { hardness } from './views/three/effects'
import './store/playDocs'

const HINTS = {
  annahme: 'Annahme: Start antippen, dann Ziel – oder in einem Zug ziehen · Esc bricht ab',
  zuspiel: 'Zuspiel: Start antippen, dann Ziel – oder ziehen · Esc bricht ab',
  zuspielCoupled: 'Zuspiel startet am Ende der Annahme: Ziel antippen oder hinziehen · Esc bricht ab',
  laufweg: 'Laufweg: auf einem Spieler aufsetzen und den Weg ziehen – Kurven erlaubt · Esc bricht ab',
  schlag: 'Schlag: Start antippen, dann Ziel – oder ziehen · Esc bricht ab',
  schlagCoupled: 'Schlag startet am Schlagpunkt des Zuspiels: Ziel antippen oder hinziehen · Esc bricht ab'
}

export function App() {
  const viewMode = useUi((s) => s.viewMode)
  const { teamsOpen, setTeamsOpen, netViewFrom, netPipCollapsed, setNetPipCollapsed, sidebarOpen } = useUi()

  const { settingsOpen, setSettingsOpen, tool, dialog, setDialog } = useUi()
  const hasAnnahme = usePlay((s) => !!s.trajectories.annahme)
  const hasZuspiel = usePlay((s) => !!s.trajectories.zuspiel)
  useSelectionKeys()

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

  // Tastatur: Leertaste spielt ab/pausiert (nicht in Eingabefeldern), Strg+S speichert
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!useUi.getState().dialog) void quickSave().catch(() => {})
        return
      }
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' && (e.target as HTMLInputElement).type !== 'range') return
      if (tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === ' ' && !e.repeat && !useUi.getState().teamsOpen && !useUi.getState().dialog) {
        e.preventDefault()
        usePlayback.getState().toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Geräusche: jeder Ballkontakt, den die Wiedergabe überschreitet
  useEffect(
    () =>
      onBallEvent((e, speed) => {
        const st = useSettings.getState().settings
        // Finte klingt wie ein weiches Pritschen
        if (st.sound) playSfx(e.finte ? 'zuspiel' : e.kind, hardness(e), st.soundVolume / 100, speed)
      }),
    []
  )

  // Etwas im Feld wählen öffnet seine Detailseite – auch wenn die Seitenleiste ausgeblendet war
  useEffect(
    () =>
      usePlay.subscribe((s, prev) => {
        const picked = (s.selected && s.selected !== prev.selected) || (s.selectedPlayer && s.selectedPlayer !== prev.selectedPlayer)
        if (picked && !useUi.getState().sidebarOpen) useUi.setState({ sidebarOpen: true })
      }),
    []
  )

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
      <div className="workspace">
        {sidebarOpen && <Sidebar onManageTeams={() => setTeamsOpen(true)} />}
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
              <div className="pane-hint">
                Ziehen dreht · <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd> bewegen · <kbd>Q</kbd>
                <kbd>E</kbd> drehen · <kbd>R</kbd>
                <kbd>F</kbd> zoomen · <kbd>T</kbd>
                <kbd>G</kbd> kippen · <kbd>1</kbd>–<kbd>6</kbd> Blickwinkel
              </div>
              <ThreeView />
            </section>
          )}
          {tool === 'select' && <QuickTeamChip />}
          {is2d && tool !== 'select' && (
            <div className="draw-hint" role="status">
              {tool === 'laufweg'
                ? HINTS.laufweg
                : tool === 'schlag'
                  ? hasZuspiel
                    ? HINTS.schlagCoupled
                    : HINTS.schlag
                  : tool === 'annahme'
                    ? HINTS.annahme
                    : hasAnnahme
                      ? HINTS.zuspielCoupled
                      : HINTS.zuspiel}
            </div>
          )}
        </main>
      </div>
      <Playbar />
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {(dialog === 'save' || dialog === 'saveAs') && <SaveDialog asCopy={dialog === 'saveAs'} onClose={() => setDialog(null)} />}
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
