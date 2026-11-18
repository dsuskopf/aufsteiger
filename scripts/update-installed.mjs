// Aktualisiert die installierte App auf den Stand dieses Projektordners – ohne neuen Installer.
//
// Aufruf: npm run update-installiert   (oder Doppelklick auf Update.cmd)
//
// Der ganze App-Code steckt in <Installationsordner>\resources\app.asar (out/ + package.json).
// Electron selbst, die Verknüpfungen und der Eintrag unter „Apps“ bleiben unverändert, deshalb genügt es,
// diese eine Datei auszutauschen. Einen neuen Installer braucht es erst wieder, wenn sich Electron,
// electron-builder.yml, das Icon oder der Installer (build/installer.nsh) ändern.

import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { createPackage } from '@electron/asar'
import { getCurrentFuseWire, FuseV1Options } from '@electron/fuses'

const ROOT = join(import.meta.dirname, '..')
const EXE = 'Aufsteiger.exe'
// electron-builder leitet diese ID aus der appId (de.volleyball.playbook) ab; dort steht InstallLocation.
const INSTALL_KEY = 'Software\\35e6c273-f5ce-5a52-846e-dedb1f4ac48d'

const fail = (msg) => {
  console.error(`\nFEHLER: ${msg}`)
  process.exit(1)
}
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

function installDir() {
  // Nur für Tests: anderen Ordner (z. B. eine Kopie von dist\win-unpacked) aktualisieren
  if (process.env['AUFSTEIGER_INSTALL_DIR']) return process.env['AUFSTEIGER_INSTALL_DIR']
  for (const hive of ['HKLM', 'HKCU']) {
    const r = spawnSync('reg', ['query', `${hive}\\${INSTALL_KEY}`, '/v', 'InstallLocation'], { encoding: 'utf8' })
    const m = r.status === 0 && r.stdout.match(/InstallLocation\s+REG_SZ\s+(.+)/)
    if (m) return m[1].trim()
  }
  return null
}

function isRunning() {
  const r = spawnSync('tasklist', ['/FI', `IMAGENAME eq ${EXE}`, '/NH'], { encoding: 'utf8' })
  return r.stdout.toLowerCase().includes(EXE.toLowerCase())
}

// 1. Installation finden
const dir = installDir()
if (!dir || !existsSync(join(dir, EXE))) fail('Aufsteiger ist nicht installiert. Bitte einmal mit dem Installer installieren.')
const target = join(dir, 'resources', 'app.asar')
console.log(`Installation: ${dir}`)

// Austausch nur erlaubt, wenn Electron die app.asar nicht gegen einen eingebauten Hash prüft
const wire = await getCurrentFuseWire(join(dir, EXE))
if (wire[FuseV1Options.EnableEmbeddedAsarIntegrityValidation] === '1'.charCodeAt(0)) {
  fail('Diese Installation prüft die app.asar (ASAR-Integrität). Bitte den Installer neu bauen (npm run dist).')
}

// 2. App bauen (Typprüfung + electron-vite)
console.log('\nBaue die App …')
if (spawnSync('npm run build', { cwd: ROOT, stdio: 'inherit', shell: true }).status !== 0) {
  fail('Der Build ist fehlgeschlagen – die installierte App wurde nicht verändert.')
}

// 3. app.asar packen – gleicher Inhalt wie bei electron-builder: out/ + verkürzte package.json
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const tmp = mkdtempSync(join(tmpdir(), 'aufsteiger-update-'))
const stage = join(tmp, 'app')
cpSync(join(ROOT, 'out'), join(stage, 'out'), { recursive: true })
const keep = ['name', 'productName', 'version', 'description', 'main', 'private', 'dependencies']
writeFileSync(join(stage, 'package.json'), JSON.stringify(Object.fromEntries(keep.filter((k) => k in pkg).map((k) => [k, pkg[k]])), null, 2))
const asar = join(tmp, 'app.asar')
await createPackage(stage, asar)

// 4. Laufende App schließen lassen (die Datei ist sonst gesperrt)
if (isRunning()) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  while (isRunning()) {
    await rl.question('\nAufsteiger läuft noch. Bitte die App schließen und dann Enter drücken … ')
  }
  rl.close()
}

// 5. Austauschen – im Programmordner braucht das Administratorrechte (Windows fragt nach)
try {
  copyFileSync(asar, target)
} catch (e) {
  if (e.code !== 'EPERM' && e.code !== 'EACCES') throw e
  console.log('\nWindows fragt jetzt nach Administratorrechten (zum Schreiben in den Programmordner).')
  const cmd = `/c copy /Y "${asar}" "${target}"`
  const ps = `Start-Process -FilePath cmd.exe -ArgumentList '${cmd.replace(/'/g, "''")}' -Verb RunAs -Wait -WindowStyle Hidden`
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'inherit' })
  } catch {
    // abgelehnt → unten über den Vergleich gemeldet
  }
}

if (!existsSync(target) || statSync(target).size !== statSync(asar).size || sha(target) !== sha(asar)) {
  rmSync(tmp, { recursive: true, force: true })
  fail('Die neue Version konnte nicht kopiert werden (Administratorrechte abgelehnt?). Die installierte App ist unverändert.')
}
rmSync(tmp, { recursive: true, force: true })

console.log('\nFertig: Die installierte App ist auf dem neuesten Stand.')
if (!process.argv.includes('--nicht-starten')) {
  spawn(join(dir, EXE), [], { detached: true, stdio: 'ignore' }).unref()
  console.log('Aufsteiger wird gestartet.')
}
