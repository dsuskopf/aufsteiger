import { usePlay } from './playStore'
import { saveCurrent } from './playDocs'
import { usePlayback } from './playbackStore'
import { useUi } from './settingsStore'

/** Animation anhalten und an den Anfang (Bearbeiten gilt für die Grundstellung) */
export function rewind(): void {
  usePlayback.getState().pause()
  usePlayback.setState({ t: 0 })
}

/** Speichern: ein schon gespeicherter Spielzug wird direkt überschrieben, ein neuer fragt nach Kürzel und Titel */
export async function quickSave(): Promise<void> {
  const cur = usePlay.getState().current
  if (!cur) {
    useUi.getState().setDialog('save')
    return
  }
  await saveCurrent(cur.code, cur.title, false)
}
