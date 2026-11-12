import { contextBridge } from 'electron'
import type { AppApi } from './api'

// Phase 1: nur Versionsinfo. Speicher-IPC (plays, teams, settings) folgt in Phase 2/5.
const api: AppApi = {
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome
  }
}

contextBridge.exposeInMainWorld('api', api)
