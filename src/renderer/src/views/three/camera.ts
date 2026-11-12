/**
 * Kamera-Begrenzung: nur obere Halbkugel.
 * Polarwinkel 0 = senkrecht von oben, π/2 = parallel zum Feld (Augenhöhe).
 */
export const CAMERA_LIMITS = {
  minPolar: 0,
  maxPolar: Math.PI / 2 - 0.02,
  minDistance: 3,
  maxDistance: 60,
  /** Ziel (Orbit-Mittelpunkt) bleibt in diesem Bereich (Three-Koordinaten). */
  targetX: [-14, 14] as const,
  targetZ: [-10, 10] as const,
  targetY: [0, 4] as const
}

export function clamp(v: number, [lo, hi]: readonly [number, number]): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Klemmt ein Orbit-Ziel, sodass es nie unter das Feld oder zu weit weg wandert. */
export function clampTarget(t: { x: number; y: number; z: number }) {
  return {
    x: clamp(t.x, CAMERA_LIMITS.targetX),
    y: clamp(t.y, CAMERA_LIMITS.targetY),
    z: clamp(t.z, CAMERA_LIMITS.targetZ)
  }
}

/** Polarwinkel eines Kameraversatzes (Three, y-up). */
export function polarAngle(offset: { x: number; y: number; z: number }): number {
  const r = Math.hypot(offset.x, offset.y, offset.z)
  if (r === 0) return 0
  return Math.acos(Math.min(1, Math.max(-1, offset.y / r)))
}
