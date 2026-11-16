import { useEffect, useState } from 'react'
import { usePlay } from '@renderer/store/playStore'
import { useTotalDuration } from '@renderer/store/playbackStore'
import { buildReport } from '@renderer/export/report'
import { pickVideoFormat, recordVideo } from '@renderer/export/video'
import { Icon } from './Icon'

type State =
  | { kind: 'idle' }
  | { kind: 'busy'; what: string; progress?: number }
  | { kind: 'done'; file: string }
  | { kind: 'error'; message: string }

/**
 * Export ohne Dateidialog: PDF (Draufsicht, Netzansicht, vier 3D-Winkel, Werte) oder Video der 3D-Animation.
 * Dateien landen in Dokumente\Volleyball-Spielzüge und lassen sich danach im Ordner zeigen.
 */
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const current = usePlay((s) => s.current)
  // Ein Video braucht Bewegung: einen Ballweg (auch nur den Angriff) oder Spieler, die laufen oder springen
  const canPlay = useTotalDuration() > 0
  const [state, setState] = useState<State>({ kind: 'idle' })
  const busy = state.kind === 'busy'
  const name = current?.code || 'Spielzug'
  const video = pickVideoFormat()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  const run = async (what: string, job: () => Promise<string>) => {
    setState({ kind: 'busy', what })
    try {
      setState({ kind: 'done', file: await job() })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const pdf = () =>
    run('PDF wird erstellt …', async () => window.api.exporter.pdf(name, await buildReport(name, current?.title ?? '')))
  const mp4 = () =>
    run('Video wird aufgenommen …', async () => {
      const v = await recordVideo((k) => setState({ kind: 'busy', what: 'Video wird aufgenommen …', progress: k }))
      setState({ kind: 'busy', what: 'Video wird gespeichert …' })
      return window.api.exporter.video(name, v.ext, v.data)
    })

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className={`sheet compact ${busy && state.what.startsWith('Video') ? 'see-through' : ''}`} role="dialog" aria-modal="true" aria-labelledby="export-title">
        <header className="sheet-head">
          <h2 id="export-title">Exportieren · {name}</h2>
          <button className="prominent" disabled={busy} onClick={onClose}>
            Fertig
          </button>
        </header>
        <div className="form-body">
          {!current && <p className="caption">Noch nicht gespeichert: Die Datei heißt dann „Spielzug“. Mit einem Kürzel bekommt sie dessen Namen.</p>}
          <button className="export-option" disabled={busy} onClick={() => void pdf()}>
            <Icon name="doc" size={28} />
            <span className="grow">
              <b>PDF</b>
              <span className="caption block">Draufsicht mit Skizze, Netzansicht, vier 3D-Ansichten und die Werte der Ballwege</span>
            </span>
          </button>
          <button className="export-option" disabled={busy || !video || !canPlay} onClick={() => void mp4()}>
            <Icon name="video" size={28} />
            <span className="grow">
              <b>Video der 3D-Animation</b>
              <span className="caption block">
                {!video
                  ? 'Dieser Rechner kann kein Video aufnehmen.'
                  : !canPlay
                    ? 'Noch nichts zum Abspielen: Zeichne zuerst einen Ballweg oder Laufweg.'
                    : `Aus der aktuellen 3D-Kamera, einmal in Echtzeit · ${video.ext.toUpperCase()}`}
              </span>
            </span>
          </button>
          <div className="export-status" role="status" aria-live="polite">
            {state.kind === 'busy' && (
              <>
                <span>{state.what}</span>
                {state.progress !== undefined && <progress max={1} value={state.progress} />}
              </>
            )}
            {state.kind === 'done' && (
              <>
                <span className="grow">Gespeichert: {state.file}</span>
                <button onClick={() => void window.api.exporter.showItem(state.file)}>
                  <Icon name="folder" />
                  Im Ordner zeigen
                </button>
              </>
            )}
            {state.kind === 'error' && <span className="error">Der Export hat nicht geklappt: {state.message}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
