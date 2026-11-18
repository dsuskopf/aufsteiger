import type { PlayDoc, PlaySummary, Settings, Team, TeamsFile, ThemePref } from '../shared/types'
import type { LastUpdate, PrepareResult, UpdateStatus } from '../shared/update'

export interface AppApi {
  versions: { electron: string; chrome: string }
  teams: {
    /** null, wenn noch keine Datei existiert (erster Start) */
    load: () => Promise<TeamsFile | null>
    save: (teams: Team[]) => Promise<void>
  }
  /** Synchrones Sichern beim Schließen des Fensters */
  flushSync: (kind: 'teams' | 'settings', data: unknown) => boolean
  settings: {
    load: () => Promise<Settings>
    save: (s: Settings) => Promise<void>
  }
  plays: {
    list: () => Promise<PlaySummary[]>
    load: (id: string) => Promise<PlayDoc | null>
    save: (doc: PlayDoc) => Promise<PlayDoc>
    remove: (id: string) => Promise<void>
  }
  exporter: {
    /** Druckt den HTML-Bericht als PDF; gibt den Dateipfad zurück */
    pdf: (name: string, html: string) => Promise<string>
    video: (name: string, ext: 'mp4' | 'webm', data: Uint8Array) => Promise<string>
    showItem: (file: string) => Promise<void>
  }
  theme: {
    /** Erscheinungsbild des Fensters: Einstellung (System, Hell, Dunkel) und was daraus gerade gilt */
    set: (pref: ThemePref, resolved: 'light' | 'dark') => void
  }
  ui: {
    /** Größe der ganzen Oberfläche (1 = 100 %) */
    setZoom: (factor: number) => void
  }
  app: {
    info: () => Promise<{ version: string; dataDir: string; exportDir: string }>
    /** Ordner im Explorer öffnen: gespeicherte Daten oder Exporte */
    openFolder: (kind: 'data' | 'exports') => Promise<void>
    /** Das Fenster soll geschlossen werden (X, Alt+F4): die Oberfläche entscheidet, ob nachgefragt wird */
    onCloseRequested: (cb: () => void) => () => void
    /** Fenster jetzt wirklich schließen */
    close: () => void
  }
  update: {
    /** Gibt es im Projektordner eine neuere Version? */
    check: () => Promise<UpdateStatus>
    /** Neue Version bauen (dauert etwa eine halbe Minute; die App läuft weiter) */
    prepare: () => Promise<PrepareResult>
    /** Gebaute Version einsetzen: App beendet sich und startet neu. false = vorher nicht gebaut */
    apply: () => Promise<boolean>
    /** Ergebnis des Updates vor diesem Start (nur einmal, sonst null) */
    last: () => Promise<LastUpdate | null>
  }
}

declare global {
  interface Window {
    api: AppApi
  }
}
