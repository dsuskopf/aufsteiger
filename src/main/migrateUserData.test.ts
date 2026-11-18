import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateFolder, migrateUserData } from './migrateUserData'

let root: string
const OLD = 'Volleyball Playbook'
const NEW = 'Aufsteiger'

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vbp-migrate-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

function makeOld(): void {
  mkdirSync(join(root, OLD, 'plays'), { recursive: true })
  writeFileSync(join(root, OLD, 'teams.json'), '{"teams":1}')
  writeFileSync(join(root, OLD, 'plays', 'a.json'), '{}')
}

describe('migrateUserData', () => {
  it('benennt den alten Ordner um', () => {
    makeOld()
    expect(migrateUserData(root, OLD, NEW)).toBe(join(root, NEW))
    expect(existsSync(join(root, OLD))).toBe(false)
    expect(readFileSync(join(root, NEW, 'teams.json'), 'utf-8')).toBe('{"teams":1}')
    expect(existsSync(join(root, NEW, 'plays', 'a.json'))).toBe(true)
  })

  it('ersetzt einen neuen Ordner, der nur Caches enthält', () => {
    makeOld()
    mkdirSync(join(root, NEW, 'GPUCache'), { recursive: true })
    expect(migrateUserData(root, OLD, NEW)).toBe(join(root, NEW))
    expect(existsSync(join(root, NEW, 'teams.json'))).toBe(true)
    expect(existsSync(join(root, OLD))).toBe(false)
  })

  it('lässt beide Ordner in Ruhe, wenn der neue schon Nutzerdaten hat', () => {
    makeOld()
    mkdirSync(join(root, NEW), { recursive: true })
    writeFileSync(join(root, NEW, 'settings.json'), '{}')
    expect(migrateUserData(root, OLD, NEW)).toBe(join(root, NEW))
    expect(existsSync(join(root, OLD, 'teams.json'))).toBe(true)
  })

  it('nimmt den neuen Ordner, wenn es keinen alten gibt', () => {
    expect(migrateUserData(root, OLD, NEW)).toBe(join(root, NEW))
    expect(existsSync(join(root, NEW))).toBe(false)
  })

  it('ignoriert einen alten Ordner ohne Nutzerdaten', () => {
    mkdirSync(join(root, OLD, 'Cache'), { recursive: true })
    expect(migrateUserData(root, OLD, NEW)).toBe(join(root, NEW))
    expect(existsSync(join(root, OLD))).toBe(true)
  })
})

describe('migrateFolder', () => {
  it('benennt den alten Exportordner um', () => {
    mkdirSync(join(root, 'Volleyball-Spielzüge'))
    writeFileSync(join(root, 'Volleyball-Spielzüge', 'A1.pdf'), 'x')
    expect(migrateFolder(root, 'Volleyball-Spielzüge', 'Aufsteiger-Spielzüge')).toBe(join(root, 'Aufsteiger-Spielzüge'))
    expect(existsSync(join(root, 'Aufsteiger-Spielzüge', 'A1.pdf'))).toBe(true)
    expect(existsSync(join(root, 'Volleyball-Spielzüge'))).toBe(false)
  })

  it('lässt beide stehen, wenn der neue schon existiert', () => {
    mkdirSync(join(root, 'Volleyball-Spielzüge'))
    mkdirSync(join(root, 'Aufsteiger-Spielzüge'))
    expect(migrateFolder(root, 'Volleyball-Spielzüge', 'Aufsteiger-Spielzüge')).toBe(join(root, 'Aufsteiger-Spielzüge'))
    expect(existsSync(join(root, 'Volleyball-Spielzüge'))).toBe(true)
  })

  it('nimmt den neuen, wenn es keinen alten gibt', () => {
    expect(migrateFolder(root, 'Volleyball-Spielzüge', 'Aufsteiger-Spielzüge')).toBe(join(root, 'Aufsteiger-Spielzüge'))
  })
})
