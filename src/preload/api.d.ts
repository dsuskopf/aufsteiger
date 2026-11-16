import type { PlayDoc, PlaySummary, Settings, Team, TeamsFile, ThemePref } from '../shared/types'

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
}

declare global {
  interface Window {
    api: AppApi
  }
}
