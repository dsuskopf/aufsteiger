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
  },
  flushSync: (kind, data) => ipcRenderer.sendSync('flush:sync', kind, data),
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (s) => ipcRenderer.invoke('settings:save', s)
  },
  plays: {
    list: () => ipcRenderer.invoke('plays:list'),
    load: (id) => ipcRenderer.invoke('plays:load', id),
    save: (doc) => ipcRenderer.invoke('plays:save', doc),
    remove: (id) => ipcRenderer.invoke('plays:delete', id)
  },
  exporter: {
    pdf: (name, html) => ipcRenderer.invoke('export:pdf', name, html),
    video: (name, ext, data) => ipcRenderer.invoke('export:video', name, ext, data),
    showItem: (file) => ipcRenderer.invoke('shell:showItem', file)
  }
}

contextBridge.exposeInMainWorld('api', api)
