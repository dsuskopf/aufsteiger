import { app, ipcMain } from 'electron'
import { execFile, spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { isNewer, type LastUpdate, type PrepareResult, type UpdateCommit, type UpdateSource, type UpdateStatus } from '@shared/update'
import { checkGithub, downloadGithub, installGithub, lastGithub } from './githubUpdater'

/*
 * Update der installierten App. Woher, legt der Build fest (__UPDATE_SOURCE__, siehe electron.vite.config.ts):
 * - github: Installer aus GitHub Actions → neue Versionen aus den GitHub-Releases (githubUpdater.ts)
 * - project: selbst gebaut (npm run dist) → neue Versionen aus dem Projektordner, wie folgt:
 *
 *
 * Beim Bauen merkt sich die App ihren Commit und den Projektordner (electron.vite.config.ts). Gibt es dort
 * neuere Commits, wird ein Update angeboten. Das Update selbst macht scripts/update-installed.mjs:
 *   1. --vorbereiten: App bauen und eine neue app.asar packen (die laufende App wartet darauf)
 *   2. --anwenden:    nachdem die App beendet ist, die app.asar austauschen und die App neu starten
 * Das Ergebnis von Schritt 2 landet in einer Statusdatei, die die App nach dem Neustart meldet.
 */

declare const __BUILD_COMMIT__: string
declare const __BUILD_TIME__: string
declare const __PROJECT_DIR__: string
declare const __UPDATE_SOURCE__: UpdateSource

const SOURCE: UpdateSource = __UPDATE_SOURCE__ === 'github' ? 'github' : 'project'

const SCRIPT = join('scripts', 'update-installed.mjs')
const projectDir = (): string => process.env['AUFSTEIGER_PROJECT_DIR'] ?? __PROJECT_DIR__
const statusFile = (): string => join(app.getPath('temp'), 'aufsteiger-update-status.json')

let preparedAsar: string | null = null
let updating = false
/** Die App beendet sich für ein Update: nicht nach ungespeicherten Änderungen fragen (wurde vorher erledigt) */
export const isUpdating = (): boolean => updating

interface Run {
  code: number
  out: string
  /** Programm nicht gefunden (z. B. git oder node fehlt) */
  missing: boolean
}

function run(cmd: string, args: string[], cwd: string, timeout = 15_000): Promise<Run> {
  return new Promise((res) => {
    execFile(cmd, args, { cwd, windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === 'number' ? err.code : -1) : 0
      res({ code, out: `${stdout}${stderr}`, missing: err?.code === 'ENOENT' })
    })
  })
}

export async function checkForUpdate(): Promise<UpdateStatus> {
  const dir = projectDir()
  const status: UpdateStatus = {
    state: 'current',
    source: SOURCE,
    installedVersion: app.getVersion(),
    latestVersion: '',
    notes: [],
    installedCommit: __BUILD_COMMIT__,
    builtAt: __BUILD_TIME__,
    latestCommit: '',
    commits: [],
    uncommitted: false,
    projectDir: dir
  }
  if (SOURCE === 'github') return app.isPackaged ? checkGithub({ ...status, projectDir: '' }) : { ...status, projectDir: '', state: 'dev' }
  if (!app.isPackaged && !process.env['AUFSTEIGER_PROJECT_DIR']) return { ...status, state: 'dev' }
  if (!existsSync(join(dir, SCRIPT)) || !existsSync(join(dir, 'package.json'))) return { ...status, state: 'noProject' }

  const head = await run('git', ['rev-parse', 'HEAD'], dir)
  if (head.code !== 0) return { ...status, state: 'noGit' }
  const latest = head.out.trim()
  status.latestCommit = latest

  const installed = __BUILD_COMMIT__
  const behind = installed ? (await run('git', ['merge-base', '--is-ancestor', latest, installed], dir)).code === 0 : false
  status.state = isNewer(installed, latest, behind) ? 'available' : 'current'

  if (status.state === 'available' && installed) {
    const log = await run('git', ['log', '--format=%h%x09%s', '-n', '20', `${installed}..${latest}`], dir)
    if (log.code === 0) {
      status.commits = log.out
        .split(/\r?\n/)
        .filter(Boolean)
        .map((l): UpdateCommit => {
          const [hash, ...rest] = l.split('\t')
          return { hash: hash ?? '', subject: rest.join('\t') }
        })
    }
  }
  const dirty = await run('git', ['status', '--porcelain', '--untracked-files=no'], dir)
  status.uncommitted = dirty.code === 0 && dirty.out.trim() !== ''
  return status
}

/** Neue Version bauen und packen; die App läuft dabei weiter */
async function prepare(): Promise<PrepareResult> {
  if (SOURCE === 'github') return downloadGithub()
  const dir = projectDir()
  if (!existsSync(join(dir, SCRIPT))) return { ok: false, message: `Projektordner nicht gefunden: ${dir}` }
  const r = await run('node', [SCRIPT, '--vorbereiten'], dir, 5 * 60_000)
  const line = r.out.split(/\r?\n/).find((l) => l.startsWith('UPDATE_READY '))
  if (r.code !== 0 || !line) {
    const tail = r.out.trim().split(/\r?\n/).slice(-12).join('\n')
    if (r.missing) return { ok: false, message: 'Node.js wurde nicht gefunden. Bitte Node.js installieren.' }
    return { ok: false, message: tail || 'Der Build ist fehlgeschlagen.' }
  }
  preparedAsar = (JSON.parse(line.slice('UPDATE_READY '.length)) as { asar: string }).asar
  return { ok: true }
}

/** Austausch einem eigenen Prozess übergeben, der wartet, bis die App beendet ist – dann beenden */
function apply(): boolean {
  if (SOURCE === 'github') {
    // Vor dem Beenden setzen: das Fenster fragt sonst nach ungespeicherten Änderungen und hält die App offen
    updating = true
    updating = installGithub()
    return updating
  }
  if (!preparedAsar || !existsSync(preparedAsar)) return false
  const child = spawn(
    'node',
    [
      join(projectDir(), SCRIPT),
      '--anwenden', preparedAsar,
      '--warte-auf', String(process.pid),
      '--ziel', process.resourcesPath,
      '--exe', process.execPath,
      '--status', statusFile()
    ],
    { cwd: projectDir(), detached: true, stdio: 'ignore', windowsHide: true }
  )
  child.unref()
  updating = true
  app.quit()
  return true
}

/** Ergebnis eines Updates, das vor diesem Start lief (einmalig) */
function lastUpdate(): LastUpdate | null {
  if (SOURCE === 'github') return lastGithub()
  const file = statusFile()
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8')) as LastUpdate
    rmSync(file, { force: true })
    return { ok: !!raw.ok, message: String(raw.message ?? '') }
  } catch {
    return null
  }
}

export function registerUpdater(): void {
  ipcMain.handle('update:check', () => checkForUpdate())
  ipcMain.handle('update:prepare', () => prepare())
  ipcMain.handle('update:apply', () => apply())
  ipcMain.handle('update:last', () => lastUpdate())
}
