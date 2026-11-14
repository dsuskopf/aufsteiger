/**
 * Aussehen der Spielerfiguren in 3D: Körperbau (Mann/Frau), Hautton, Frisur und Haarfarbe.
 * Ohne eigene Angaben bekommt jeder Spieler ein zufälliges, aber festes Aussehen (aus seiner ID abgeleitet –
 * es bleibt bei jedem Start gleich). Der Körperbau folgt dem Team (Männer, Frauen oder gemischt).
 */

export type Body = 'm' | 'f'
/** Team: Männer, Frauen oder gemischt (dann je Spieler zufällig) */
export type TeamGender = Body | 'mixed'

export const TEAM_GENDERS: readonly TeamGender[] = ['m', 'f', 'mixed']
export const TEAM_GENDER_LABELS: Record<TeamGender, string> = { m: 'Männer', f: 'Frauen', mixed: 'Gemischt' }
export const BODY_LABELS: Record<Body, string> = { m: 'Mann', f: 'Frau' }

/** Eigene Angaben eines Spielers; was fehlt, wird zufällig gewählt */
export interface Look {
  body?: Body
  /** Index in SKIN_TONES */
  skin?: number
  /** Frisur (Name aus HAIR_STYLES des Körperbaus) */
  hair?: string
  /** Index in HAIR_COLORS */
  hairColor?: number
}

/** Fertig aufgelöstes Aussehen */
export interface ResolvedLook {
  body: Body
  skin: string
  hair: string
  hairColor: string
}

export const SKIN_TONES = ['#f3d2b6', '#e4b38f', '#cc9370', '#a8714c', '#7f5034', '#5c3824'] as const
export const HAIR_COLORS = ['#17110e', '#3a2416', '#5e3a1f', '#8f5e2f', '#c4933f', '#8c3a1c', '#b9b5b0'] as const
export const HAIR_COLOR_NAMES = ['Schwarz', 'Dunkelbraun', 'Braun', 'Hellbraun', 'Blond', 'Rot', 'Grau']

export const HAIR_STYLES: Record<Body, readonly { id: string; label: string }[]> = {
  m: [
    { id: 'kurz', label: 'Kurz' },
    { id: 'raspel', label: 'Raspelkurz' },
    { id: 'locken', label: 'Locken' },
    { id: 'glatze', label: 'Glatze' }
  ],
  f: [
    { id: 'zopf', label: 'Pferdeschwanz' },
    { id: 'dutt', label: 'Dutt' },
    { id: 'bob', label: 'Kurz' },
    { id: 'zoepfe', label: 'Zöpfe' }
  ]
}

/** Einfacher, fester Zufall aus einer Zeichenkette (FNV-1a) */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
const pick = (seed: number, salt: number, n: number) => hashString(`${seed}:${salt}`) % n

/** Körperbau eines Spielers: eigene Angabe, sonst nach Team (gemischt: zufällig) */
export function bodyOf(gender: TeamGender | undefined, playerId: string, look?: Look): Body {
  if (look?.body) return look.body
  if (gender === 'f') return 'f'
  if (gender === 'mixed') return pick(hashString(playerId), 1, 2) === 0 ? 'm' : 'f'
  return 'm'
}

/** Aussehen eines Spielers; was nicht festgelegt ist, kommt fest-zufällig aus seiner ID */
export function resolveLook(gender: TeamGender | undefined, playerId: string, look?: Look): ResolvedLook {
  const seed = hashString(playerId)
  const body = bodyOf(gender, playerId, look)
  const styles = HAIR_STYLES[body]
  const hair = look?.hair && styles.some((s) => s.id === look.hair) ? look.hair : styles[pick(seed, 2, styles.length)].id
  const skin = look?.skin !== undefined && SKIN_TONES[look.skin] ? look.skin : pick(seed, 3, SKIN_TONES.length)
  // Grau nur, wenn man es ausdrücklich wählt
  const hc = look?.hairColor !== undefined && HAIR_COLORS[look.hairColor] ? look.hairColor : pick(seed, 4, HAIR_COLORS.length - 1)
  return { body, skin: SKIN_TONES[skin], hair, hairColor: HAIR_COLORS[hc] }
}

/** Gespeicherte Angaben prüfen; ungültige Teile fallen weg */
export function sanitizeLook(raw: unknown): Look | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as Record<string, unknown>
  const out: Look = {}
  if (r.body === 'm' || r.body === 'f') out.body = r.body
  if (Number.isInteger(r.skin) && SKIN_TONES[r.skin as number]) out.skin = r.skin as number
  if (Number.isInteger(r.hairColor) && HAIR_COLORS[r.hairColor as number]) out.hairColor = r.hairColor as number
  if (typeof r.hair === 'string' && Object.values(HAIR_STYLES).some((l) => l.some((s) => s.id === r.hair))) out.hair = r.hair
  return Object.keys(out).length ? out : undefined
}
