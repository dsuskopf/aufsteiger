import * as THREE from 'three'
import { BALL_RADIUS } from '@renderer/core/physics/trajectory'
import { BALL_COLORS } from '@renderer/theme/colors'

/**
 * Klassischer Hallen-Volleyball: 18 Panels in sechs Gruppen zu je drei Streifen (wie die Seiten eines Würfels),
 * benachbarte Gruppen stehen quer zueinander. Farben Gelb/Blau, eingetiefte Nähte.
 * Durchmesser aus dem offiziellen Umfang (siehe physics/trajectory.ts), Farben in theme/colors.ts.
 */

/** Halbe Nahtbreite im Winkelmaß der Würfelseite (1 = halbe Seite) */
const SEAM = 0.022
const STRIP = 1 / 3
const QUARTER = Math.PI / 4

export interface PanelSample {
  /** 0 = Gelb, 1 = Blau */
  color: 0 | 1
  /** Abstand zur nächsten Naht (Winkelmaß der Würfelseite); 0 = auf der Naht */
  seamDist: number
}

/**
 * Panel an einer Richtung (Einheitsvektor) auf der Kugel.
 * Seite X: Streifen nach z, Seite Y: nach x, Seite Z: nach y – so laufen die Streifen benachbarter Seiten quer.
 */
export function panelAt(x: number, y: number, z: number): PanelSample {
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  const az = Math.abs(z)
  let m: number
  let strip: number
  let other: number
  if (ax >= ay && ax >= az) {
    m = ax
    strip = z
    other = y
  } else if (ay >= az) {
    m = ay
    strip = x
    other = z
  } else {
    m = az
    strip = y
    other = x
  }
  // Winkelkoordinaten auf der Seite in [−1, 1] (gleich breite Streifen auf der Kugel)
  const a = Math.atan(strip / m) / QUARTER
  const b = Math.atan(other / m) / QUARTER
  const middle = Math.abs(a) < STRIP
  const seamDist = Math.min(Math.abs(Math.abs(a) - STRIP), 1 - Math.max(Math.abs(a), Math.abs(b)))
  return { color: middle ? 1 : 0, seamDist: Math.max(0, seamDist) }
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Farb- und Relief-Textur in der Kugel-Abwicklung von THREE.SphereGeometry
 * (u = Längengrad, v = Breitengrad; Richtung = (−cos φ · sin θ, cos θ, sin φ · sin θ)).
 */
function buildTextures(w = 1024, h = 512): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const cc = document.createElement('canvas')
  const bc = document.createElement('canvas')
  cc.width = bc.width = w
  cc.height = bc.height = h
  const cctx = cc.getContext('2d')!
  const bctx = bc.getContext('2d')!
  const col = cctx.createImageData(w, h)
  const bmp = bctx.createImageData(w, h)
  const yellow = hexToRgb(BALL_COLORS.yellow)
  const blue = hexToRgb(BALL_COLORS.blue)
  const seam = hexToRgb(BALL_COLORS.seam)
  for (let py = 0; py < h; py++) {
    const theta = (Math.PI * (py + 0.5)) / h
    const st = Math.sin(theta)
    const ct = Math.cos(theta)
    for (let px = 0; px < w; px++) {
      const phi = (2 * Math.PI * (px + 0.5)) / w
      const p = panelAt(-Math.cos(phi) * st, ct, Math.sin(phi) * st)
      const base = p.color === 1 ? blue : yellow
      // Naht: dunkle Rille, Panel zum Rand hin leicht abgedunkelt (gepolstert)
      const inPanel = smooth(SEAM * 0.55, SEAM * 1.35, p.seamDist)
      const pillow = 0.86 + 0.14 * smooth(0, SEAM * 6, p.seamDist)
      const i = (py * w + px) * 4
      for (let c = 0; c < 3; c++) col.data[i + c] = Math.round(seam[c] + (base[c] * pillow - seam[c]) * inPanel)
      col.data[i + 3] = 255
      const relief = Math.round(255 * (0.15 + 0.85 * smooth(0, SEAM * 5, p.seamDist)))
      bmp.data[i] = bmp.data[i + 1] = bmp.data[i + 2] = relief
      bmp.data[i + 3] = 255
    }
  }
  cctx.putImageData(col, 0, 0)
  bctx.putImageData(bmp, 0, 0)
  const map = new THREE.CanvasTexture(cc)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 4
  const bump = new THREE.CanvasTexture(bc)
  return { map, bump }
}

let textures: { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } | null = null

/** Ball-Mesh mit offiziellem Durchmesser; die Texturen werden einmal erzeugt und geteilt. */
export function createVolleyballMesh(): THREE.Mesh {
  textures ??= buildTextures()
  const mat = new THREE.MeshStandardMaterial({
    map: textures.map,
    bumpMap: textures.bump,
    bumpScale: 1.6,
    roughness: 0.55,
    metalness: 0,
    // Etwas Eigenleuchten, damit der Ball in der dunklen Halle lesbar bleibt
    emissive: '#ffffff',
    emissiveMap: textures.map,
    emissiveIntensity: 0.12
  })
  return new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 48, 32), mat)
}
