import type { Settings } from '@shared/types'
import { useSettings } from './appSettings'
import { saveCurrent } from './playDocs'
import { usePlay } from './playStore'
import { usePlayback } from './playbackStore'
import { useUi } from './settingsStore'

/**
 * Verbindet die dauerhaften Einstellungen mit dem, was sie steuern:
 * Größe der Oberfläche, Bedienleiste links, gemerkte Schalter der Ansicht (Namen, Zonen, Stift der Skizze),
 * automatisches Speichern und der zuletzt geöffnete Spielzug.
 */

/** Einstellungen, die das Fenster als Ganzes betreffen */
function applyWindow(s: Settings): void {
  document.documentElement.dataset.hand = s.leftHanded ? 'left' : 'right'
  window.api?.ui?.setZoom(s.uiScale)
}

/** Nach dem Laden: Startwerte der Oberfläche aus den Einstellungen */
export function applyStartSettings(s: Settings): void {
  applyWindow(s)
  useUi.getState().setNetHeight(s.netHeight)
  useUi.setState({ showNames: s.showNames, showZones: s.showZones, sketchColor: s.sketchColor, sketchWidth: s.sketchWidth, viewMode: s.startView })
  usePlayback.setState({ loop: s.defaultLoop, speed: s.defaultSpeed })
}

useSettings.subscribe((s, prev) => {
  if (!s.loaded) return
  const a = s.settings
  const b = prev.settings
  if (a.uiScale !== b.uiScale || a.leftHanded !== b.leftHanded) applyWindow(a)
  // Schalter in den Einstellungen wirken sofort auf die Ansicht
  if (a.showNames !== b.showNames || a.showZones !== b.showZones) useUi.setState({ showNames: a.showNames, showZones: a.showZones })
})

// Namen- und Zonen-Button sowie der Stift der Skizze merken sich ihren Stand
useUi.subscribe((u, prev) => {
  const st = useSettings.getState()
  if (!st.loaded) return
  const patch: Partial<Settings> = {}
  if (u.showNames !== prev.showNames && u.showNames !== st.settings.showNames) patch.showNames = u.showNames
  if (u.showZones !== prev.showZones && u.showZones !== st.settings.showZones) patch.showZones = u.showZones
  if (u.sketchColor !== prev.sketchColor && u.sketchColor !== st.settings.sketchColor) patch.sketchColor = u.sketchColor
  if (u.sketchWidth !== prev.sketchWidth && u.sketchWidth !== st.settings.sketchWidth) patch.sketchWidth = u.sketchWidth
  if (Object.keys(patch).length) st.update(patch)
})

/* ---------- Automatisch speichern ---------- */

const AUTOSAVE_MS = 1500
let autosaveTimer: ReturnType<typeof setTimeout> | undefined

/** Ein schon benannter Spielzug wird kurz nach der letzten Änderung gespeichert; neue fragen weiterhin einmal nach dem Namen */
function scheduleAutosave(): void {
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    const play = usePlay.getState()
    const ui = useUi.getState()
    if (!useSettings.getState().settings.autosave || !play.current || !play.dirty) return
    // Nicht mitten im Umbenennen oder Speichern-Dialog dazwischenfunken
    if (ui.dialog === 'save' || ui.dialog === 'saveAs') return scheduleAutosave()
    void saveCurrent(play.current.code, play.current.title, false).catch(() => {
      // bleibt als ungespeichert markiert; der Speichern-Button zeigt es
    })
  }, AUTOSAVE_MS)
}

usePlay.subscribe((s, prev) => {
  if (s.dirty && s.current && useSettings.getState().settings.autosave) scheduleAutosave()
  // Zuletzt geöffneter Spielzug (für „beim Start wieder öffnen“)
  if (s.current?.id !== prev.current?.id && useSettings.getState().loaded) {
    const id = s.current?.id ?? null
    if (id !== useSettings.getState().settings.lastPlayId) useSettings.getState().update({ lastPlayId: id })
  }
})
useSettings.subscribe((s, prev) => {
  if (s.settings.autosave && !prev.settings.autosave && usePlay.getState().dirty) scheduleAutosave()
})
