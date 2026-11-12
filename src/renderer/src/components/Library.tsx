import { useEffect, useMemo, useState } from 'react'
import type { PlaySummary } from '@shared/types'
import { usePlay } from '@renderer/store/playStore'
import { deletePlay, duplicatePlay, newPlay, openDoc, renamePlay } from '@renderer/store/playDocs'
import { ConfirmButton } from './ConfirmButton'
import { Icon } from './Icon'

type Field = 'all' | 'code' | 'title'
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Bibliothek aller gespeicherten Spielzüge: suchen und filtern (Kürzel, Titel), öffnen,
 * umbenennen, duplizieren, löschen (mit Bestätigung). Ungespeicherte Änderungen werden vor dem Öffnen abgefragt.
 */
export function Library({ onClose }: { onClose: () => void }) {
  const [plays, setPlays] = useState<PlaySummary[] | null>(null)
  const [query, setQuery] = useState('')
  const [field, setField] = useState<Field>('all')
  const [editing, setEditing] = useState<string | null>(null)
  /** Wartende Aktion, falls der aktuelle Spielzug ungespeicherte Änderungen hat */
  const [pending, setPending] = useState<{ label: string; run: () => void } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = usePlay((s) => s.current)
  const dirty = usePlay((s) => s.dirty)

  const reload = () =>
    window.api.plays
      .list()
      .then(setPlays)
      .catch(() => setError('Bibliothek konnte nicht geladen werden.'))
  useEffect(() => {
    void reload()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!plays || !q) return plays ?? []
    return plays.filter(
      (p) => (field !== 'title' && p.code.toLowerCase().includes(q)) || (field !== 'code' && p.title.toLowerCase().includes(q))
    )
  }, [plays, query, field])

  const guarded = (label: string, run: () => void) => (dirty ? setPending({ label, run }) : run())

  const open = (id: string) =>
    guarded('öffnen', async () => {
      const doc = await window.api.plays.load(id)
      if (!doc) return setError('Spielzug konnte nicht geöffnet werden.')
      openDoc(doc)
      onClose()
    })

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet library" role="dialog" aria-modal="true" aria-labelledby="library-title">
        <header className="sheet-head">
          <h2 id="library-title">Bibliothek</h2>
          <button
            onClick={() =>
              guarded('neu beginnen', () => {
                newPlay()
                onClose()
              })
            }
          >
            <Icon name="newfile" />
            Neuer Spielzug
          </button>
          <button className="prominent" onClick={onClose}>
            Fertig
          </button>
        </header>

        <div className="library-search">
          <label className="search-field">
            <Icon name="search" />
            <input
              className="field"
              type="search"
              placeholder="Suchen"
              aria-label="Spielzüge suchen"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="segmented" role="radiogroup" aria-label="Suchen in">
            {(
              [
                ['all', 'Alles'],
                ['code', 'Kürzel'],
                ['title', 'Titel']
              ] as const
            ).map(([id, label]) => (
              <button key={id} role="radio" aria-checked={field === id} className={field === id ? 'selected' : ''} onClick={() => setField(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {pending && (
          <div className="discard-banner" role="alertdialog" aria-label="Ungespeicherte Änderungen">
            <span className="grow">Der aktuelle Spielzug hat ungespeicherte Änderungen.</span>
            <button className="plain" onClick={() => setPending(null)}>
              Abbrechen
            </button>
            <button
              className="danger armed"
              onClick={() => {
                const p = pending
                setPending(null)
                p.run()
              }}
            >
              Verwerfen und {pending.label}
            </button>
          </div>
        )}
        {error && <p className="error library-error">{error}</p>}

        <div className="library-list" role="list">
          {plays === null ? (
            <p className="empty">Lädt …</p>
          ) : shown.length === 0 ? (
            <p className="empty">
              {plays.length === 0
                ? 'Noch keine Spielzüge gespeichert. Zeichne einen Spielzug und tippe oben auf Speichern.'
                : 'Kein Spielzug passt zur Suche.'}
            </p>
          ) : (
            shown.map((p) =>
              editing === p.id ? (
                <RenameRow
                  key={p.id}
                  play={p}
                  onDone={async (code, title) => {
                    setEditing(null)
                    if (code !== null) {
                      await renamePlay(p.id, code, title)
                      await reload()
                    }
                  }}
                />
              ) : (
                <div key={p.id} role="listitem" className={`library-row ${current?.id === p.id ? 'current' : ''}`}>
                  <button className="open" onClick={() => open(p.id)} title="Öffnen">
                    <span className="code">{p.code || '—'}</span>
                    <span className="title">{p.title || <span className="secondary">Ohne Titel</span>}</span>
                    <span className="date">{fmtDate(p.updatedAt)}</span>
                  </button>
                  <button className="icon-only plain" title="Umbenennen" aria-label={`${p.code} umbenennen`} onClick={() => setEditing(p.id)}>
                    <Icon name="pencil" />
                  </button>
                  <button
                    className="icon-only plain"
                    title="Duplizieren"
                    aria-label={`${p.code} duplizieren`}
                    onClick={async () => {
                      await duplicatePlay(p.id)
                      await reload()
                    }}
                  >
                    <Icon name="copy" />
                  </button>
                  <ConfirmButton
                    label="Löschen"
                    confirmLabel="Endgültig löschen"
                    icon="trash"
                    onConfirm={async () => {
                      await deletePlay(p.id)
                      await reload()
                    }}
                  />
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  )
}

function RenameRow({ play, onDone }: { play: PlaySummary; onDone: (code: string | null, title: string) => void }) {
  const [code, setCode] = useState(play.code)
  const [title, setTitle] = useState(play.title)
  return (
    <form
      className="library-row editing"
      onSubmit={(e) => {
        e.preventDefault()
        if (code.trim()) onDone(code.trim(), title.trim())
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onDone(null, '')
        }
      }}
    >
      <input className="field code" aria-label="Kürzel" value={code} maxLength={24} autoFocus onChange={(e) => setCode(e.target.value)} />
      <input className="field grow" aria-label="Titel" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      <button type="button" className="plain" onClick={() => onDone(null, '')}>
        Abbrechen
      </button>
      <button type="submit" className="prominent" disabled={!code.trim()}>
        <Icon name="check" />
        Sichern
      </button>
    </form>
  )
}
