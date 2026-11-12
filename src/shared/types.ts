/** Schema-Version aller gespeicherten Dokumente (Migrationen ab Phase 5). */
export const SCHEMA_VERSION = 1

export type NetPresetId = 'herren' | 'damen' | 'mixed' | 'custom'

export type Role = 'S' | 'MB' | 'A' | 'D' | 'L'

/** Alle Rollen in Anzeige-Reihenfolge. Rollen sind rein optisch. */
export const ROLES: readonly Role[] = ['S', 'A', 'MB', 'D', 'L']

export const ROLE_LABELS: Record<Role, string> = {
  S: 'Steller',
  MB: 'Mittelblocker',
  A: 'Außenangreifer',
  D: 'Diagonalangreifer',
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
  /** Körpergröße in Metern (inkl. Kopf), bestimmt die Figur in Netz- und 3D-Ansicht */
  height: number
}

/** Körpergröße: Standard und erlaubter Bereich (Meter) */
export const PLAYER_HEIGHT = { default: 1.75, min: 1.0, max: 2.3 } as const
/** Kopf (Kreis bzw. Schild) als Teil der Körpergröße: Durchmesser in Metern */
export const HEAD_DIAMETER = 0.4

export interface Team {
  id: string
  name: string
  /** Trikotfarbe (Hex, z. B. #5b2a86) – gilt für alle Spieler außer dem Libero */
  color: string
  /** Libero-Trikotfarbe (Hex) – ein Spieler in der Rolle L trägt automatisch diese Farbe */
  liberoColor: string
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
export const TRAJECTORY_TYPES: readonly TrajectoryType[] = ['annahme', 'zuspiel']
export const TRAJECTORY_LABELS: Record<TrajectoryType, string> = { annahme: 'Annahme', zuspiel: 'Zuspiel' }

/**
 * Gespeicherte Flugbahn. In der Draufsicht eine Gerade von start nach end (= Schlagpunkt);
 * Parabel, Geschwindigkeit und Dauer werden daraus berechnet (core/physics).
 * Beim Zuspiel ist start an den Schlagpunkt der Annahme gekoppelt, sobald es eine Annahme gibt.
 */
export interface Trajectory {
  start: { x: number; y: number; h: number }
  end: { x: number; y: number }
  apexH: number
  hitH: number
}

/** Anzeige-Optionen eines Spielzugs */
export interface PlayDisplay {
  showAnnahme: boolean
  showZuspiel: boolean
  /** Verlauf hinter dem Schlagpunkt gestrichelt bis zum Boden */
  showAfterHit: boolean
}

export const DEFAULT_DISPLAY: PlayDisplay = { showAnnahme: true, showZuspiel: true, showAfterHit: false }

export interface Settings {
  schemaVersion: number
  netPreset: NetPresetId
  netHeight: number
  /** Hand des Stellers */
  defaultStartHZuspiel: number
  defaultStartHAnnahme: number
  /** Ende der Annahme (Standard = Starthöhe Zuspiel) */
  defaultEndHAnnahme: number
  /** Schlagpunkt des Angriffs (Ende des Zuspiels) */
  defaultHitH: number
  /** Scheitel relativ zum Start */
  defaultApexOffsetZuspiel: number
  defaultApexOffsetAnnahme: number
  defaultLoop: boolean
  defaultSpeed: number
  /** Finger zeichnet Flugbahnen auf leerem Feld (sonst nur Stift und Maus) */
  fingerDraws: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SCHEMA_VERSION,
  netPreset: 'herren',
  netHeight: 2.43,
  defaultStartHZuspiel: 2.5,
  defaultStartHAnnahme: 0.8,
  defaultEndHAnnahme: 2.5,
  defaultHitH: 3.0,
  defaultApexOffsetZuspiel: 1,
  defaultApexOffsetAnnahme: 1,
  defaultLoop: true,
  defaultSpeed: 1,
  fingerDraws: false
}

/* ---------- Gespeicherter Spielzug ---------- */

export interface PlaySideDoc extends PlaySide {
  /** Kopie des Teams beim Speichern (falls es später gelöscht wird) */
  teamSnapshot: Team | null
}

export interface PlayDoc {
  schemaVersion: number
  id: string
  /** Kürzel, z. B. „AngrV1“ */
  code: string
  title: string
  createdAt: string
  updatedAt: string
  sides: Record<CourtSide, PlaySideDoc>
  trajectories: Partial<Record<TrajectoryType, Trajectory>>
  netPreset: NetPresetId
  netHeight: number
  display: PlayDisplay
  netViewFrom: CourtSide
  /** Drehung der Netzansicht in Grad (−90 … 90) */
  netAngle: number
  netShowPlayers: boolean
}

/** Eintrag der Bibliothek */
export interface PlaySummary {
  id: string
  code: string
  title: string
  updatedAt: string
}
