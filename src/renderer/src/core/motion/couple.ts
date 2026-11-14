/**
 * Ballkontakte an Spieler koppeln (reine Logik).
 *  - Der erste Ballflug eines Spielzugs startet beim gekoppelten Spieler (vor ihm, in Spielhöhe) und folgt ihm,
 *    wenn man den Spieler verschiebt – bei t = 0 kann ja niemand zum Ball laufen.
 *  - Vorschlag, wer einen neuen Ballflug spielt (nächster Spieler, Steller, Angreifer).
 */
import { BALL_TYPES, type Attack, type BallType, type Contacts, type CourtPlayer, type CourtSide, type PlayerRef, type PlaySide, type Trajectory, type TrajectoryType } from '@shared/types'
import { clampAttack } from '../physics/attack'
import { clampInput } from '../physics/trajectory'
import { ballOffset, contactYaw } from './plan'

type Sides = Record<CourtSide, PlaySide>
type Flights = { trajectories: Partial<Record<TrajectoryType, Trajectory>>; schlag: Attack | null }

const flightOf = (f: Flights, type: BallType): Trajectory | Attack | null | undefined => (type === 'schlag' ? f.schlag : f.trajectories[type])

/** Erster Ballflug des Spielzugs (Reihenfolge Annahme, Zuspiel, Schlag) */
export function firstFlight(f: Flights): BallType | null {
  return BALL_TYPES.find((t) => !!flightOf(f, t)) ?? null
}

const findPlayer = (sides: Sides, ref: PlayerRef | undefined): CourtPlayer | undefined =>
  ref ? sides[ref.side].players.find((c) => c.playerId === ref.playerId) : undefined

/** Kontakte ohne Ballflug oder ohne Spieler auf dem Feld entfernen; unverändert → dasselbe Objekt */
export function pruneContacts(contacts: Contacts, sides: Sides, trajectories: Flights['trajectories'], schlag: Attack | null): Contacts {
  let out = contacts
  for (const type of BALL_TYPES) {
    const ref = contacts[type]
    if (!ref) continue
    if (flightOf({ trajectories, schlag }, type) && findPlayer(sides, ref)) continue
    if (out === contacts) out = { ...contacts }
    delete out[type]
  }
  return out
}

/** Startet der Ballflug dieses Typs fest beim gekoppelten Spieler? (dann ist sein Start nicht einzeln verschiebbar) */
export function startsAtPlayer(type: BallType, f: Flights, contacts: Contacts, sides: Sides): boolean {
  return firstFlight(f) === type && !!findPlayer(sides, contacts[type])
}

/**
 * Hält den Start des ersten Ballflugs beim gekoppelten Spieler. Gibt bei unveränderter Lage dieselben Objekte zurück.
 */
export function attachFirstContact(
  state: Flights & { contacts: Contacts; sides: Sides },
  heightOf: (side: CourtSide, playerId: string) => number
): Flights {
  const type = firstFlight(state)
  const ref = type ? state.contacts[type] : undefined
  const player = findPlayer(state.sides, ref)
  const flight = type ? flightOf(state, type) : null
  if (!type || !ref || !player || !flight) return state
  const H = heightOf(ref.side, ref.playerId)
  const netYaw = ref.side === 'A' ? 0 : Math.PI
  const o = ballOffset(type, H)
  let sx = flight.start.x
  let sy = flight.start.y
  // Die Spielrichtung hängt selbst leicht vom Start ab: ein paar Runden bis es passt
  for (let i = 0; i < 6; i++) {
    const dx = flight.end.x - sx
    const dy = flight.end.y - sy
    const d = Math.hypot(dx, dy)
    const yaw = contactYaw(type, netYaw, d > 1e-6 ? { dx: dx / d, dy: dy / d } : { dx: Math.cos(netYaw), dy: 0 }, type === 'zuspiel' && !!(flight as Trajectory).backset)
    const nx = player.x + Math.cos(yaw) * o.f + Math.sin(yaw) * o.r
    const ny = player.y + Math.sin(yaw) * o.f - Math.cos(yaw) * o.r
    const moved = Math.hypot(nx - sx, ny - sy)
    sx = nx
    sy = ny
    if (moved < 1e-4) break
  }
  if (Math.hypot(sx - flight.start.x, sy - flight.start.y) < 1e-3) return state
  const start = { ...flight.start, x: Math.round(sx * 1e4) / 1e4, y: Math.round(sy * 1e4) / 1e4 }
  if (type === 'schlag') return { trajectories: state.trajectories, schlag: clampAttack({ ...(flight as Attack), start }) }
  return { trajectories: { ...state.trajectories, [type]: clampInput({ ...(flight as Trajectory), start }) }, schlag: state.schlag }
}

/** Wer spielt einen neuen Ballflug? Naheliegender Spieler auf der Seite des Ballstarts, sonst null. */
export function suggestContact(type: BallType, state: Flights & { contacts: Contacts; sides: Sides }): PlayerRef | null {
  const flight = flightOf(state, type)
  if (!flight) return null
  const sides: CourtSide[] = flight.start.x < 0 ? ['A'] : flight.start.x > 0 ? ['B'] : ['A', 'B']
  // Wer den Ball direkt davor gespielt hat, spielt ihn nicht gleich noch einmal
  const before = state.contacts[type === 'schlag' ? 'zuspiel' : 'annahme']
  const taken = (side: CourtSide, id: string) => type !== 'annahme' && before?.side === side && before.playerId === id
  let best: PlayerRef | null = null
  let bestD = Infinity
  const consider = (side: CourtSide, c: CourtPlayer, maxDist: number, bonus = 0) => {
    const d = Math.hypot(c.x - flight.start.x, c.y - flight.start.y) - bonus
    if (d < bestD && d <= maxDist) {
      bestD = d
      best = { side, playerId: c.playerId }
    }
  }
  const free = type !== 'annahme' && firstFlight(state) !== type
  for (const side of sides)
    for (const c of state.sides[side].players) {
      if (type === 'annahme' || !free) consider(side, c, 1.5)
      else if (type === 'zuspiel') {
        // Der Steller stellt; sonst der Nächste, der nicht schon annimmt
        if (c.role === 'S') consider(side, c, Infinity, 100)
        else if (!taken(side, c.playerId)) consider(side, c, 2.5)
      } else if (c.role !== 'L' && c.role !== 'S' && !taken(side, c.playerId)) consider(side, c, 6)
    }
  return best
}
