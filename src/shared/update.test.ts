import { describe, expect, it } from 'vitest'
import { isNewer, releaseNotesToLines, shortCommit } from './update'

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

describe('releaseNotesToLines', () => {
  it('HTML-Liste → Zeilen', () =>
    expect(releaseNotesToLines('<h2>What&#39;s Changed</h2><ul><li>Neue Skizze</li><li>Fehler &amp; Absturz behoben</li></ul>')).toEqual([
      'Neue Skizze',
      'Fehler & Absturz behoben'
    ]))
  it('Markdown von GitHub ohne Autor, Link und Changelog', () =>
    expect(
      releaseNotesToLines("## What's Changed\n* Update aus GitHub by @someone in https://github.com/x/y/pull/1\n\n**Full Changelog**: https://github.com/x/y/compare/v1...v2")
    ).toEqual(['Update aus GitHub']))
  it('Liste je Version', () => expect(releaseNotesToLines([{ version: '1', note: '- A' }, { version: '2', note: null }])).toEqual(['A']))
  it('nichts → leer', () => expect(releaseNotesToLines(null)).toEqual([]))
})
