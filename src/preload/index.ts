import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from './api'

const api: AppApi = {
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome
  },
  teams: {
    load: () => ipcRenderer.invoke('teams:load'),
    save: (teams) => ipcRenderer.invoke('teams:save', teams)
  }
}

contextBridge.exposeInMainWorld('api', api)
