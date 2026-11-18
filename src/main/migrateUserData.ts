import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/** Dateien, an denen man erkennt, dass ein Datenordner echte Nutzerdaten enthält. */
const USER_FILES = ['plays', 'teams.json', 'settings.json']

const hasUserData = (dir: string): boolean => USER_FILES.some((f) => existsSync(join(dir, f)))

/**
 * Zieht den Datenordner aus der Zeit vor der Umbenennung („Volleyball Playbook“) in den neuen
 * („Aufsteiger“) um. Gibt den Ordner zurück, den die App benutzen soll.
 *
 * - Alter Ordner fehlt oder ohne Nutzerdaten → neuer Ordner.
 * - Neuer Ordner hat schon Nutzerdaten → neuer Ordner, der alte bleibt unberührt (nichts überschreiben).
 * - Sonst wird der alte Ordner umbenannt. Ein schon angelegter neuer Ordner ohne Nutzerdaten (nur
 *   Browser-Caches) wird dafür vorher entfernt.
 * - Schlägt das Umbenennen fehl (z. B. weil die alte Version noch läuft), bleibt es beim alten Ordner,
 *   damit keine Daten „verschwinden“. Der Umzug wird beim nächsten Start erneut versucht.
 */
export function migrateUserData(appData: string, oldName: string, newName: string): string {
  const oldDir = join(appData, oldName)
  const newDir = join(appData, newName)
  if (!existsSync(oldDir) || !hasUserData(oldDir)) return newDir
  if (existsSync(newDir) && hasUserData(newDir)) return newDir
  try {
    if (existsSync(newDir)) {
      // Nur Caches ohne Nutzerdaten – sicherheitshalber prüfen, dass wirklich nichts Eigenes drin liegt
      const own = readdirSync(newDir).filter((f) => USER_FILES.includes(f))
      if (own.length > 0) return newDir
      rmSync(newDir, { recursive: true, force: true })
    }
    renameSync(oldDir, newDir)
    return newDir
  } catch {
    return oldDir
  }
}
