import type { CourtPlayer, CourtSide, Formation, PlaySide, Role, Situation, Team } from '@shared/types'
import { isBackRow, slotPosition } from './lineup'

/**
 * Läufersystem: Die sechs Rotationen einer Mannschaft, benannt nach der Position des Stellers („Läufer“) –
 * Läufer 1 = Steller auf Position 1 usw. Jede Rotation gibt es als Annahme- und als Aufschlag-Aufstellung.
 *
 * Die Reihenfolge der Spieler (wer neben wem steht) kommt aus der aktuellen Aufstellung auf dem Feld:
 * Rotieren verschiebt nur die Positionen 1–6 im Uhrzeigersinn (2 → 1 → 6 → 5 → 4 → 3 → 2).
 * Gespeicherte Aufstellungen liegen im Team (Seite-A-Koordinaten), sonst gelten sinnvolle Standardplätze.
 */

export const LAEUFER = [1, 2, 3, 4, 5, 6] as const
export const SITUATIONS: Situation[] = ['annahme', 'aufschlag']
export const SITUATION_LABELS: Record<Situation, string> = { annahme: 'Annahme', aufschlag: 'Aufschlag' }

export const formationKey = (n: number, situation: Situation) => `${n}-${situation}`

/** Position nach k Rotationen im Uhrzeigersinn (eine Rotation: 2 → 1, 1 → 6, 6 → 5, …) */
export function rotateSlot(slot: number, k: number): number {
  return ((((slot - 1 - k) % 6) + 6) % 6) + 1
}

/** Seite A ↔ Seite B: Punktspiegelung an der Feldmitte */
export const mirror = (side: CourtSide, p: { x: number; y: number }) => (side === 'A' ? { x: p.x, y: p.y } : { x: -p.x, y: -p.y })

interface Regular {
  playerId: string
  role: Role
  slot: number
}

/** Die sechs regulären Spieler mit Position (der vom Libero Ersetzte steht auf der Position des Liberos). */
export function rotationOrder(side: PlaySide): Regular[] {
  const out: Regular[] = []
  for (const c of side.players) {
    if (!c.slot) continue
    if (c.role === 'L' && side.liberoFor) out.push({ playerId: side.liberoFor, role: side.liberoRole ?? 'MB', slot: c.slot })
    else out.push({ playerId: c.playerId, role: c.role, slot: c.slot })
  }
  return out
}

/** Bezugsspieler des Läufersystems: der (erste) Steller in der Reihenfolge des Teams, sonst der erste Spieler. */
export function referencePlayer(order: Regular[], team: Team | undefined): Regular | undefined {
  const rank = (id: string) => team?.players.findIndex((p) => p.id === id) ?? 0
  const sorted = [...order].sort((a, b) => rank(a.playerId) - rank(b.playerId))
  return sorted.find((r) => r.role === 'S') ?? sorted.find((r) => r.role !== 'L')
}

/** Aktueller Läufer (Position des Stellers) oder null ohne Positionen */
export function currentLaeufer(side: PlaySide, team: Team | undefined): number | null {
  return referencePlayer(rotationOrder(side), team)?.slot ?? null
}

/**
 * Standardplatz (Seite A) eines Spielers je Situation:
 * Aufschlag – Grundpositionen, der Spieler auf 1 schlägt hinter der Grundlinie auf.
 * Annahme – Steller vorne am Netz bzw. hinten „versteckt“ hinter seinem Vordermann, Mittelblocker vorne am Netz,
 * die übrigen Vorderspieler weiter hinten zur Annahme; Hinterspieler hinten. Die Überlappungsregel bleibt erfüllt.
 */
export function defaultSpot(slot: number, role: Role, situation: Situation): { x: number; y: number } {
  const base = slotPosition('A', slot)
  if (situation === 'aufschlag') return slot === 1 ? { x: -9.8, y: -2.5 } : base
  const front = !isBackRow(slot)
  if (front) {
    if (role === 'S') return { x: -1.0, y: base.y }
    if (role === 'MB') return { x: -1.5, y: base.y }
    return { x: -4.0, y: base.y }
  }
  if (role === 'S') {
    // Hinter dem Vordermann (1 → 2, 6 → 3, 5 → 4), etwas zur Mitte
    const frontSlot = slot === 1 ? 2 : slot === 6 ? 3 : 4
    return { x: -5.0, y: slotPosition('A', frontSlot).y * 0.8 }
  }
  return { x: -7.0, y: base.y }
}

/**
 * Wen ersetzt der Libero in dieser Rotation: gespeicherte Wahl (falls der Spieler hinten steht),
 * sonst den Mittelblocker im Hinterfeld – beim eigenen Aufschlag nicht den Aufschläger (Position 1).
 */
export function liberoTargetFor(order: Regular[], situation: Situation, stored: Formation | undefined): string | null {
  if (stored && stored.liberoFor !== undefined) {
    if (stored.liberoFor === null) return null
    const r = order.find((o) => o.playerId === stored.liberoFor)
    if (r && isBackRow(r.slot)) return r.playerId
  }
  const back = order.filter((o) => isBackRow(o.slot))
  const mb = back.find((o) => o.role === 'MB')
  if (mb && !(situation === 'aufschlag' && mb.slot === 1)) return mb.playerId
  return null
}

/**
 * Berechnet die Aufstellung „Läufer n“ in der Situation: rotiert die Positionen so, dass der Steller auf n steht,
 * wechselt den Libero passend ein/aus und setzt die gespeicherten (oder Standard-)Plätze.
 */
export function laeuferLineup(side: PlaySide, team: Team | undefined, courtSide: CourtSide, n: number, situation: Situation): PlaySide {
  const order = rotationOrder(side)
  const ref = referencePlayer(order, team)
  if (!ref) return side
  const k = (((ref.slot - n) % 6) + 6) % 6
  const rotated = order.map((o) => ({ ...o, slot: rotateSlot(o.slot, k) }))
  const stored = team?.rotations?.[formationKey(n, situation)]
  // Libero im Wechselsystem: auf dem Feld (ersetzt jemanden) oder in dieser Rotation draußen (liberoIdle)
  const liberoId = side.players.find((c) => c.role === 'L' && side.liberoFor)?.playerId ?? side.liberoIdle
  const target = liberoId ? liberoTargetFor(rotated, situation, stored) : null

  // Laufwege und Sprünge gehören zum Spieler und bleiben beim Läuferwechsel erhalten
  const extra = (playerId: string) => {
    const c = side.players.find((p) => p.playerId === playerId)
    return { ...(c?.path ? { path: c.path } : {}), ...(c?.jump ? { jump: c.jump } : {}) }
  }
  const spot = (playerId: string, slot: number, role: Role) => {
    const s = stored?.pos[playerId]
    return mirror(courtSide, s ?? defaultSpot(slot, role, situation))
  }
  const players: CourtPlayer[] = []
  let liberoFor: string | undefined
  let liberoRole: Role | undefined
  for (const r of rotated) {
    if (liberoId && r.playerId === target) {
      liberoFor = r.playerId
      liberoRole = r.role
      players.push({ playerId: liberoId, role: 'L', slot: r.slot, ...spot(liberoId, r.slot, r.role), ...extra(liberoId) })
    } else players.push({ playerId: r.playerId, role: r.role, slot: r.slot, ...spot(r.playerId, r.slot, r.role), ...extra(r.playerId) })
  }
  // Libero ohne Ersetzten (freie Hinterfeldposition) bleibt, wo er ist
  for (const c of side.players) if (c.role === 'L' && !side.liberoFor && !players.some((p) => p.playerId === c.playerId)) players.push(c)

  const next: PlaySide = { teamId: side.teamId, players, laeufer: { n, situation } }
  if (liberoFor) {
    next.liberoFor = liberoFor
    next.liberoRole = liberoRole
  } else if (liberoId) next.liberoIdle = liberoId
  return next
}

/** Aktuelle Aufstellung als speicherbare Formation (Seite-A-Koordinaten). */
export function formationOf(side: PlaySide, courtSide: CourtSide): Formation {
  const pos: Formation['pos'] = {}
  for (const c of side.players) {
    const p = mirror(courtSide, c)
    pos[c.playerId] = { x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 }
  }
  return { pos, liberoFor: side.liberoFor ?? null }
}

/** Weicht die Aufstellung von der gespeicherten bzw. Standard-Aufstellung des aktiven Läufers ab? */
export function formationChanged(side: PlaySide, team: Team | undefined, courtSide: CourtSide): boolean {
  if (!side.laeufer) return false
  const expected = laeuferLineup(side, team, courtSide, side.laeufer.n, side.laeufer.situation)
  if (expected.liberoFor !== side.liberoFor || expected.players.length !== side.players.length) return true
  return side.players.some((c) => {
    const e = expected.players.find((p) => p.playerId === c.playerId)
    return !e || Math.hypot(e.x - c.x, e.y - c.y) > 0.02
  })
}
