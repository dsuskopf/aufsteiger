import { useEffect, useState } from 'react'
import { usePlay } from '@renderer/store/playStore'
import { saveCurrent } from '@renderer/store/playDocs'
import { useUi } from '@renderer/store/settingsStore'
import { useSettings } from '@renderer/store/appSettings'

/**
 * Sicherheitsabfrage beim Schließen des Fensters, wenn der Spielzug ungespeicherte Änderungen hat:
 * Abbrechen (weiterarbeiten), Beenden (verwerfen) oder Speichern & Beenden.
 * Ein neuer, noch unbenannter Spielzug öffnet dafür erst den Speichern-Dialog; geschlossen wird nach dem Speichern.
 */
export function CloseDialog() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [quitAfterSave, setQuitAfterSave] = useState(false)
  const [dontAsk, setDontAsk] = useState(false)
  const dirty = usePlay((s) => s.dirty)
  const dialog = useUi((s) => s.dialog)

  useEffect(
    () =>
      window.api.app.onCloseRequested(() => {
        if (usePlay.getState().dirty && !useSettings.getState().settings.skipCloseWarning) {
          setError(false)
          setDontAsk(false)
          setOpen(true)
        } else window.api.app.close()
      }),
    []
  )

  // Neuer Spielzug: nach dem Speichern-Dialog beenden – oder die Absicht verwerfen, wenn er abgebrochen wurde
  useEffect(() => {
    if (!quitAfterSave) return
    if (!dirty) window.api.app.close()
    else if (dialog === null) setQuitAfterSave(false)
  }, [quitAfterSave, dirty, dialog])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  /** „Nicht mehr nachfragen“ merken (Einstellungen → Speichern), wenn angehakt und der Dialog mit Beenden verlassen wird */
  const remember = () => {
    if (dontAsk) useSettings.getState().update({ skipCloseWarning: true })
  }

  const saveAndQuit = async () => {
    remember()
    const cur = usePlay.getState().current
    if (!cur) {
      setOpen(false)
      setQuitAfterSave(true)
      useUi.getState().setDialog('save')
      return
    }
    setBusy(true)
    try {
      await saveCurrent(cur.code, cur.title, false)
      window.api.app.close()
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="sheet compact" role="alertdialog" aria-modal="true" aria-labelledby="close-title" aria-describedby="close-text">
        <header className="sheet-head">
          <h2 id="close-title">Wirklich beenden?</h2>
        </header>
        <div className="form-body">
          <p id="close-text">Der Spielzug hat ungespeicherte Änderungen. Beim Beenden gehen sie verloren.</p>
          <label className="check-row">
            <input type="checkbox" className="switch" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} />
            Nicht mehr nachfragen
          </label>
          {error && <p className="error">Speichern hat nicht geklappt. Versuch es bitte noch einmal.</p>}
        </div>
        <footer className="form-actions">
          <button type="button" className="plain" autoFocus onClick={() => setOpen(false)}>
            Abbrechen
          </button>
          <span className="grow" />
          <button type="button" className="plain danger-text" disabled={busy} onClick={() => {
              remember()
              window.api.app.close()
            }}
          >
            Beenden
          </button>
          <button type="button" className="prominent" disabled={busy} onClick={() => void saveAndQuit()}>
            Speichern &amp; Beenden
          </button>
        </footer>
      </div>
    </div>
  )
}
