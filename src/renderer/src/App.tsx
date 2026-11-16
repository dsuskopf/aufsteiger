import { Toolbar } from './components/Toolbar'
import { TopView } from './views/top/TopView'
import { NetView } from './views/net/NetView'
import { netYawLabel } from './views/net/netAngles'
import { Icon } from './components/Icon'
import { PipWindow } from './components/PipWindow'
import { ThreeView } from './views/three/ThreeView'
import { SketchView } from './views/sketch/SketchView'
import { useTheme } from './theme/themeStore'
import { useEffect } from 'react'
import { useUi } from './store/settingsStore'
import { useTeams } from './store/teamsStore'
import { usePlay } from './store/playStore'
import { TeamManager } from './components/TeamManager'
import { Playbar } from './components/Playbar'
import { SettingsDialog } from './components/SettingsDialog'
import { useSettings } from './store/appSettings'
import { currentEvents, onBallEvent, usePlayback } from './store/playbackStore'
import { SaveDialog } from './components/SaveDialog'
import { Library } from './components/Library'
import { ExportDialog } from './components/ExportDialog'
import { Sidebar } from './components/sidebar/Sidebar'
import { QuickTeamChip } from './components/QuickTeam'
import { useSelectionKeys } from './components/sidebar/keys'
import { quickSave, rewind } from './store/actions'
import { clearHistory, redo, undo } from './store/history'
import { playSfx } from './audio/sfx'
import { sfxLevel } from './views/three/effects'
import { openDoc } from './store/playDocs'
import { applyStartSettings } from './store/prefsSync'

const HINTS = {
  annahme: 'Annahme: vom Annehmer zum Steller ziehen · Esc bricht ab',
  zuspiel: 'Zuspiel: vom Steller zum Angreifer ziehen · Esc bricht ab',
  zuspielCoupled: 'Zuspiel: antippen, wo der Angreifer den Ball trifft · Esc bricht ab',
  laufweg: 'Laufweg: auf dem Spieler aufsetzen und den Weg ziehen · Esc bricht ab',
  schlag: 'Angriff: vom Schlagpunkt zum Ziel ziehen · Esc bricht ab',
  schlagCoupled: 'Angriff: antippen, wo der Ball landen soll · Esc bricht ab'
}

export function App() {
  const viewMode = useUi((s) => s.viewMode)
  const { teamsOpen, setTeamsOpen, netPipCollapsed, setNetPipCollapsed, sidebarOpen } = useUi()

  const { settingsOpen, setSettingsOpen, tool, dialog, setDialog } = useUi()
  const hasAnnahme = usePlay((s) => !!s.trajectories.annahme)
  const hasZuspiel = usePlay((s) => !!s.trajectories.zuspiel)
  useSelectionKeys()

  // Start: Einstellungen laden und anwenden, dann Teams; Seite A bekommt das erste Team, damit gleich Spieler
  // zu sehen sind. Auf Wunsch öffnet sich der zuletzt geöffnete Spielzug wieder.
  useEffect(() => {
    void (async () => {
      const st = await useSettings.getState().load()
      applyStartSettings(st)
      await useTeams.getState().load()
      const first = useTeams.getState().teams[0]
      if (first && usePlay.getState().sides.A.teamId === null) usePlay.getState().setTeam('A', first.id)
      usePlay.setState({ dirty: false })
      // Das Aufstellen beim Start ist kein Schritt zum Rückgängigmachen
      clearHistory()
      if (st.reopenLast && st.lastPlayId) {
        const doc = await window.api.plays.load(st.lastPlayId).catch(() => null)
        if (doc && !usePlay.getState().dirty) openDoc(doc)
      }
    })()
  }, [])

  // Tastatur: Leertaste spielt ab/pausiert (nicht in Eingabefeldern), Strg+S speichert
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState()
      // Über einem offenen Fenster (Dialog, Teams, Einstellungen) gelten die Kürzel der Arbeitsfläche nicht
      const covered = !!ui.dialog || ui.teamsOpen || ui.settingsOpen
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!covered) void quickSave().catch(() => {})
        return
      }
      const tag = (e.target as HTMLElement | null)?.tagName
      const typing = (tag === 'INPUT' && !['range', 'checkbox'].includes((e.target as HTMLInputElement).type)) || tag === 'TEXTAREA'
      // Strg+Z rückgängig, Strg+Y (oder Strg+Umschalt+Z) wiederholen – in Textfeldern bleibt es beim Text
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !typing && !covered) {
        const k = e.key.toLowerCase()
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault()
          undo()
          return
        }
        if (k === 'y' || (k === 'z' && e.shiftKey)) {
          e.preventDefault()
          redo()
          return
        }
      }
      if (tag === 'INPUT' && (e.target as HTMLInputElement).type !== 'range') return
      if (tag === 'SELECT' || tag === 'TEXTAREA') return
      // In der Skizze gibt es nichts abzuspielen
      if (covered || ui.viewMode === 'sketch') return
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault()
        usePlayback.getState().toggle()
      }
      // F: Flugbahn ein/aus (wie die Checkbox unten rechts) – in 2D und 3D
      if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        const play = usePlay.getState()
        play.setDisplay({ ballOnly: !play.display.ballOnly })
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
        if (!st.sound) return
        // Nach dem ersten Bodenkontakt springt der Ball nur noch leise nach
        const { gain, hard } = sfxLevel(currentEvents(), e)
        // Finte klingt wie ein weiches Pritschen
        playSfx(e.finte ? 'zuspiel' : e.kind, hard, (st.soundVolume / 100) * gain, speed)
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

  // Skizze: Grundstellung zeigen, nichts ist gewählt
  useEffect(() => {
    if (viewMode !== 'sketch') return
    rewind()
    usePlay.setState({ selected: null, selectedPlayer: null })
  }, [viewMode])

  const is2d = viewMode === '2d'
  const show3d = viewMode === '3d'
  const sketching = viewMode === 'sketch'
  // Die Ansichten zeichnen mit festen Farben: beim Wechsel des Erscheinungsbilds neu aufbauen
  const theme = useTheme((s) => s.resolved)
  const main2D = useUi((s) => s.main2D)
  const netYaw = useUi((s) => s.netYaw)
  const netTitle = `Netz · ${netYawLabel(netYaw)}`
  const pipTitle = main2D === 'top' ? netTitle : 'Draufsicht'

  return (
    <div className="app">
      <Toolbar />
      <div className="workspace">
        {sidebarOpen && !sketching && <Sidebar onManageTeams={() => setTeamsOpen(true)} />}
        <main className={`views ${sketching ? 'sketch' : ''}`} key={theme}>
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
                <kbd>E</kbd> drehen · <kbd>T</kbd>
                <kbd>G</kbd> kippen · Mausrad zoomt · <kbd>1</kbd>–<kbd>6</kbd> Blickwinkel · <kbd>F</kbd> Flugbahn
              </div>
              <ThreeView />
            </section>
          )}
          {sketching && (
            <section className="pane" aria-label="Skizze">
              <div className="pane-title">Skizze</div>
              <SketchView />
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
      {!sketching && <Playbar />}
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
