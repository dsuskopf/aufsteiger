import { contextBridge, ipcRenderer, webFrame } from 'electron'
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
  },
  theme: {
    set: (pref, resolved) => ipcRenderer.send('theme:set', pref, resolved)
  },
  ui: {
    setZoom: (factor) => webFrame.setZoomFactor(Math.min(2, Math.max(0.5, factor)))
  },
  app: {
    info: () => ipcRenderer.invoke('app:info'),
    openFolder: (kind) => ipcRenderer.invoke('app:openFolder', kind),
    onCloseRequested: (cb) => {
      const h = (): void => cb()
      ipcRenderer.on('app:closeRequested', h)
      return () => ipcRenderer.removeListener('app:closeRequested', h)
    },
    close: () => ipcRenderer.send('app:close')
  }
}

contextBridge.exposeInMainWorld('api', api)
