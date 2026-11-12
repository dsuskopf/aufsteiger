import { ROLES, type Player, type Role, type Team } from './types'

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
      const positions = (Array.isArray(p.positions) ? p.positions : []).filter((r): r is Role =>
        ROLES.includes(r as Role)
      )
      players.push({
        id: p.id,
        name: typeof p.name === 'string' ? p.name.slice(0, 80) : '',
        number: clampNumber(p.number),
        positions: [...new Set(positions)]
      })
    }
    teams.push({ id: t.id, name: typeof t.name === 'string' ? t.name.slice(0, 80) : 'Team', players })
  }
  return teams
}

export function clampNumber(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return 0
  return Math.min(99, Math.max(0, v))
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
