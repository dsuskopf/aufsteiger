/**
 * Körpermaße der Spielerfigur als Anteil der Körpergröße H (Meter = Faktor · H).
 * Dieselben Maße nutzen die Bewegungsplanung (Reichhöhe, Abstand zum Ball) und die 3D-Figur.
 */
export const BODY = {
  /** Hüfthöhe im Stand (Beinlänge inkl. Knöchel) */
  hip: 0.53,
  thigh: 0.245,
  shin: 0.245,
  /** Knöchelhöhe über dem Boden */
  ankle: 0.04,
  /** Hüfte → Schulterlinie */
  spine: 0.29,
  shoulderHalf: 0.115,
  hipHalf: 0.052,
  /** Schulterlinie → Kopfmitte */
  neck: 0.115,
  headR: 0.065,
  upperArm: 0.172,
  /** Ellbogen → Handgelenk */
  foreArm: 0.15,
  /** Handgelenk → Handmitte (dort trifft die Hand den Ball) */
  palm: 0.05,
  /** Handlänge (Handgelenk → Fingerspitzen) */
  hand: 0.105,
  foot: 0.15
} as const

/** Höhe der Handmitte bei gestrecktem Arm nach oben, im Stand (Schulter leicht angehoben) */
export const REACH_ONE = BODY.hip + BODY.spine + 0.03 + BODY.upperArm + BODY.foreArm + BODY.palm
/** Beidhändig über dem Kopf (Block): Handmitte und Fingerspitzen */
export const REACH_BLOCK = 1.21
export const REACH_BLOCK_TIP = REACH_BLOCK + 0.055
/** Pritschen: Ball über der Stirn, Arme noch gebeugt */
export const REACH_SET = 1.15
/** Hände greifen beim Block so weit vor den Körper (Anteil von H) */
export const BLOCK_FORWARD = 0.2
/** Halbe Breite der Blockfläche: Schulter + Hand (Meter bei Körpergröße H) */
export const blockHalfWidth = (H: number) => BODY.shoulderHalf * H + 0.11
