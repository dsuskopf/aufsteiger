/** Update der installierten App aus dem Projektordner (siehe src/main/updater.ts) */

export interface UpdateCommit {
  hash: string
  subject: string
}

/**
 * - current: installierte App entspricht dem Projektordner (oder ist neuer)
 * - available: im Projektordner gibt es neuere Commits
 * - dev: Entwicklungsmodus (npm run dev) – hier gibt es nichts zu aktualisieren
 * - noProject: Projektordner nicht gefunden
 * - noGit: git ist nicht installiert oder der Ordner ist kein git-Repository
 */
export type UpdateState = 'current' | 'available' | 'dev' | 'noProject' | 'noGit'

export interface UpdateStatus {
  state: UpdateState
  /** Commit, aus dem die laufende App gebaut wurde ('' = unbekannt) */
  installedCommit: string
  /** Zeitpunkt des Builds (ISO) */
  builtAt: string
  /** Aktueller Commit im Projektordner */
  latestCommit: string
  /** Neue Commits (neueste zuerst, höchstens 20) */
  commits: UpdateCommit[]
  /** Projektordner hat nicht committete Änderungen (werden beim Update mitgebaut) */
  uncommitted: boolean
  projectDir: string
}

/** Ergebnis von „neue Version bauen“ */
export interface PrepareResult {
  ok: boolean
  /** Fehlermeldung (letzte Zeilen der Build-Ausgabe) */
  message?: string
}

/** Ergebnis des letzten Updates, gemeldet nach dem Neustart */
export interface LastUpdate {
  ok: boolean
  message: string
}

/** Kurzform eines Commits für die Anzeige */
export const shortCommit = (c: string): string => (c ? c.slice(0, 7) : 'unbekannt')

/**
 * Ist der Projektstand neuer als der installierte? Nein, wenn beide gleich sind oder der Projektstand ein
 * Vorgänger des installierten ist (dann wäre es ein Rückschritt). Unbekannter Build-Commit → ja.
 */
export function isNewer(installed: string, latest: string, latestIsAncestorOfInstalled: boolean): boolean {
  if (!latest) return false
  if (!installed) return true
  return installed !== latest && !latestIsAncestorOfInstalled
}
