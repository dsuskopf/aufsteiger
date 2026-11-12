import { BrowserWindow, app, ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { SCHEMA_VERSION, type PlayDoc, type PlaySummary, type Settings, type TeamsFile } from '@shared/types'
import { safeFileName, sanitizePlay, sanitizeSettings, sanitizeTeams } from '@shared/validate'
import { dataPath, readJson, writeJsonAtomic, writeJsonAtomicSync } from './storage'

const TEAMS_FILE = 'teams.json'
const SETTINGS_FILE = 'settings.json'
const PLAYS_DIR = 'plays'

const playFile = (id: string) => join(PLAYS_DIR, `${id}.json`)
const validId = (id: unknown): id is string => typeof id === 'string' && /^[\w-]{1,64}$/.test(id)

/** Exporte landen ohne Dateidialog in Dokumente\Volleyball-Spielzüge */
async function exportPath(name: string, ext: string): Promise<string> {
  const dir = process.env['VBP_EXPORT_DIR'] ?? join(app.getPath('documents'), 'Volleyball-Spielzüge')
  await fs.mkdir(dir, { recursive: true })
  const base = safeFileName(name)
  let file = join(dir, `${base}.${ext}`)
  // Vorhandene Dateien nicht überschreiben: „Kürzel (2).pdf“ usw.
  for (let i = 2; i < 1000; i++) {
    try {
      await fs.access(file)
      file = join(dir, `${base} (${i}).${ext}`)
    } catch {
      break
    }
  }
  return file
}

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

  // Beim Schließen: synchron speichern, damit das Beenden der App nichts abschneidet
  ipcMain.on('flush:sync', (e, kind: unknown, data: unknown) => {
    try {
      if (kind === 'teams') writeJsonAtomicSync(TEAMS_FILE, { schemaVersion: SCHEMA_VERSION, teams: sanitizeTeams(data) })
      if (kind === 'settings') writeJsonAtomicSync(SETTINGS_FILE, sanitizeSettings(data))
      e.returnValue = true
    } catch {
      e.returnValue = false
    }
  })

  ipcMain.handle('settings:load', async (): Promise<Settings> => sanitizeSettings(await readJson<unknown>(SETTINGS_FILE)))
  ipcMain.handle('settings:save', async (_e, data: unknown): Promise<void> => {
    await writeJsonAtomic(SETTINGS_FILE, sanitizeSettings(data))
  })

  /* ---------- Spielzüge ---------- */

  ipcMain.handle('plays:list', async (): Promise<PlaySummary[]> => {
    let names: string[] = []
    try {
      names = await fs.readdir(dataPath(PLAYS_DIR))
    } catch {
      return []
    }
    const out: PlaySummary[] = []
    for (const n of names) {
      if (!n.endsWith('.json')) continue
      const doc = sanitizePlay(await readJson<unknown>(join(PLAYS_DIR, n)).catch(() => null))
      if (doc) out.push({ id: doc.id, code: doc.code, title: doc.title, updatedAt: doc.updatedAt })
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })

  ipcMain.handle('plays:load', async (_e, id: unknown): Promise<PlayDoc | null> => {
    if (!validId(id)) return null
    return sanitizePlay(await readJson<unknown>(playFile(id)))
  })

  ipcMain.handle('plays:save', async (_e, data: unknown): Promise<PlayDoc> => {
    const doc = sanitizePlay(data)
    if (!doc) throw new Error('Ungültiger Spielzug')
    await writeJsonAtomic(playFile(doc.id), doc)
    return doc
  })

  ipcMain.handle('plays:delete', async (_e, id: unknown): Promise<void> => {
    if (!validId(id)) return
    await fs.rm(dataPath(playFile(id)), { force: true })
  })

  /* ---------- Export ---------- */

  /** HTML-Bericht (vom Renderer erzeugt) in einem unsichtbaren Fenster als PDF drucken */
  ipcMain.handle('export:pdf', async (_e, name: unknown, html: unknown): Promise<string> => {
    if (typeof html !== 'string') throw new Error('Kein Inhalt')
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, javascript: false, offscreen: true }
    })
    try {
      const tmp = dataPath(`export-${Date.now()}.html`)
      await fs.writeFile(tmp, html, 'utf-8')
      try {
        await win.loadFile(tmp)
        const pdf = await win.webContents.printToPDF({
          landscape: true,
          pageSize: 'A4',
          printBackground: true,
          margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
        })
        const file = await exportPath(String(name ?? 'Spielzug'), 'pdf')
        await fs.writeFile(file, pdf)
        return file
      } finally {
        await fs.rm(tmp, { force: true })
      }
    } finally {
      win.destroy()
    }
  })

  ipcMain.handle('export:video', async (_e, name: unknown, ext: unknown, data: unknown): Promise<string> => {
    if (!(data instanceof Uint8Array) && !(data instanceof ArrayBuffer)) throw new Error('Keine Videodaten')
    const file = await exportPath(String(name ?? 'Spielzug'), ext === 'mp4' ? 'mp4' : 'webm')
    await fs.writeFile(file, Buffer.from(data as ArrayBuffer))
    return file
  })

  ipcMain.handle('shell:showItem', (_e, file: unknown) => {
    if (typeof file === 'string') shell.showItemInFolder(file)
  })
}
