/** Schema-Version aller gespeicherten Dokumente (Migrationen ab Phase 5). */
export const SCHEMA_VERSION = 1

export type NetPresetId = 'herren' | 'damen' | 'mixed' | 'custom'

export type Role = 'S' | 'MB' | 'AA' | 'DA' | 'L'

/** Alle Rollen in Anzeige-Reihenfolge. Rollen sind rein optisch. */
export const ROLES: readonly Role[] = ['S', 'AA', 'MB', 'DA', 'L']

export const ROLE_LABELS: Record<Role, string> = {
  S: 'Steller',
  MB: 'Mittelblocker',
  AA: 'Außenangreifer',
  DA: 'Diagonalangreifer',
  L: 'Libero'
}

/* ---------- Teams ---------- */

export interface Player {
  id: string
  name: string
  /** Rückennummer (1–99) */
  number: number
  /** Eine oder mehrere Positionen; die erste gilt als Hauptposition. */
  positions: Role[]
}

export interface Team {
  id: string
  name: string
  players: Player[]
}

export interface TeamsFile {
  schemaVersion: number
  teams: Team[]
}

/* ---------- Spielzug: Aufstellung ---------- */

export type CourtSide = 'A' | 'B'

/** Ein Spieler auf dem Feld. Nummer und Name kommen aus dem Team, die Rolle wählt man im Spielzug. */
export interface CourtPlayer {
  playerId: string
  role: Role
  /** Position in Weltkoordinaten (Meter) */
  x: number
  y: number
}

export interface PlaySide {
  teamId: string | null
  /** Höchstens 6 Spieler */
  players: CourtPlayer[]
}

export const MAX_PLAYERS_PER_SIDE = 6

export interface Vec2 {
  x: number
  y: number
}

/** Punkt in Weltkoordinaten (Meter). x = Länge, y = Breite, z = Höhe. */
export interface Vec3 {
  x: number
  y: number
  z: number
}

export type TrajectoryType = 'annahme' | 'zuspiel'

export interface Trajectory {
  type: TrajectoryType
  start: { x: number; y: number; h: number }
  dir: { dx: number; dy: number }
  apexH: number
  hitDist: number
  hitH: number
}

export interface Settings {
  schemaVersion: number
  netPreset: NetPresetId
  netHeight: number
  defaultStartHZuspiel: number
  defaultStartHAnnahme: number
  defaultEndHAnnahme: number
  defaultHitH: number
  defaultApexOffsetZuspiel: number
  defaultApexOffsetAnnahme: number
  defaultLoop: boolean
  defaultSpeed: number
  fingerDraws: boolean
}
