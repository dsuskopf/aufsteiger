import { describe, expect, it } from 'vitest'
import { isNewer, shortCommit } from './update'

describe('isNewer', () => {
  it('gleicher Stand → kein Update', () => expect(isNewer('abc', 'abc', true)).toBe(false))
  it('Projekt hat neuere Commits → Update', () => expect(isNewer('abc', 'def', false)).toBe(true))
  it('Projekt ist älter als die installierte App → kein Update', () => expect(isNewer('def', 'abc', true)).toBe(false))
  it('Build-Commit unbekannt → Update anbieten', () => expect(isNewer('', 'abc', false)).toBe(true))
  it('Projekt-Commit unbekannt → kein Update', () => expect(isNewer('abc', '', false)).toBe(false))
})

describe('shortCommit', () => {
  it('kürzt auf 7 Zeichen', () => expect(shortCommit('0123456789abcdef')).toBe('0123456'))
  it('leer → unbekannt', () => expect(shortCommit('')).toBe('unbekannt'))
})
