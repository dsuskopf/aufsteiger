import * as THREE from 'three'
import { HEAD_DIAMETER, type CourtSide, type Role } from '@shared/types'
import type { JerseyStyle } from '@shared/teamColors'
import { worldToThree } from '@renderer/core/geometry/transform'

/** Was eine 3D-Darstellung über einen Spieler wissen muss. */
export interface PlayerVisual {
  side: CourtSide
  role: Role
  number: number
  jersey: JerseyStyle
  /** Körpergröße in Metern inkl. Kopf */
  height: number
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

const BODY_RADIUS = 0.25

/**
 * Zylinder als Körper plus Schild als Kopf; zusammen genau so hoch wie die Körpergröße.
 * Der Zylinder wird pro Spieler in der Höhe skaliert (eine gemeinsame Einheits-Geometrie).
 */
export class CylinderPlayerFactory implements PlayerMeshFactory {
  private geometry = new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, 1, 24)

  create(v: PlayerVisual): THREE.Object3D {
    const bodyHeight = Math.max(0.2, v.height - HEAD_DIAMETER)
    const colors = v.jersey
    const g = new THREE.Group()
    const body = new THREE.Mesh(
      this.geometry,
      new THREE.MeshStandardMaterial({
        color: colors.fill,
        emissive: colors.stroke,
        emissiveIntensity: 0.12,
        roughness: 0.7
      })
    )
    body.scale.y = bodyHeight
    body.position.y = bodyHeight / 2
    g.add(body)

    // Schild über dem Kopf mit Kürzel und Nummer, immer zur Kamera gedreht
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: labelTexture(v), transparent: true, depthWrite: false })
    )
    // Schild = Kopf: Durchmesser HEAD_DIAMETER, sitzt direkt auf dem Körper
    label.scale.set(HEAD_DIAMETER, HEAD_DIAMETER, 1)
    label.position.y = bodyHeight + HEAD_DIAMETER / 2
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
  const colors = v.jersey
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
  ctx.fillStyle = colors.fill
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
  return `${v.side}|${v.role}|${v.number}|${v.jersey.fill}|${v.height}`
}
