import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'

/** Dateien liegen im App-Datenverzeichnis (z. B. %APPDATA%\volleyball-playbook). */
export function dataPath(...parts: string[]): string {
  return join(app.getPath('userData'), ...parts)
}

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    const text = await fs.readFile(dataPath(file), 'utf-8')
    return JSON.parse(text) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    // Beschädigte Datei nicht überschreiben, sondern beiseitelegen
    if (err instanceof SyntaxError) {
      const target = dataPath(file)
      await fs.rename(target, `${target}.defekt-${Date.now()}`).catch(() => {})
      return null
    }
    throw err
  }
}

/** Atomar schreiben: erst in eine temporäre Datei, dann umbenennen. */
export async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  const target = dataPath(file)
  await fs.mkdir(dirname(target), { recursive: true })
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tmp, target)
}
