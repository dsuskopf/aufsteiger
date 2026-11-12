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
 * Hält den Inhalt (in Basis-Pixeln) im Bild: Ist er größer als der Rahmen, darf man nur bis zu seinen Rändern
 * verschieben; ist er kleiner, wird er im Rahmen zentriert. Der Rahmen ist standardmäßig die ganze Fläche,
 * kann aber kleiner sein (z. B. Draufsicht neben dem Netz-Bild-im-Bild).
 */
export function clampView(
  v: View2D,
  content: PxRect,
  width: number,
  height: number,
  frame: PxRect = { x0: 0, y0: 0, x1: width, y1: height }
): View2D {
  const axis = (t: number, c0: number, c1: number, f0: number, f1: number) => {
    const size = f1 - f0
    const span = (c1 - c0) * v.z
    if (span <= size) return f0 + (size - (c0 + c1) * v.z) / 2
    return Math.min(f0 - c0 * v.z, Math.max(f1 - c1 * v.z, t))
  }
  return {
    z: v.z,
    tx: axis(v.tx, content.x0, content.x1, frame.x0, frame.x1),
    ty: axis(v.ty, content.y0, content.y1, frame.y0, frame.y1)
  }
}

export function lerpView(a: View2D, b: View2D, k: number): View2D {
  return { z: a.z + (b.z - a.z) * k, tx: a.tx + (b.tx - a.tx) * k, ty: a.ty + (b.ty - a.ty) * k }
}

/* ---------- Netzansicht: frontaler Blick aufs Netz ---------- */

/**
 * Flache, maßstabstreue Projektion entlang der Feldlänge (x) auf die Netzebene (y, z).
 * Von Seite A (x < 0) schaut man Richtung +x: rechts ist dann −y. Von Seite B ist es gespiegelt.
 */
export interface NetViewport {
  scale: number
  /** Pixel-x der Feldmitte (y = 0) */
  originX: number
  /** Pixel-y für z = 0 (Boden) */
  groundY: number
  from: 'A' | 'B'
}

export function netToPx(vp: NetViewport, y: number, z: number): { px: number; py: number } {
  const side = vp.from === 'A' ? -1 : 1
  return { px: vp.originX + side * y * vp.scale, py: vp.groundY - z * vp.scale }
}

export function pxToNet(vp: NetViewport, px: number, py: number): { y: number; z: number } {
  const side = vp.from === 'A' ? -1 : 1
  return { y: (side * (px - vp.originX)) / vp.scale, z: (vp.groundY - py) / vp.scale }
}

/** Liegt ein Punkt auf der Seite des Betrachters (vor dem Netz)? */
export function isNearSide(vp: Pick<NetViewport, 'from'>, x: number): boolean {
  return vp.from === 'A' ? x < 0 : x > 0
}

export function applyViewNet(vp: NetViewport, v: View2D): NetViewport {
  return { ...vp, scale: vp.scale * v.z, originX: vp.originX * v.z + v.tx, groundY: vp.groundY * v.z + v.ty }
}
