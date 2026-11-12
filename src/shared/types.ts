/** Schema-Version aller gespeicherten Dokumente (Migrationen ab Phase 5). */
export const SCHEMA_VERSION = 1

export type NetPresetId = 'herren' | 'damen' | 'mixed' | 'custom'

export type Role = 'S' | 'MB' | 'AA' | 'DA' | 'L'

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
