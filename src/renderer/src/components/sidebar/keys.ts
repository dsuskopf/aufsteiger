import { useEffect } from 'react'
import { usePlay } from '@renderer/store/playStore'
import { useUi } from '@renderer/store/settingsStore'

/**
 * Tastatur für die Seitenleiste: Esc geht eine Ebene zurück (Zeichnen abbrechen → Auswahl aufheben → Übersicht),
 * Entf löscht das Gewählte (Ballweg bzw. Laufweg, Sprung, Block des Spielers).
 */
export function useSelectionKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const ui = useUi.getState()
      if (ui.dialog || ui.teamsOpen || ui.settingsOpen) return
      const play = usePlay.getState()
      if (e.key === 'Escape') {
        if (ui.tool !== 'select') ui.setTool('select')
        else if (play.selectedPlayer) play.selectPlayer(null)
        else if (play.selected) play.select(null)
        else if (ui.sidebarPage !== 'overview') useUi.setState({ sidebarPage: 'overview' })
        return
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (play.selectedPlayer) play.clearPlayerMoves(play.selectedPlayer.side, play.selectedPlayer.playerId)
      else if (play.selected === 'schlag') play.removeSchlag()
      else if (play.selected) play.removeTrajectory(play.selected)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
