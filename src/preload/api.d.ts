import type { PlayDoc, PlaySummary, Settings, Team, TeamsFile } from '../shared/types'

export interface AppApi {
  versions: { electron: string; chrome: string }
  teams: {
    /** null, wenn noch keine Datei existiert (erster Start) */
    load: () => Promise<TeamsFile | null>
    save: (teams: Team[]) => Promise<void>
  }
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
}

declare global {
  interface Window {
    api: AppApi
  }
}
