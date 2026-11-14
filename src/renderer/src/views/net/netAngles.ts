import { normYaw } from '@renderer/core/geometry/transform'

/**
 * Feste Blickwinkel der Netzansicht auf den Tasten 1–8: einmal im Uhrzeigersinn ums Feld, wie man es in der
 * Draufsicht sieht (Seite A links, B rechts). 0° = frontal von A (Standard), 180° = frontal von B.
 */
export const NET_ANGLES: { key: string; yaw: number; label: string }[] = [
  { key: '1', yaw: 0, label: 'Von A' },
  { key: '2', yaw: 315, label: 'Schräg von A, oben' },
  { key: '3', yaw: 270, label: 'Seitlich, oben' },
  { key: '4', yaw: 225, label: 'Schräg von B, oben' },
  { key: '5', yaw: 180, label: 'Von B' },
  { key: '6', yaw: 135, label: 'Schräg von B, unten' },
  { key: '7', yaw: 90, label: 'Seitlich, unten' },
  { key: '8', yaw: 45, label: 'Schräg von A, unten' }
]

/** Tastenkürzel der Netzansicht (für den Tooltip) */
export const NET_KEY_HELP: { keys: string; label: string }[] = [
  { keys: 'Ziehen', label: 'frei drehen (360°)' },
  { keys: 'Q E', label: 'drehen (Shift = schneller)' },
  ...NET_ANGLES.map((a) => ({ keys: a.key, label: `${a.label} (${a.yaw}°)` }))
]

/** Name des Blickwinkels („Von A · 0°“, sonst nur die Gradzahl) */
export function netYawLabel(yaw: number): string {
  const deg = Math.round(normYaw(yaw)) % 360
  const preset = NET_ANGLES.find((a) => a.yaw === deg)
  return preset ? `${preset.label} · ${deg}°` : `${deg}°`
}
