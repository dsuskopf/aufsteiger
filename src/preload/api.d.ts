import type { Team, TeamsFile } from '../shared/types'

export interface AppApi {
  versions: { electron: string; chrome: string }
  teams: {
    /** null, wenn noch keine Datei existiert (erster Start) */
    load: () => Promise<TeamsFile | null>
    save: (teams: Team[]) => Promise<void>
  }
}

declare global {
  interface Window {
    api: AppApi
  }
}
