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
  /** Name (leer = kein Namensschild) */
  name?: string
}

/** Name des Namensschilds im Spieler-Objekt (wird per showNameTags ein-/ausgeblendet) */
export const NAME_TAG = 'nameTag'

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

    // Namensschild über dem Kopf (nur mit Namen; sichtbar, wenn Namen eingeblendet sind)
    const name = v.name?.trim()
    if (name) {
      const { tex, aspect } = nameTexture(name)
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
      const h = 0.26
      tag.scale.set(h * aspect, h, 1)
      tag.position.y = v.height + 0.22
      tag.name = NAME_TAG
      tag.visible = false
      g.add(tag)
    }
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

function nameTexture(name: string): { tex: THREE.Texture; aspect: number } {
  const h = 64
  const font = 'bold 38px "Segoe UI", system-ui, sans-serif'
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = font
  const w = Math.ceil(measure.measureText(name).width) + 32
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = 'rgba(12, 12, 14, 0.72)'
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, h / 2)
  ctx.fill()
  ctx.font = font
  ctx.fillStyle = '#ececf0'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, w / 2, h / 2 + 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return { tex, aspect: w / h }
}

const MARK = 'laeuferMark'

/**
 * Bezugs-Steller des Läufersystems: leuchtender Ring auf dem Boden unter dem Spieler (gestrichelt wirkt in 3D
 * unruhig – der Libero als Vertreter bekommt einen schmaleren Ring).
 */
export function setLaeuferMark(obj: THREE.Object3D, mark: { standIn: boolean } | undefined, color: string): void {
  const old = obj.getObjectByName(MARK)
  if (old && (!mark || old.userData.standIn !== mark.standIn)) {
    obj.remove(old)
    old.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      ;(m.material as THREE.Material | undefined)?.dispose()
    })
  }
  if (!mark || obj.getObjectByName(MARK)) return
  const g = new THREE.Group()
  g.name = MARK
  g.userData.standIn = mark.standIn
  const inner = mark.standIn ? 0.36 : 0.34
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(inner, mark.standIn ? 0.4 : 0.44, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false })
  )
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.62, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending })
  )
  for (const m of [glow, ring]) {
    m.rotation.x = -Math.PI / 2
    m.position.y = 0.015
    m.renderOrder = 3
    g.add(m)
  }
  obj.add(g)
}

/** Namensschilder eines Spieler-Objekts ein-/ausblenden */
export function showNameTag(obj: THREE.Object3D, show: boolean): void {
  const tag = obj.getObjectByName(NAME_TAG)
  if (tag) tag.visible = show
}

/** Spielerposition (Welt) → Three-Position */
export function placePlayer(obj: THREE.Object3D, x: number, y: number): void {
  const [tx, , tz] = worldToThree(x, y, 0)
  obj.position.set(tx, 0, tz)
}

/** Kennung, ob sich das Aussehen geändert hat (dann neu erzeugen statt nur verschieben). */
export function visualKey(v: PlayerVisual): string {
  return `${v.side}|${v.role}|${v.number}|${v.jersey.fill}|${v.height}|${v.name ?? ''}`
}
