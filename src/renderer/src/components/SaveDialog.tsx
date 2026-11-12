import { useEffect, useRef, useState } from 'react'
import { usePlay } from '@renderer/store/playStore'
import { saveCurrent } from '@renderer/store/playDocs'

/** Speichern: Kürzel (Pflicht, z. B. „AngrV1“) und Titel. Ein geöffneter Spielzug wird überschrieben oder als neuer gespeichert. */
export function SaveDialog({ onClose }: { onClose: () => void }) {
  const current = usePlay((s) => s.current)
  const [code, setCode] = useState(current?.code ?? '')
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

  const submit = async (asNew: boolean) => {
    if (!code.trim()) {
      setError('Bitte ein Kürzel eingeben.')
      codeRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      await saveCurrent(code.trim(), title.trim(), asNew)
      onClose()
    } catch {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
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
          void submit(false)
        }}
      >
        <header className="sheet-head">
          <h2 id="save-title">{current ? 'Spielzug speichern' : 'Neuen Spielzug speichern'}</h2>
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
          {error && <p className="error">{error}</p>}
        </div>
        <footer className="form-actions">
          <button type="button" className="plain" onClick={onClose}>
            Abbrechen
          </button>
          <span className="grow" />
          {current && (
            <button type="button" disabled={busy} onClick={() => void submit(true)}>
              Als neuen Spielzug
            </button>
          )}
          <button type="submit" className="prominent" disabled={busy}>
            Speichern
          </button>
        </footer>
      </form>
    </div>
  )
}
