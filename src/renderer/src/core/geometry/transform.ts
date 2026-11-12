/**
 * Einzige Stelle für Koordinaten-Umrechnungen.
 * Welt: x = Länge, y = Breite, z = Höhe (Meter).
 */

export interface TopViewport {
  /** Pixel pro Meter */
  scale: number
  /** Pixelposition des Welt-Ursprungs */
  originX: number
  originY: number
  /** Drehung der Ansicht gegen den Uhrzeigersinn (Radiant); stufenlos, damit sie animiert werden kann. */
  angle: number
}

/** Größe des Begrenzungsrechtecks eines um `angle` gedrehten Rechtecks. */
export function rotatedExtent(w: number, h: number, angle: number): { w: number; h: number } {
  const c = Math.abs(Math.cos(angle))
  const s = Math.abs(Math.sin(angle))
  return { w: c * w + s * h, h: s * w + c * h }
}

/**
 * Passt einen Weltbereich (Breite × Höhe in Metern) maßstabstreu in eine Pixelfläche ein.
 * Ohne Drehung läuft Welt-x nach rechts und Welt-y nach oben. Bei Drehung zählt das gedrehte Begrenzungsrechteck,
 * so ändert sich der Maßstab während einer Drehanimation stetig.
 */
export function fitViewport(
  pxWidth: number,
  pxHeight: number,
  worldWidth: number,
  worldHeight: number,
  padding = 0,
  angle = 0
): TopViewport {
  const ext = rotatedExtent(worldWidth, worldHeight, angle)
  const w = Math.max(1, pxWidth - 2 * padding)
  const h = Math.max(1, pxHeight - 2 * padding)
  const scale = Math.max(0.0001, Math.min(w / ext.w, h / ext.h))
  return { scale, originX: pxWidth / 2, originY: pxHeight / 2, angle }
}

/** Welt (x, y) → Pixel in der Draufsicht. */
export function worldToTop(vp: TopViewport, x: number, y: number): { px: number; py: number } {
  const c = Math.cos(vp.angle)
  const s = Math.sin(vp.angle)
  const X = x * c - y * s
  const Y = x * s + y * c
  return { px: vp.originX + X * vp.scale, py: vp.originY - Y * vp.scale }
}

export function topToWorld(vp: TopViewport, px: number, py: number): { x: number; y: number } {
  const X = (px - vp.originX) / vp.scale
  const Y = (vp.originY - py) / vp.scale
  const c = Math.cos(vp.angle)
  const s = Math.sin(vp.angle)
  return { x: X * c + Y * s, y: -X * s + Y * c }
}

/** Welt → Three.js (y-up, rechtshändig): (x, y, z) → (x, z, −y). */
export function worldToThree(x: number, y: number, z: number): [number, number, number] {
  return [x, z, -y]
}

export function threeToWorld(tx: number, ty: number, tz: number): { x: number; y: number; z: number } {
  return { x: tx, y: -tz, z: ty }
}

/** Seitenansicht: s = Distanz entlang der Linie, z = Höhe. */
export interface SideViewport {
  scale: number
  /** Pixel-x für s = 0 (ungespiegelt) */
  originX: number
  /** Pixel-y für z = 0 (Boden) */
  groundY: number
  /** Blick von der anderen Seite: s wird um mirrorCenter gespiegelt. */
  mirror?: boolean
  mirrorCenter?: number
}

function mirrorS(vp: SideViewport, s: number): number {
  return vp.mirror ? 2 * (vp.mirrorCenter ?? 0) - s : s
}

export function sideToPx(vp: SideViewport, s: number, z: number): { px: number; py: number } {
  return { px: vp.originX + mirrorS(vp, s) * vp.scale, py: vp.groundY - z * vp.scale }
}

export function pxToSide(vp: SideViewport, px: number, py: number): { s: number; z: number } {
  return { s: mirrorS(vp, (px - vp.originX) / vp.scale), z: (vp.groundY - py) / vp.scale }
}

/* ---------- Zoom & Verschieben der 2D-Ansichten ---------- */

/** Ansichts-Transformation über den Basis-Pixeln: bildschirm = basis · z + t. */
export interface View2D {
  z: number
  tx: number
  ty: number
}

export const IDENTITY_VIEW: View2D = { z: 1, tx: 0, ty: 0 }
export const VIEW_ZOOM_MIN = 1
export const VIEW_ZOOM_MAX = 8

export interface PxRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export function applyViewTop(vp: TopViewport, v: View2D): TopViewport {
  return {
    ...vp,
    scale: vp.scale * v.z,
    originX: vp.originX * v.z + v.tx,
    originY: vp.originY * v.z + v.ty
  }
}

export function applyViewSide(vp: SideViewport, v: View2D): SideViewport {
  return {
    ...vp,
    scale: vp.scale * v.z,
    originX: vp.originX * v.z + v.tx,
    groundY: vp.groundY * v.z + v.ty
  }
}

/** Zoomt um den Faktor f, wobei der Bildschirmpunkt (ax, ay) fest bleibt. */
export function zoomAt(
  v: View2D,
  f: number,
  ax: number,
  ay: number,
  minZ = VIEW_ZOOM_MIN,
  maxZ = VIEW_ZOOM_MAX
): View2D {
  const z = Math.min(maxZ, Math.max(minZ, v.z * f))
  const k = z / v.z
  return { z, tx: ax - (ax - v.tx) * k, ty: ay - (ay - v.ty) * k }
}

/**
 * Hält den Inhalt (in Basis-Pixeln) im Bild: Ist er größer als die Fläche, darf man nur bis zu seinen Rändern
 * verschieben; ist er kleiner, wird er zentriert.
 */
export function clampView(v: View2D, content: PxRect, width: number, height: number): View2D {
  const axis = (t: number, c0: number, c1: number, size: number) => {
    const span = (c1 - c0) * v.z
    if (span <= size) return (size - (c0 + c1) * v.z) / 2
    return Math.min(-c0 * v.z, Math.max(size - c1 * v.z, t))
  }
  return {
    z: v.z,
    tx: axis(v.tx, content.x0, content.x1, width),
    ty: axis(v.ty, content.y0, content.y1, height)
  }
}

export function lerpView(a: View2D, b: View2D, k: number): View2D {
  return { z: a.z + (b.z - a.z) * k, tx: a.tx + (b.tx - a.tx) * k, ty: a.ty + (b.ty - a.ty) * k }
}
