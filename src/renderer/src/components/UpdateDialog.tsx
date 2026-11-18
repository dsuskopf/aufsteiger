import { useEffect, useState } from 'react'
import { shortCommit, type UpdateStatus } from '@shared/update'
import { useSettings } from '@renderer/store/appSettings'
import { usePlay } from '@renderer/store/playStore'
import { useUi } from '@renderer/store/settingsStore'
import { useUpdate } from '@renderer/store/updateStore'

const MAX_LISTED = 6

/** Kurzer Satz zum Stand – auch für die Einstellungen */
export function updateSummary(s: UpdateStatus | null, checking: boolean): string {
  if (checking && !s) return 'Wird geprüft …'
  if (!s) return 'Noch nicht geprüft'
  switch (s.state) {
    case 'available':
      if (s.source === 'github') return s.latestVersion ? `Version ${s.latestVersion} verfügbar` : 'Neue Version verfügbar'
      return s.commits.length === 1 ? 'Neue Version verfügbar (1 Änderung)' : s.commits.length > 1 ? `Neue Version verfügbar (${s.commits.length} Änderungen)` : 'Neue Version verfügbar'
    case 'current':
      return 'Auf dem neuesten Stand'
    case 'dev':
      return 'Entwicklungsmodus – Updates nur in der installierten App'
    case 'noProject':
      return `Projektordner nicht gefunden (${s.projectDir})`
    case 'noGit':
      return 'Git fehlt oder der Projektordner ist kein Git-Repository'
    case 'offline':
      return 'Keine Verbindung – Updates konnten nicht geprüft werden'
  }
}

/**
 * Update-Dialog: schlägt nach dem Start eine neuere Version vor, zeigt den Fortschritt und
 * nach dem Neustart das Ergebnis. Geöffnet auch über den Update-Button (Werkzeugleiste, Einstellungen).
 */
export function UpdateDialog() {
  const { open, status, phase, error, last, auto, close: closeDialog, run } = useUpdate()
  const [dontAsk, setDontAsk] = useState(false)
  const dirty = usePlay((s) => s.dirty)
  const unnamed = usePlay((s) => !s.current)
  const busy = phase === 'building' || phase === 'restarting'

  useEffect(() => setDontAsk(false), [open])

  /** „Nicht mehr nachfragen“ merken, wenn angehakt – egal ob mit Später oder Jetzt aktualisieren verlassen */
  const remember = () => {
    if (auto && dontAsk) useSettings.getState().update({ skipUpdatePrompt: true })
  }
  const close = () => {
    remember()
    closeDialog()
  }
  const start = () => {
    remember()
    void run()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  const saveFirst = () => {
    close()
    useUi.getState().setDialog('save')
  }

  let title = 'Update'
  let body: React.ReactNode = null
  let actions: React.ReactNode = (
    <button type="button" className="prominent" autoFocus onClick={close}>
      OK
    </button>
  )

  const github = status?.source === 'github'

  if (last) {
    title = last.ok ? 'Aufsteiger wurde aktualisiert' : 'Update hat nicht geklappt'
    const done = github || !status ? last.message : `Du arbeitest jetzt mit dem Stand ${shortCommit(status.installedCommit)}.`
    body = <p className={last.ok ? undefined : 'error'}>{last.ok ? done : last.message}</p>
  } else if (phase === 'building') {
    title = github ? 'Neue Version wird heruntergeladen …' : 'Neue Version wird gebaut …'
    body = (
      <>
        <div className="update-progress" role="progressbar" aria-label={github ? 'Wird heruntergeladen' : 'Wird gebaut'} />
        <p>
          {github
            ? 'Das dauert je nach Internetverbindung bis zu einer Minute. Danach wird die neue Version installiert und Aufsteiger startet neu.'
            : 'Das dauert etwa eine halbe Minute. Danach startet Aufsteiger neu; Windows fragt dabei nach Administratorrechten.'}
        </p>
      </>
    )
    actions = null
  } else if (phase === 'restarting') {
    title = github ? 'Neue Version wird installiert …' : 'Aufsteiger startet neu …'
    body = <p>{github ? 'Aufsteiger schließt sich kurz und startet dann von selbst mit der neuen Version.' : 'Gleich geht es mit der neuen Version weiter.'}</p>
    actions = null
  } else if (phase === 'error') {
    title = 'Update hat nicht geklappt'
    body = (
      <>
        <p>Die App läuft unverändert weiter.</p>
        <pre className="update-log">{error}</pre>
      </>
    )
    actions = (
      <>
        <button type="button" className="plain" onClick={close}>
          Schließen
        </button>
        <span className="grow" />
        <button type="button" className="prominent" onClick={() => void run()}>
          Erneut versuchen
        </button>
      </>
    )
  } else if (!status) {
    title = 'Nach Updates suchen …'
    body = <p className="caption">Es wird nach einer neuen Version gesucht.</p>
    actions = null
  } else {
    const available = status.state === 'available'
    const canRebuild = available || (!github && status.state === 'current' && status.uncommitted)
    title = available ? 'Neue Version verfügbar' : updateSummary(status, false)
    const listed = status.commits.slice(0, MAX_LISTED)
    body = (
      <>
        {github && available && (
          <>
            <p>
              Du hast Version {status.installedVersion}, neu ist Version {status.latestVersion}.
            </p>
            {status.notes.length > 0 && (
              <ul className="update-list">
                {status.notes.slice(0, MAX_LISTED).map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
                {status.notes.length > MAX_LISTED && <li className="caption">… und {status.notes.length - MAX_LISTED} weitere</li>}
              </ul>
            )}
          </>
        )}
        {github && status.state === 'current' && <p>Du hast die neueste Version ({status.installedVersion}).</p>}
        {github && status.state === 'offline' && <p>Bitte Internetverbindung prüfen und später noch einmal versuchen.</p>}
        {!github && available && listed.length > 0 && (
          <>
            <p>Neu seit deiner Version ({shortCommit(status.installedCommit)}):</p>
            <ul className="update-list">
              {listed.map((c) => (
                <li key={c.hash}>{c.subject}</li>
              ))}
              {status.commits.length > MAX_LISTED && <li className="caption">… und {status.commits.length - MAX_LISTED} weitere</li>}
            </ul>
          </>
        )}
        {!github && available && listed.length === 0 && <p>Im Projektordner gibt es einen neueren Stand ({shortCommit(status.latestCommit)}).</p>}
        {!github && status.state === 'current' && (
          <p>
            Stand {shortCommit(status.installedCommit)}
            {status.uncommitted && ' – im Projektordner gibt es nicht committete Änderungen, die du trotzdem übernehmen kannst.'}
          </p>
        )}
        {canRebuild && (
          <p className="caption">
            {github ? 'Aufsteiger lädt die neue Version herunter, installiert sie und startet neu.' : 'Aufsteiger baut die neue Version, beendet sich und startet neu.'}
          </p>
        )}
        {canRebuild && dirty && unnamed && <p className="error">Der neue Spielzug ist noch nicht gespeichert und geht beim Neustart verloren.</p>}
        {auto && (
          <label className="check-row">
            <input type="checkbox" className="switch" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} />
            Nicht mehr nachfragen
          </label>
        )}
      </>
    )
    if (canRebuild) {
      actions = (
        <>
          <button type="button" className="plain" onClick={close}>
            Später
          </button>
          <span className="grow" />
          {dirty && unnamed && (
            <button type="button" className="plain" onClick={saveFirst}>
              Erst speichern
            </button>
          )}
          <button type="button" className="prominent" autoFocus onClick={start}>
            {available ? 'Jetzt aktualisieren' : 'Trotzdem aktualisieren'}
          </button>
        </>
      )
    }
  }

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => !busy && e.target === e.currentTarget && close()}>
      <div className="sheet compact" role="alertdialog" aria-modal="true" aria-labelledby="update-title" aria-busy={busy}>
        <header className="sheet-head">
          <h2 id="update-title">{title}</h2>
        </header>
        <div className="form-body">{body}</div>
        {actions && <footer className="form-actions">{actions}</footer>}
      </div>
    </div>
  )
}
