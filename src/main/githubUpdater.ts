import { app } from 'electron'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { autoUpdater } from 'electron-updater'
import { releaseNotesToLines, type LastUpdate, type PrepareResult, type UpdateStatus } from '@shared/update'

/*
 * Update aus den GitHub-Releases (für den Installer, den GitHub Actions baut – siehe .github/workflows/installer.yml).
 *
 * electron-updater liest latest.yml aus dem neuesten Release, vergleicht die Version mit package.json, lädt den
 * neuen Installer herunter und führt ihn beim Beenden still aus; danach startet die App neu. Spielzüge, Teams und
 * Einstellungen liegen im Benutzerordner und bleiben erhalten.
 */

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false
autoUpdater.logger = null

let downloaded = false

/** Vor dem Neustart gemerkt, damit die neue Version melden kann, ob es geklappt hat */
const markerFile = (): string => join(app.getPath('userData'), 'update-pending.json')

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Kein Netz, GitHub nicht erreichbar o. ä. */
const isOffline = (e: unknown): boolean => /ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|net::/i.test(message(e))

export async function checkGithub(base: UpdateStatus): Promise<UpdateStatus> {
  try {
    const r = await autoUpdater.checkForUpdates()
    if (!r) return { ...base, state: 'current' }
    const latestVersion = r.updateInfo.version
    return {
      ...base,
      latestVersion,
      state: r.isUpdateAvailable ? 'available' : 'current',
      notes: r.isUpdateAvailable ? releaseNotesToLines(r.updateInfo.releaseNotes) : []
    }
  } catch (e) {
    // Noch kein Release veröffentlicht: kein Fehler, einfach nichts Neues
    if (/404|latest\.yml|No published versions/i.test(message(e))) return { ...base, state: 'current' }
    return { ...base, state: 'offline' }
  }
}

export async function downloadGithub(): Promise<PrepareResult> {
  try {
    if (!downloaded) {
      const r = await autoUpdater.checkForUpdates()
      if (!r?.isUpdateAvailable) return { ok: false, message: 'Es gibt keine neuere Version mehr.' }
      await autoUpdater.downloadUpdate()
      downloaded = true
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: isOffline(e) ? 'Keine Verbindung zu GitHub. Bitte Internetverbindung prüfen.' : message(e) }
  }
}

/** Heruntergeladenen Installer still ausführen; die App beendet sich und startet danach neu */
export function installGithub(): boolean {
  if (!downloaded) return false
  try {
    writeFileSync(markerFile(), JSON.stringify({ from: app.getVersion() }))
  } catch {
    /* Meldung nach dem Neustart fällt dann weg */
  }
  autoUpdater.quitAndInstall(true, true)
  return true
}

/** Ergebnis des Updates vor diesem Start (einmalig) */
export function lastGithub(): LastUpdate | null {
  const file = markerFile()
  try {
    const { from } = JSON.parse(readFileSync(file, 'utf-8')) as { from?: string }
    rmSync(file, { force: true })
    const now = app.getVersion()
    return from !== now
      ? { ok: true, message: `Du arbeitest jetzt mit Version ${now}.` }
      : { ok: false, message: `Die neue Version wurde nicht installiert, es läuft weiter Version ${now}. Bitte noch einmal versuchen.` }
  } catch {
    return null
  }
}
