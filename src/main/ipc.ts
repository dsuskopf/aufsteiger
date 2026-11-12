import { ipcMain } from 'electron'
import { SCHEMA_VERSION, type TeamsFile } from '@shared/types'
import { sanitizeTeams } from '@shared/validate'
import { readJson, writeJsonAtomic } from './storage'

const TEAMS_FILE = 'teams.json'

export function registerIpc(): void {
  ipcMain.handle('teams:load', async (): Promise<TeamsFile | null> => {
    const raw = await readJson<unknown>(TEAMS_FILE)
    if (raw === null) return null
    return { schemaVersion: SCHEMA_VERSION, teams: sanitizeTeams(raw) }
  })

  ipcMain.handle('teams:save', async (_e, data: unknown): Promise<void> => {
    const file: TeamsFile = { schemaVersion: SCHEMA_VERSION, teams: sanitizeTeams(data) }
    await writeJsonAtomic(TEAMS_FILE, file)
  })
}
