import { app, BrowserWindow, nativeTheme, shell } from 'electron'
import { join } from 'node:path'
import { WINDOW_BG, initTheme, registerIpc } from './ipc'

// Für Tests: eigenes Datenverzeichnis, damit echte Teams/Spielzüge unberührt bleiben
if (process.env['VBP_USER_DATA']) app.setPath('userData', process.env['VBP_USER_DATA'])
/** Automatische Tests: unsichtbares Offscreen-Fenster, Renderer mit ?test (Zugriff auf die Stores) */
const TEST = !!process.env['VBP_TEST']

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? WINDOW_BG.dark : WINDOW_BG.light,
    autoHideMenuBar: true,
    title: 'Volleyball Playbook',
    // Im Entwicklungsmodus das App-Icon zeigen (die installierte .exe bringt es selbst mit)
    ...(app.isPackaged ? {} : { icon: join(__dirname, '../../build/icon.png') }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      ...(TEST ? { offscreen: true } : {})
    }
  })

  win.once('ready-to-show', () => {
    if (TEST) return
    win.maximize()
    win.show()
  })

  // Externe Links nie in der App öffnen
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), TEST ? { search: 'test' } : undefined)
  }
}

app.whenReady().then(() => {
  initTheme()
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
