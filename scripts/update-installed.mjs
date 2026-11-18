// Aktualisiert die installierte App auf den Stand dieses Projektordners – ohne neuen Installer.
//
// Der ganze App-Code steckt in <Installationsordner>\resources\app.asar (out/ + package.json).
// Electron selbst, die Verknüpfungen und der Eintrag unter „Apps“ bleiben unverändert, deshalb genügt es,
// diese eine Datei auszutauschen. Einen neuen Installer braucht es erst wieder, wenn sich Electron,
// electron-builder.yml, das Icon oder der Installer (build/installer.nsh) ändern.
//
// Aufrufe:
//   node scripts/update-installed.mjs                 alles in einem (Update.cmd / npm run update-installiert)
//   … --vorbereiten                                   nur bauen + packen; letzte Zeile: UPDATE_READY {"asar": …}
//   … --anwenden <asar> --warte-auf <pid> --ziel <resources> --exe <Aufsteiger.exe> --status <datei>
//                                                     (von der App selbst): warten, bis sie beendet ist,
//                                                     austauschen, Ergebnis in <datei> schreiben, neu starten
// Optionen: --nicht-starten   App danach nicht starten
// Nur für Tests: AUFSTEIGER_INSTALL_DIR=<Ordner> statt der installierten App

import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { createPackage } from '@electron/asar'
import { getCurrentFuseWire, FuseV1Options } from '@electron/fuses'

const ROOT = join(import.meta.dirname, '..')
const EXE = 'Aufsteiger.exe'
// electron-builder leitet diese ID aus der appId (de.volleyball.playbook) ab; dort steht InstallLocation.
const INSTALL_KEY = 'Software\\35e6c273-f5ce-5a52-846e-dedb1f4ac48d'

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const opt = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

class UpdateError extends Error {}
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function installDir() {
  if (process.env['AUFSTEIGER_INSTALL_DIR']) return process.env['AUFSTEIGER_INSTALL_DIR']
  for (const hive of ['HKLM', 'HKCU']) {
    const r = spawnSync('reg', ['query', `${hive}\\${INSTALL_KEY}`, '/v', 'InstallLocation'], { encoding: 'utf8' })
    const m = r.status === 0 && r.stdout.match(/InstallLocation\s+REG_SZ\s+(.+)/)
    if (m) return m[1].trim()
  }
  return null
}

function isRunning() {
  const r = spawnSync('tasklist', ['/FI', `IMAGENAME eq ${EXE}`, '/NH'], { encoding: 'utf8', windowsHide: true })
  return r.stdout.toLowerCase().includes(EXE.toLowerCase())
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Austausch nur erlaubt, wenn Electron die app.asar nicht gegen einen eingebauten Hash prüft */
async function checkFuses(exe) {
  const wire = await getCurrentFuseWire(exe)
  if (wire[FuseV1Options.EnableEmbeddedAsarIntegrityValidation] === '1'.charCodeAt(0)) {
    throw new UpdateError('Diese Installation prüft die app.asar (ASAR-Integrität). Bitte den Installer neu bauen (npm run dist).')
  }
}

/** App bauen (Typprüfung + electron-vite) und app.asar packen – wie electron-builder: out/ + verkürzte package.json */
async function buildAndPack(quiet) {
  const r = spawnSync('npm run build', { cwd: ROOT, stdio: quiet ? 'pipe' : 'inherit', shell: true, encoding: 'utf8', windowsHide: true })
  if (r.status !== 0) {
    if (quiet) process.stdout.write(`${r.stdout ?? ''}${r.stderr ?? ''}`)
    throw new UpdateError('Der Build ist fehlgeschlagen – die installierte App wurde nicht verändert.')
  }
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const tmp = mkdtempSync(join(tmpdir(), 'aufsteiger-update-'))
  const stage = join(tmp, 'app')
  cpSync(join(ROOT, 'out'), join(stage, 'out'), { recursive: true })
  const keep = ['name', 'productName', 'version', 'description', 'main', 'private', 'dependencies']
  writeFileSync(join(stage, 'package.json'), JSON.stringify(Object.fromEntries(keep.filter((k) => k in pkg).map((k) => [k, pkg[k]])), null, 2))
  const asar = join(tmp, 'app.asar')
  await createPackage(stage, asar)
  rmSync(stage, { recursive: true, force: true })
  return asar
}

/** app.asar austauschen – im Programmordner braucht das Administratorrechte (Windows fragt nach) */
function install(asar, target, log) {
  try {
    copyFileSync(asar, target)
  } catch (e) {
    if (e.code !== 'EPERM' && e.code !== 'EACCES') throw e
    log('Windows fragt jetzt nach Administratorrechten (zum Schreiben in den Programmordner).')
    const cmd = `/c copy /Y "${asar}" "${target}"`
    const ps = `Start-Process -FilePath cmd.exe -ArgumentList '${cmd.replace(/'/g, "''")}' -Verb RunAs -Wait -WindowStyle Hidden`
    try {
      execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'ignore', windowsHide: true })
    } catch {
      // abgelehnt → unten über den Vergleich gemeldet
    }
  }
  if (!existsSync(target) || statSync(target).size !== statSync(asar).size || sha(target) !== sha(asar)) {
    throw new UpdateError('Die neue Version konnte nicht eingesetzt werden (Administratorrechte abgelehnt?). Es läuft weiter die bisherige Version.')
  }
}

const startApp = (exe) => spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()

// ---------------------------------------------------------------- Modi
async function prepareMode() {
  const asar = await buildAndPack(true)
  console.log(`UPDATE_READY ${JSON.stringify({ asar })}`)
}

async function applyMode() {
  const asar = opt('--anwenden')
  const resources = opt('--ziel')
  const exe = opt('--exe')
  const status = opt('--status')
  const pid = Number(opt('--warte-auf'))
  const writeStatus = (ok, message) => {
    if (status) writeFileSync(status, JSON.stringify({ ok, message }))
  }
  try {
    if (!asar || !resources || !exe) throw new UpdateError('Aufruf unvollständig.')
    // Warten, bis die App (und ihre Unterprozesse) beendet sind – sonst ist die app.asar gesperrt
    for (let i = 0; i < 150 && (pidAlive(pid) || isRunning()); i++) await sleep(200)
    if (isRunning()) throw new UpdateError('Aufsteiger wurde nicht rechtzeitig beendet.')
    await checkFuses(exe)
    install(asar, join(resources, 'app.asar'), () => {})
    writeStatus(true, 'Aufsteiger wurde aktualisiert.')
  } catch (e) {
    writeStatus(false, e instanceof UpdateError ? e.message : `Update fehlgeschlagen: ${e?.message ?? e}`)
  } finally {
    if (asar) rmSync(dirname(asar), { recursive: true, force: true })
  }
  if (exe && !flag('--nicht-starten')) startApp(exe)
}

async function fullMode() {
  const dir = installDir()
  if (!dir || !existsSync(join(dir, EXE))) throw new UpdateError('Aufsteiger ist nicht installiert. Bitte einmal mit dem Installer installieren.')
  console.log(`Installation: ${dir}`)
  await checkFuses(join(dir, EXE))

  console.log('\nBaue die App …')
  const asar = await buildAndPack(false)
  try {
    if (isRunning()) {
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      while (isRunning()) await rl.question('\nAufsteiger läuft noch. Bitte die App schließen und dann Enter drücken … ')
      rl.close()
    }
    install(asar, join(dir, 'resources', 'app.asar'), (m) => console.log(`\n${m}`))
  } finally {
    rmSync(dirname(asar), { recursive: true, force: true })
  }
  console.log('\nFertig: Die installierte App ist auf dem neuesten Stand.')
  if (!flag('--nicht-starten')) {
    startApp(join(dir, EXE))
    console.log('Aufsteiger wird gestartet.')
  }
}

try {
  if (flag('--vorbereiten')) await prepareMode()
  else if (flag('--anwenden')) await applyMode()
  else await fullMode()
} catch (e) {
  console.error(`\nFEHLER: ${e instanceof UpdateError ? e.message : (e?.stack ?? e)}`)
  process.exit(1)
}
