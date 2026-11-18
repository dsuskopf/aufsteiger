/**
 * Update der installierten App (siehe src/main/updater.ts). Zwei Quellen:
 * - project: aus dem Projektordner, aus dem die App gebaut wurde (npm run dist auf dem eigenen PC)
 * - github: aus den GitHub-Releases (Installer, den GitHub Actions gebaut hat)
 */
export type UpdateSource = 'project' | 'github'

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
 * - offline: GitHub war nicht erreichbar (nur Quelle github)
 */
export type UpdateState = 'current' | 'available' | 'dev' | 'noProject' | 'noGit' | 'offline'

export interface UpdateStatus {
  state: UpdateState
  source: UpdateSource
  /** Version der laufenden App (package.json) */
  installedVersion: string
  /** Neueste Version auf GitHub ('' = unbekannt; nur Quelle github) */
  latestVersion: string
  /** Neuerungen der neuen Version als einzelne Zeilen (nur Quelle github) */
  notes: string[]
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

/** Ergebnis von „neue Version bauen“ bzw. „neue Version herunterladen“ */
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

/**
 * Release-Notizen von GitHub (HTML, Markdown oder je Version eine Liste) als schlichte Zeilen:
 * Tags weg, Aufzählungszeichen weg, Links auf ihren Text, Zeilen wie „Full Changelog“ und Überschriften raus.
 */
export function releaseNotesToLines(notes: unknown): string[] {
  const raw = Array.isArray(notes)
    ? notes.map((n) => (n && typeof n === 'object' && 'note' in n ? String((n as { note: unknown }).note ?? '') : String(n ?? ''))).join('\n')
    : typeof notes === 'string'
      ? notes
      : ''
  const text = raw
    .replace(/<\/(li|p|h\d|div)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s+/, '').trim())
    .filter((l) => l && !/^#+\s/.test(l) && !/^(\*\*)?full changelog/i.test(l) && !/^what'?s changed$/i.test(l))
    .map((l) => l.replace(/\s+by @\S+ in https?:\/\/\S+$/, '').replace(/\*\*/g, ''))
}
