import * as THREE from 'three'
import type { CourtSide, Role } from '@shared/types'
import { worldToThree } from '@renderer/core/geometry/transform'
import { TEAM_COLORS } from '@renderer/theme/colors'

/** Was eine 3D-Darstellung über einen Spieler wissen muss. */
export interface PlayerVisual {
  side: CourtSide
  role: Role
  number: number
}

/**
 * Austauschbare Erzeugung der Spielerfiguren.
 * Heute Zylinder; später kann eine Factory mit echten 3D-Modellen (z. B. GLTF) dieselbe Schnittstelle erfüllen.
 * Das Objekt steht mit den Füßen auf y = 0, Mittelpunkt bei x = z = 0; positioniert wird außen.
 */
export interface PlayerMeshFactory {
  create(v: PlayerVisual): THREE.Object3D
  dispose(obj: THREE.Object3D): void
}

const BODY_HEIGHT = 1.85
const BODY_RADIUS = 0.25

export class CylinderPlayerFactory implements PlayerMeshFactory {
  private geometry = new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, BODY_HEIGHT, 24)

  create(v: PlayerVisual): THREE.Object3D {
    const colors = TEAM_COLORS[v.side]
    const g = new THREE.Group()
    const body = new THREE.Mesh(
      this.geometry,
      new THREE.MeshStandardMaterial({
        color: v.role === 'L' ? colors.libero : colors.fill,
        emissive: colors.stroke,
        emissiveIntensity: 0.12,
        roughness: 0.7
      })
    )
    body.position.y = BODY_HEIGHT / 2
    g.add(body)

    // Schild über dem Kopf mit Kürzel und Nummer, immer zur Kamera gedreht
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: labelTexture(v), transparent: true, depthWrite: false })
    )
    label.scale.set(0.62, 0.62, 1)
    label.position.y = BODY_HEIGHT + 0.42
    g.add(label)
    return g
  }

  dispose(obj: THREE.Object3D): void {
    obj.traverse((o) => {
      const m = (o as THREE.Mesh | THREE.Sprite).material as THREE.Material & { map?: THREE.Texture | null }
      if (!m) return
      m.map?.dispose()
      m.dispose()
    })
  }
}

function labelTexture(v: PlayerVisual): THREE.Texture {
  const colors = TEAM_COLORS[v.side]
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
  ctx.fillStyle = v.role === 'L' ? colors.libero : colors.fill
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = colors.stroke
  ctx.stroke()
  ctx.fillStyle = colors.text
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 40px "Segoe UI", sans-serif'
  ctx.fillText(v.role, size / 2, size / 2 - 14)
  ctx.font = '32px "Segoe UI", sans-serif'
  ctx.fillText(String(v.number), size / 2, size / 2 + 26)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Spielerposition (Welt) → Three-Position */
export function placePlayer(obj: THREE.Object3D, x: number, y: number): void {
  const [tx, , tz] = worldToThree(x, y, 0)
  obj.position.set(tx, 0, tz)
}

/** Kennung, ob sich das Aussehen geändert hat (dann neu erzeugen statt nur verschieben). */
export function visualKey(v: PlayerVisual): string {
  return `${v.side}|${v.role}|${v.number}`
}
