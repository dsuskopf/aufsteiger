import type { NetPresetId } from '@shared/types'

/**
 * Hallenvolleyball-Maße in Metern.
 * Weltkoordinaten: Ursprung = Feldmitte unter dem Netz,
 * x entlang der Länge (−9..+9, Netz bei x = 0), y entlang der Breite (−4,5..+4,5), z = Höhe.
 */
export const COURT = {
  length: 18,
  width: 9,
  halfLength: 9,
  halfWidth: 4.5,
  attackLineDist: 3,
  lineWidth: 0.05,
  /** Freizone, die in den Ansichten mit gezeigt wird */
  freeZone: 2,
  /** Netz */
  netWidth: 9.5,
  netBandDepth: 1,
  postDistFromSideline: 1,
  postRadius: 0.06,
  /** Antenne: 1,80 m, Ø 10 mm, 80 cm über der Netzkante, rot-weiß in 10-cm-Feldern */
  antennaLength: 1.8,
  antennaHeightAboveNet: 0.8,
  antennaRadius: 0.005,
  antennaStripe: 0.1,
  /** Antennentasche (Stoffhülle) entlang der Netzhöhe */
  antennaPocketRadius: 0.016,
  /** Seitenband: 5 cm breit, senkrecht über jeder Seitenlinie */
  sideBandWidth: 0.05
} as const

export const NET_PRESETS: Record<Exclude<NetPresetId, 'custom'>, { label: string; height: number }> = {
  // Reihenfolge = Anzeige-Reihenfolge (absteigend nach Höhe)
  herren: { label: 'Herren', height: 2.43 },
  mixed: { label: 'Mixed', height: 2.35 },
  damen: { label: 'Damen', height: 2.24 }
}

export const NET_HEIGHT_MIN = 1.0
export const NET_HEIGHT_MAX = 3.0

export function clampNetHeight(h: number): number {
  if (!Number.isFinite(h)) return NET_PRESETS.herren.height
  return Math.min(NET_HEIGHT_MAX, Math.max(NET_HEIGHT_MIN, h))
}

/** Liefert das passende Preset zu einer Höhe oder 'custom'. */
export function presetForHeight(h: number): NetPresetId {
  for (const [id, p] of Object.entries(NET_PRESETS)) {
    if (Math.abs(p.height - h) < 1e-6) return id as NetPresetId
  }
  return 'custom'
}

/** Linien-Segmente des Feldes (Weltkoordinaten, Boden), für 2D und 3D gemeinsam. */
export interface Segment {
  a: { x: number; y: number }
  b: { x: number; y: number }
  kind: 'boundary' | 'center' | 'attack'
}

export function courtLines(): Segment[] {
  const L = COURT.halfLength
  const W = COURT.halfWidth
  const A = COURT.attackLineDist
  return [
    { a: { x: -L, y: -W }, b: { x: L, y: -W }, kind: 'boundary' },
    { a: { x: L, y: -W }, b: { x: L, y: W }, kind: 'boundary' },
    { a: { x: L, y: W }, b: { x: -L, y: W }, kind: 'boundary' },
    { a: { x: -L, y: W }, b: { x: -L, y: -W }, kind: 'boundary' },
    { a: { x: 0, y: -W }, b: { x: 0, y: W }, kind: 'center' },
    { a: { x: -A, y: -W }, b: { x: -A, y: W }, kind: 'attack' },
    { a: { x: A, y: -W }, b: { x: A, y: W }, kind: 'attack' }
  ]
}
