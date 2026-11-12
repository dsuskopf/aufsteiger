import {
  MAX_PLAYERS_PER_SIDE,
  ROLES,
  type CourtPlayer,
  type CourtSide,
  type Player,
  type Role,
  type Team
} from '@shared/types'
import { COURT } from '@renderer/core/geometry/court'

/**
 * Grundaufstellung (Rotation 1, 5-1-System) für Seite A (x < 0, Blick Richtung Netz = +x).
 * Positionen 1–6 wie im Volleyball: 2/3/4 vorne (rechts → links), 1/6/5 hinten.
 * Rechts aus Sicht der Spieler auf Seite A ist −y.
 */
export const SLOT_POSITIONS_A: Record<number, { x: number; y: number }> = {
  1: { x: -6.5, y: -3 },
  2: { x: -1.5, y: -3 },
  3: { x: -1.5, y: 0 },
  4: { x: -1.5, y: 3 },
  5: { x: -6.5, y: 3 },
  6: { x: -6.5, y: 0 }
}

/** Rolle je Position in Rotation 1: Steller auf 1, Diagonal gegenüber auf 4. */
export const SLOT_ROLES: Record<number, Role> = { 1: 'S', 2: 'AA', 3: 'MB', 4: 'DA', 5: 'AA', 6: 'MB' }

export const SLOT_ORDER = [1, 2, 3, 4, 5, 6] as const

export function slotPosition(side: CourtSide, slot: number): { x: number; y: number } {
  const p = SLOT_POSITIONS_A[slot]
  // Seite B ist punktgespiegelt an der Feldmitte
  return side === 'A' ? { x: p.x, y: p.y } : { x: -p.x, y: -p.y }
}

/** Erste Position des Spielers, sonst Außenangreifer. */
export function primaryRole(p: Player): Role {
  return p.positions[0] ?? 'AA'
}

/** Rollen, die man für den Spieler wählen kann (seine Positionen, ohne Angabe alle). */
export function selectableRoles(p: Player): Role[] {
  return p.positions.length > 0 ? p.positions : [...ROLES]
}

/** Spieler dürfen im Feld und in der Freizone stehen. */
export function clampToArea(x: number, y: number): { x: number; y: number } {
  const mx = COURT.halfLength + COURT.freeZone - 0.3
  const my = COURT.halfWidth + COURT.freeZone - 0.3
  return { x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) }
}

/**
 * Automatische Aufstellung: Pro Position wird ein passender Spieler gesucht (Hauptposition zuerst,
 * dann Nebenposition). Liberos werden nicht automatisch aufgestellt. Freie Plätze füllen übrige Spieler.
 */
export function autoLineup(team: Team, side: CourtSide): CourtPlayer[] {
  const used = new Set<string>()
  const bySlot = new Map<number, { player: Player; role: Role }>()

  const pick = (slot: number, match: (p: Player, role: Role) => boolean) => {
    const role = SLOT_ROLES[slot]
    const p = team.players.find((pl) => !used.has(pl.id) && match(pl, role))
    if (p) {
      used.add(p.id)
      bySlot.set(slot, { player: p, role })
    }
  }
  for (const slot of SLOT_ORDER) pick(slot, (p, role) => p.positions[0] === role)
  for (const slot of SLOT_ORDER) if (!bySlot.has(slot)) pick(slot, (p, role) => p.positions.includes(role))
  for (const slot of SLOT_ORDER) {
    if (bySlot.has(slot)) continue
    const p = team.players.find((pl) => !used.has(pl.id) && primaryRole(pl) !== 'L')
    if (p) {
      used.add(p.id)
      bySlot.set(slot, { player: p, role: primaryRole(p) })
    }
  }

  return SLOT_ORDER.filter((s) => bySlot.has(s)).map((slot) => {
    const { player, role } = bySlot.get(slot)!
    return { playerId: player.id, role, ...slotPosition(side, slot) }
  })
}

/** Fügt einen Spieler hinzu (max. 6) – auf die erste freie Grundposition. */
export function addToLineup(current: CourtPlayer[], player: Player, side: CourtSide): CourtPlayer[] {
  if (current.length >= MAX_PLAYERS_PER_SIDE || current.some((c) => c.playerId === player.id)) return current
  const free =
    SLOT_ORDER.find((slot) => {
      const p = slotPosition(side, slot)
      return !current.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 0.6)
    }) ?? 1
  return [...current, { playerId: player.id, role: primaryRole(player), ...slotPosition(side, free) }]
}

/**
 * Hält die Aufstellung mit dem Team synchron: entfernte Spieler fallen heraus,
 * Rollen, die der Spieler nicht mehr hat, werden auf seine Hauptposition gesetzt.
 * Gibt bei unveränderter Aufstellung dasselbe Array zurück.
 */
export function syncWithTeam(current: CourtPlayer[], team: Team | undefined): CourtPlayer[] {
  if (!team) return current.length === 0 ? current : []
  const byId = new Map(team.players.map((p) => [p.id, p]))
  const next = current
    .filter((c) => byId.has(c.playerId))
    .map((c) => {
      const p = byId.get(c.playerId)!
      return selectableRoles(p).includes(c.role) ? c : { ...c, role: primaryRole(p) }
    })
  const changed = next.length !== current.length || next.some((c, i) => c !== current[i])
  return changed ? next : current
}
