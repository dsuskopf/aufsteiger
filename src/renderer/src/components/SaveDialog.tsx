import { useEffect, useRef, useState } from 'react'
import { usePlay } from '@renderer/store/playStore'
import { saveCurrent } from '@renderer/store/playDocs'

/**
 * Kürzel (Pflicht, z. B. „AngrV1“) und Titel eines Spielzugs: beim ersten Speichern, beim Umbenennen
 * und für „Als Kopie speichern“ (asCopy – der geöffnete Spielzug bleibt unverändert, weitergearbeitet wird an der Kopie).
 */
export function SaveDialog({ asCopy = false, onClose }: { asCopy?: boolean; onClose: () => void }) {
  const current = usePlay((s) => s.current)
  const copy = asCopy && !!current
  const [code, setCode] = useState(copy ? `${current!.code} Kopie`.slice(0, 24) : (current?.code ?? ''))
  const [title, setTitle] = useState(current?.title ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    codeRef.current?.focus()
    codeRef.current?.select()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    if (!code.trim()) {
      setError('Bitte ein Kürzel eingeben.')
      codeRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      await saveCurrent(code.trim(), title.trim(), copy)
      onClose()
    } catch {
      setError('Speichern hat nicht geklappt. Versuch es bitte noch einmal.')
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="sheet compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-title"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <header className="sheet-head">
          <h2 id="save-title">{copy ? 'Als Kopie speichern' : current ? 'Spielzug umbenennen' : 'Spielzug speichern'}</h2>
        </header>
        <div className="form-body">
          <label className="form-field">
            <span>Kürzel</span>
            <input
              ref={codeRef}
              className="field"
              value={code}
              maxLength={24}
              placeholder="z. B. AngrV1"
              onChange={(e) => {
                setCode(e.target.value)
                setError(null)
              }}
            />
          </label>
          <label className="form-field">
            <span>Titel</span>
            <input className="field" value={title} maxLength={120} placeholder="z. B. Angriff über Position 4" onChange={(e) => setTitle(e.target.value)} />
          </label>
          {!current && <p className="caption">Ab dann speichert ein Tipp auf „Speichern“ sofort. Die Skizze wird mitgespeichert.</p>}
          {error && <p className="error">{error}</p>}
        </div>
        <footer className="form-actions">
          <span className="grow" />
          <button type="button" className="plain" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="prominent" disabled={busy}>
            {copy ? 'Kopie speichern' : 'Speichern'}
          </button>
        </footer>
      </form>
    </div>
  )
}
