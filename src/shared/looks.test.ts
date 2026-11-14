import { describe, expect, it } from 'vitest'
import { HAIR_STYLES, SKIN_TONES, bodyOf, resolveLook, sanitizeLook } from './looks'

describe('Aussehen der Figuren', () => {
  it('ohne Angaben fest-zufällig: gleiche ID → gleiches Aussehen, Körperbau nach Team', () => {
    expect(resolveLook('m', 'abc')).toEqual(resolveLook('m', 'abc'))
    expect(resolveLook(undefined, 'abc').body).toBe('m')
    expect(resolveLook('f', 'abc').body).toBe('f')
    expect(HAIR_STYLES.f.some((s) => s.id === resolveLook('f', 'abc').hair)).toBe(true)
    // Gemischt: beide Körperbauten kommen vor
    const bodies = new Set(Array.from({ length: 40 }, (_, i) => bodyOf('mixed', `p${i}`)))
    expect(bodies.size).toBe(2)
  })

  it('eigene Angaben haben Vorrang; eine Frisur des anderen Körperbaus wird ersetzt', () => {
    const l = resolveLook('m', 'abc', { body: 'f', skin: 2, hair: 'dutt', hairColor: 4 })
    expect(l).toMatchObject({ body: 'f', skin: SKIN_TONES[2], hair: 'dutt' })
    expect(HAIR_STYLES.m.some((s) => s.id === resolveLook('m', 'abc', { hair: 'dutt' }).hair)).toBe(true)
  })

  it('prüft gespeicherte Angaben', () => {
    expect(sanitizeLook({ body: 'x', skin: 99, hair: 'irokese', hairColor: -1 })).toBeUndefined()
    expect(sanitizeLook({ body: 'f', skin: 1, hair: 'zopf' })).toEqual({ body: 'f', skin: 1, hair: 'zopf' })
  })
})
