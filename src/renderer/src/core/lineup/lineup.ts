import {
  MAX_PLAYERS_PER_SIDE,
  ROLES,
  type CourtPlayer,
  type CourtSide,
  type PlaySide,
  type Player,
  type Role,
  type Team
} from '@shared/types'
import { COURT } from '@renderer/core/geometry/court'

/**
 * Aufstellung mit festen Positionen 1–6 (wie im Volleyball): 2/3/4 vorne (rechts → links), 1/6/5 hinten.
 * Jeder Spieler auf dem Feld hat eine Position („slot“); der Libero übernimmt die Position des Hinterfeldspielers,
 * den er ersetzt (PlaySide.liberoFor). Koordinaten für Seite A (x < 0, Blick Richtung Netz = +x, rechts = −y).
 */
export const SLOT_POSITIONS_A: Record<number, { x: number; y: number }> = {
  1: { x: -6.5, y: -3 },
  2: { x: -1.5, y: -3 },
  3: { x: -1.5, y: 0 },
  4: { x: -1.5, y: 3 },
  5: { x: -6.5, y: 3 },
  6: { x: -6.5, y: 0 }
}

/**
 * Grundaufstellung: Steller auf 2, Mittelblocker auf 3, Außen auf 4; hinten Diagonal (oder 2. Steller) auf 5,
 * 2. Mittelblocker auf 6, 2. Außen auf 1. Gegenüberliegende Positionen haben dieselbe Rolle (Rotationsordnung).
 */
export const SLOT_ROLES: Record<number, Role> = { 1: 'A', 2: 'S', 3: 'MB', 4: 'A', 5: 'D', 6: 'MB' }

export const SLOT_ORDER = [1, 2, 3, 4, 5, 6] as const
export const BACK_ROW = [1, 6, 5] as const
export const isBackRow = (slot: number | undefined) => slot === 1 || slot === 5 || slot === 6

export function slotPosition(side: CourtSide, slot: number): { x: number; y: number } {
  const p = SLOT_POSITIONS_A[slot]
  // Seite B ist punktgespiegelt an der Feldmitte
  return side === 'A' ? { x: p.x, y: p.y } : { x: -p.x, y: -p.y }
}

/** Erste Position des Spielers, sonst Außenangreifer. */
export function primaryRole(p: Player): Role {
  return p.positions[0] ?? 'A'
}

/** Rollen, die man für den Spieler wählen kann (seine Positionen, ohne Angabe alle). */
export function selectableRoles(p: Player): Role[] {
  return p.positions.length > 0 ? p.positions : [...ROLES]
}

export const isLiberoPlayer = (p: Player) => primaryRole(p) === 'L'

/** Spieler dürfen im Feld und in der Freizone stehen. */
export function clampToArea(x: number, y: number): { x: number; y: number } {
  const mx = COURT.halfLength + COURT.freeZone - 0.3
  const my = COURT.halfWidth + COURT.freeZone - 0.3
  return { x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) }
}

/** Libero mit Regeln: nur im Hinterfeld (hinter der 3-m-Linie der eigenen Seite, Freizone erlaubt). */
export function clampLibero(side: CourtSide, x: number, y: number): { x: number; y: number } {
  const c = clampToArea(x, y)
  const a = COURT.attackLineDist
  return { x: side === 'A' ? Math.min(-a, c.x) : Math.max(a, c.x), y: c.y }
}

/* ---------- Regeln der Zusammensetzung ---------- */

/**
 * Erlaubte Zusammensetzung der sechs Feldspieler: 1 Steller + 1 Diagonal oder 2 Steller, 2 Mittelblocker,
 * 2 Außenangreifer – dazu höchstens ein Libero, der einen Hinterfeldspieler ersetzt.
 */
export function roleAllowed(role: Role, others: CourtPlayer[]): boolean {
  const n = (r: Role) => others.filter((c) => c.role === r).length
  switch (role) {
    case 'S':
      return n('S') + n('D') < 2
    case 'D':
      return n('D') < 1 && n('S') + n('D') < 2
    case 'MB':
      return n('MB') < 2
    case 'A':
      return n('A') < 2
    case 'L':
      return n('L') < 1
  }
}

/** Rollen, die der Spieler unter den Regeln einnehmen darf (Reihenfolge: seine Positionen). */
export function allowedRoles(p: Player, onCourt: CourtPlayer[], rules: boolean): Role[] {
  const own = selectableRoles(p)
  if (!rules) return own
  const others = onCourt.filter((c) => c.playerId !== p.id)
  const current = onCourt.find((c) => c.playerId === p.id)
  return own.filter((r) => {
    // Libero ist eine feste Rolle: weder hinein- noch herauswechseln
    if (current && (r === 'L') !== (current.role === 'L')) return false
    return roleAllowed(r, others)
  })
}

/* ---------- Aufstellen ---------- */

const freeSlots = (players: CourtPlayer[]) => SLOT_ORDER.filter((s) => !players.some((c) => c.slot === s))

/** Wen ersetzt der Libero standardmäßig: den Mittelblocker im Hinterfeld, sonst den Hinterfeldspieler auf 6, 5, 1. */
export function defaultLiberoTarget(players: CourtPlayer[]): CourtPlayer | undefined {
  const back = players.filter((c) => c.role !== 'L' && isBackRow(c.slot))
  return back.find((c) => c.role === 'MB') ?? [6, 5, 1].map((s) => back.find((c) => c.slot === s && c.role !== 'S')).find(Boolean) ?? back[0]
}

/** Libero aufs Feld: auf eine freie Hinterfeldposition, sonst für einen Hinterfeldspieler (Standard: Mittelblocker). */
function placeLibero(input: PlaySide, libero: Player, courtSide: CourtSide, replace?: string): PlaySide {
  const side: PlaySide = { ...input }
  delete side.liberoIdle
  const players = side.players.filter((c) => c.playerId !== libero.id)
  const target = replace ? players.find((c) => c.playerId === replace && isBackRow(c.slot)) : undefined
  const freeBack = BACK_ROW.find((s) => !players.some((c) => c.slot === s))
  if (!target && freeBack !== undefined && players.length < MAX_PLAYERS_PER_SIDE)
    return { ...side, players: [...players, { playerId: libero.id, role: 'L', slot: freeBack, ...slotPosition(courtSide, freeBack) }] }
  const t = target ?? defaultLiberoTarget(players)
  if (!t) return side
  return {
    ...side,
    liberoFor: t.playerId,
    liberoRole: t.role,
    players: [...players.filter((c) => c !== t), { playerId: libero.id, role: 'L', slot: t.slot, x: t.x, y: t.y }]
  }
}

/**
 * Grundaufstellung: Steller 2, MB 3, Außen 4 | Diagonal oder 2. Steller 5, MB 6, Außen 1.
 * Hauptpositionen zuerst, dann Nebenpositionen; ein Libero im Team ersetzt den Mittelblocker im Hinterfeld
 * (oder nimmt eine freie Hinterfeldposition). Ohne Regeln werden freie Positionen mit übrigen Spielern gefüllt.
 */
export function autoLineup(team: Team, side: CourtSide, rules = true): PlaySide {
  const used = new Set<string>()
  const bySlot = new Map<number, { player: Player; role: Role }>()
  const regulars = team.players.filter((p) => !isLiberoPlayer(p))
  // Diagonal-Position (5): Diagonalangreifer, sonst zweiter Steller
  const wants = (slot: number): Role[] => (slot === 5 ? ['D', 'S'] : [SLOT_ROLES[slot]])
  // Reihenfolge der Besetzung: Steller zuerst, damit ein reiner Steller nicht als Diagonal-Ersatz verbraucht wird
  const ORDER = [2, 3, 6, 4, 1, 5]

  const take = (slot: number, player: Player, role: Role) => {
    used.add(player.id)
    bySlot.set(slot, { player, role })
  }
  for (const pass of ['primary', 'secondary'] as const)
    for (const slot of ORDER) {
      if (bySlot.has(slot)) continue
      for (const role of wants(slot)) {
        const p = regulars.find((pl) => !used.has(pl.id) && (pass === 'primary' ? pl.positions[0] === role : pl.positions.includes(role)))
        if (p) {
          take(slot, p, role)
          break
        }
      }
    }
  // Übrige Plätze: mit Regeln nur, wenn eine Rolle des Spielers noch erlaubt ist
  for (const slot of ORDER) {
    if (bySlot.has(slot)) continue
    const lineup = [...bySlot.entries()].map(([s, v]) => ({ playerId: v.player.id, role: v.role, slot: s, x: 0, y: 0 }))
    for (const p of regulars) {
      if (used.has(p.id)) continue
      const role = rules ? allowedRoles(p, lineup, true).find((r) => r !== 'L') : primaryRole(p)
      if (role) {
        take(slot, p, role)
        break
      }
    }
  }

  let result: PlaySide = {
    teamId: team.id,
    players: SLOT_ORDER.filter((s) => bySlot.has(s)).map((slot) => {
      const { player, role } = bySlot.get(slot)!
      return { playerId: player.id, role, slot, ...slotPosition(side, slot) }
    })
  }
  const libero = team.players.find(isLiberoPlayer)
  if (libero) result = placeLibero(result, libero, side)
  return result
}

/** Kann der Spieler (mit Regeln) aufs Feld? Gibt den Grund zurück, falls nicht. */
export function addBlocker(side: PlaySide, player: Player, rules: boolean): string | null {
  if (side.players.some((c) => c.playerId === player.id)) return null
  if (side.liberoFor === player.id) return null
  if (rules && (isLiberoPlayer(player) || side.liberoIdle === player.id)) {
    if (side.players.some((c) => c.role === 'L')) return 'Es ist schon ein Libero auf dem Feld'
    return side.players.some((c) => isBackRow(c.slot)) || freeSlots(side.players).some(isBackRow) ? null : 'Kein Hinterfeldspieler zum Ersetzen'
  }
  if (side.players.length >= MAX_PLAYERS_PER_SIDE) return 'Schon 6 Spieler auf dem Feld'
  if (rules && allowedRoles(player, side.players, true).filter((r) => r !== 'L').length === 0)
    return 'Seine Positionen sind schon besetzt (1 Steller + 1 Diagonal oder 2 Steller, 2 MB, 2 Außen)'
  return null
}

/**
 * Nimmt einen Spieler aufs Feld (max. 6) – auf die erste freie Position, bevorzugt die zu seiner Rolle passende.
 * Mit Regeln: nur erlaubte Rollen; der Libero ersetzt einen Hinterfeldspieler. Ist der Spieler gerade vom Libero
 * ersetzt, kommt er zurück und der Libero geht vom Feld.
 */
export function addToLineup(side: PlaySide, player: Player, courtSide: CourtSide, rules = true): PlaySide {
  if (side.players.some((c) => c.playerId === player.id)) return side
  if (side.liberoFor === player.id) return liberoOut(side)
  if (addBlocker(side, player, rules)) return side
  if (rules && (isLiberoPlayer(player) || side.liberoIdle === player.id)) return placeLibero(side, player, courtSide)
  const role = (rules ? allowedRoles(player, side.players, true).filter((r) => r !== 'L') : selectableRoles(player))[0] ?? primaryRole(player)
  const free = freeSlots(side.players)
  const slot = free.find((s) => SLOT_ROLES[s] === role || (s === 5 && role === 'S')) ?? free[0] ?? 1
  return { ...side, players: [...side.players, { playerId: player.id, role, slot, ...slotPosition(courtSide, slot) }] }
}

/** Libero vom Feld: der ersetzte Spieler kommt auf Position und Platz des Liberos zurück. */
function liberoOut(side: PlaySide): PlaySide {
  const libero = side.players.find((c) => c.role === 'L')
  const back = side.liberoFor
  const rest = side.players.filter((c) => c !== libero)
  const out: PlaySide = { ...side, players: rest }
  delete out.liberoFor
  delete out.liberoRole
  if (!libero || !back) return out
  return { ...out, players: [...rest, { playerId: back, role: side.liberoRole ?? 'MB', slot: libero.slot, x: libero.x, y: libero.y }] }
}

/** Nimmt einen Spieler vom Feld; geht der Libero, kommt der ersetzte Spieler zurück. */
export function removeFromLineup(side: PlaySide, playerId: string): PlaySide {
  const c = side.players.find((p) => p.playerId === playerId)
  if (!c) return side
  if (c.role === 'L' && side.liberoFor) return liberoOut(side)
  return { ...side, players: side.players.filter((p) => p !== c) }
}

/** Den Libero für einen anderen Hinterfeldspieler einwechseln. */
export function setLiberoFor(side: PlaySide, team: Team, targetId: string, courtSide: CourtSide): PlaySide {
  const libero = side.players.find((c) => c.role === 'L')
  if (!libero || targetId === side.liberoFor) return side
  const target = side.players.find((c) => c.playerId === targetId && c.role !== 'L')
  if (!target || !isBackRow(target.slot)) return side
  const player = team.players.find((p) => p.id === libero.playerId)
  if (!player) return side
  // Erst den bisher Ersetzten zurück, dann den neuen ersetzen (er übergibt Position und Platz an den Libero)
  return placeLibero(liberoOut(side), player, courtSide, targetId)
}

/**
 * Hält die Aufstellung mit dem Team synchron: entfernte Spieler fallen heraus,
 * Rollen, die der Spieler nicht mehr hat, werden auf seine Hauptposition gesetzt.
 * Gibt bei unveränderter Aufstellung dasselbe Objekt zurück.
 */
export function syncWithTeam(side: PlaySide, team: Team | undefined): PlaySide {
  if (!team) return side.players.length === 0 && side.teamId === null ? side : { teamId: null, players: [] }
  const byId = new Map(team.players.map((p) => [p.id, p]))
  const players = side.players
    .filter((c) => byId.has(c.playerId))
    .map((c) => {
      const p = byId.get(c.playerId)!
      return selectableRoles(p).includes(c.role) ? c : { ...c, role: primaryRole(p) }
    })
  let liberoFor = side.liberoFor
  // Ersetzter Spieler gelöscht oder kein Libero mehr auf dem Feld: Verweis aufheben
  if (liberoFor && (!byId.has(liberoFor) || !players.some((c) => c.role === 'L'))) liberoFor = undefined
  const idleGone = !!side.liberoIdle && !byId.has(side.liberoIdle)
  const changed =
    players.length !== side.players.length || players.some((c, i) => c !== side.players[i]) || liberoFor !== side.liberoFor || idleGone
  if (!changed) return side
  const next: PlaySide = { ...side, players }
  if (idleGone) delete next.liberoIdle
  if (liberoFor) next.liberoFor = liberoFor
  else {
    delete next.liberoFor
    delete next.liberoRole
  }
  return next
}

/**
 * Positionen 1–6 für Aufstellungen ohne gespeicherte Position (ältere Spielzüge): jeder Spieler bekommt die
 * nächstgelegene freie Grundposition. Ändert nichts an Rollen oder Plätzen.
 */
export function inferSlots(players: CourtPlayer[], side: CourtSide): CourtPlayer[] {
  if (players.every((c) => c.slot)) return players
  const taken = new Set(players.map((c) => c.slot).filter(Boolean))
  return players.map((c) => {
    if (c.slot) return c
    let best = 0
    let bestD = Infinity
    for (const s of SLOT_ORDER) {
      if (taken.has(s)) continue
      const p = slotPosition(side, s)
      const d = Math.hypot(p.x - c.x, p.y - c.y)
      if (d < bestD) {
        bestD = d
        best = s
      }
    }
    if (!best) return c
    taken.add(best)
    return { ...c, slot: best }
  })
}
