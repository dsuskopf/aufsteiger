import { PLAYER_HEIGHT, ROLES, type Player, type Role, type Team } from './types'
import { DEFAULT_LIBERO_COLOR, DEFAULT_TEAM_COLOR, isHexColor, pairedLibero } from './teamColors'

/** Alte Rollenkürzel (bis Phase 2) auf die neuen abbilden */
const LEGACY_ROLES: Record<string, Role> = { AA: 'A', DA: 'D' }

/**
 * Prüft und bereinigt Team-Daten (aus Datei oder vom Renderer).
 * Ungültige Einträge werden verworfen statt die ganze Datei abzulehnen.
 */
export function sanitizeTeams(raw: unknown): Team[] {
  const list = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.teams) ? raw.teams : []
  const teams: Team[] = []
  for (const t of list) {
    if (!isObj(t) || typeof t.id !== 'string') continue
    const players: Player[] = []
    for (const p of Array.isArray(t.players) ? t.players : []) {
      if (!isObj(p) || typeof p.id !== 'string') continue
      const positions = (Array.isArray(p.positions) ? p.positions : [])
        .map((r) => (typeof r === 'string' && r in LEGACY_ROLES ? LEGACY_ROLES[r] : r))
        .filter((r): r is Role => ROLES.includes(r as Role))
      players.push({
        id: p.id,
        name: typeof p.name === 'string' ? p.name.slice(0, 80) : '',
        number: clampNumber(p.number),
        positions: [...new Set(positions)],
        height: clampHeight(p.height)
      })
    }
    const color = isHexColor(t.color) ? t.color.toLowerCase() : DEFAULT_TEAM_COLOR
    teams.push({
      id: t.id,
      name: typeof t.name === 'string' ? t.name.slice(0, 80) : 'Team',
      color,
      // Ohne gespeicherte Libero-Farbe: der passende Partner der Trikotfarbe
      liberoColor: isHexColor(t.liberoColor) ? t.liberoColor.toLowerCase() : (pairedLibero(color) ?? DEFAULT_LIBERO_COLOR),
      players
    })
  }
  return teams
}

/** Körpergröße auf 1,0–2,3 m begrenzen, auf Zentimeter runden; ohne Angabe 1,75 m */
export function clampHeight(h: unknown): number {
  const v = Number(h)
  if (h === undefined || h === null || h === '' || !Number.isFinite(v)) return PLAYER_HEIGHT.default
  return Math.round(Math.min(PLAYER_HEIGHT.max, Math.max(PLAYER_HEIGHT.min, v)) * 100) / 100
}

export function clampNumber(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return 0
  return Math.min(99, Math.max(0, v))
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
