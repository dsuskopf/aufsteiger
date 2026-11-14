import * as THREE from 'three'
import { HEAD_DIAMETER, type CourtSide, type Role } from '@shared/types'
import type { JerseyStyle } from '@shared/teamColors'
import { worldToThree } from '@renderer/core/geometry/transform'
import { BODY } from '@renderer/core/motion/body'
import type { Skeleton, V3 } from '@renderer/core/motion/pose'
import type { ResolvedLook } from '@shared/looks'

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
  /** Körperbau, Hautton, Frisur, Haarfarbe */
  look: ResolvedLook
}

/** Name des Namensschilds im Spieler-Objekt (wird per showNameTag ein-/ausgeblendet) */
export const NAME_TAG = 'nameTag'
const LABELS = 'labels'
const BADGE = 'badge'

/**
 * Austauschbare Erzeugung der Spielerfiguren.
 * Das Objekt steht mit den Füßen auf y = 0 und blickt nach +x; Lage und Haltung setzt pose().
 * Eine Factory mit fertigen 3D-Modellen (z. B. GLTF) kann dieselbe Schnittstelle erfüllen.
 */
export interface PlayerMeshFactory {
  create(v: PlayerVisual): THREE.Object3D
  /** Figur in die Haltung bringen (Gelenke lokal, Lage in der Welt) */
  pose(obj: THREE.Object3D, sk: Skeleton): void
  dispose(obj: THREE.Object3D): void
}

const SHORTS = '#17171c'
const SHOE = '#ececf0'
const PAD = '#26262c'

interface Rig {
  H: number
  female: boolean
  torso: THREE.Group
  shoulders: THREE.Mesh
  hips: THREE.Mesh
  neck: THREE.Mesh
  head: THREE.Group
  arms: { sleeve: THREE.Mesh; upper: THREE.Mesh; fore: THREE.Mesh; elbow: THREE.Mesh; hand: THREE.Group }[]
  legs: { shorts: THREE.Mesh; thigh: THREE.Mesh; shin: THREE.Mesh; knee: THREE.Mesh; foot: THREE.Mesh }[]
  labels: THREE.Group
}

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _d = new THREE.Vector3()
const _x = new THREE.Vector3()
const _y = new THREE.Vector3()
const _z = new THREE.Vector3()
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const UP = new THREE.Vector3(0, 1, 0)

/** Zylinder zwischen zwei Punkten (Einheitsgeometrie: Höhe 1 entlang y, Radius 1) */
function stretch(mesh: THREE.Mesh, a: V3, b: V3, r0: number, r1 = r0): void {
  _a.set(a[0], a[1], a[2])
  _b.set(b[0], b[1], b[2])
  _d.subVectors(_b, _a)
  const len = Math.max(1e-4, _d.length())
  mesh.position.addVectors(_a, _b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(UP, _d.divideScalar(len))
  mesh.scale.set(r0, len, r1)
}
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]

/**
 * Spielerfigur aus einfachen Körpern: Rumpf im Trikot mit Rückennummer, Kopf, Arme mit Händen, Beine mit Schuhen.
 * Alle Figuren teilen sich die Geometrien; die Glieder werden pro Bild zwischen die Gelenke gespannt.
 */
export class HumanoidPlayerFactory implements PlayerMeshFactory {
  private limb = new THREE.CylinderGeometry(1, 1, 1, 12)
  private taper = new THREE.CylinderGeometry(1, 0.8, 1, 20)
  private ball = new THREE.SphereGeometry(1, 16, 12)
  private cap = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)
  private capLong = new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.72)
  /** Frauen: schmalere Schultern, Taille */
  private taperF = new THREE.CylinderGeometry(0.88, 0.78, 1, 20)
  private box = new THREE.BoxGeometry(1, 1, 1)
  private plane = new THREE.PlaneGeometry(1, 1)

  create(v: PlayerVisual): THREE.Object3D {
    const H = Math.max(0.6, v.height)
    const female = v.look.body === 'f'
    const g = new THREE.Group()
    const mat = (color: string, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness })
    const jersey = new THREE.MeshStandardMaterial({ color: v.jersey.fill, roughness: 0.7, emissive: v.jersey.fill, emissiveIntensity: 0.08 })
    const skin = mat(v.look.skin, 0.65)
    const shorts = mat(SHORTS)
    const shoe = mat(SHOE, 0.5)
    const pad = mat(PAD)
    const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = g) => {
      const o = new THREE.Mesh(geo, m)
      o.castShadow = true
      parent.add(o)
      return o
    }

    // Rumpf: nach oben breiter, mit Nummer auf Brust und Rücken (eigene Gruppe, damit die Nummern nicht verzerrt werden)
    const depth = 0.075 * H
    const width = 0.125 * H
    const torso = new THREE.Group()
    const body = mesh(female ? this.taperF : this.taper, jersey, torso)
    body.scale.set(depth * (female ? 0.95 : 1), BODY.spine * H * 1.02, width)
    const numTex = numberTexture(v.number, v.jersey.text)
    for (const dir of [1, -1]) {
      const label = new THREE.Mesh(this.plane, new THREE.MeshBasicMaterial({ map: numTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }))
      const size = (dir > 0 ? 0.11 : 0.16) * H
      label.scale.set(size, size, 1)
      label.position.set(dir * (depth * 0.93 + 0.004), (dir > 0 ? 0.07 : 0.03) * H, 0)
      label.rotation.y = (dir * Math.PI) / 2
      torso.add(label)
    }
    g.add(torso)

    const arms = [-1, 1].map(() => {
      const hand = new THREE.Group()
      const palm = mesh(this.ball, skin, hand)
      // Flache Hand mit gespreizten Fingern (so breit wie ihre Trefferfläche)
      palm.scale.set(0.014 * H, BODY.hand * 0.52 * H, 0.036 * H)
      const thumb = mesh(this.ball, skin, hand)
      thumb.scale.set(0.011 * H, 0.03 * H, 0.011 * H)
      thumb.name = 'thumb'
      g.add(hand)
      return { sleeve: mesh(this.limb, jersey), upper: mesh(this.limb, skin), fore: mesh(this.limb, skin), elbow: mesh(this.ball, skin), hand }
    })
    const legs = [-1, 1].map(() => ({
      shorts: mesh(this.limb, shorts),
      thigh: mesh(this.limb, skin),
      shin: mesh(this.limb, skin),
      knee: mesh(this.ball, pad),
      foot: mesh(this.box, shoe)
    }))

    const head = new THREE.Group()
    const skull = mesh(this.ball, skin, head)
    skull.scale.setScalar(BODY.headR * H)
    this.hair(head, v.look, BODY.headR * H, mesh, mat(v.look.hairColor, 0.9))
    g.add(head)

    // Schilder über dem Kopf: Rolle + Nummer, Name, Läufer-Abzeichen (immer zur Kamera gedreht)
    const labels = new THREE.Group()
    labels.name = LABELS
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(v), transparent: true, depthWrite: false }))
    badge.name = BADGE
    badge.scale.set(HEAD_DIAMETER * 0.7, HEAD_DIAMETER * 0.7, 1)
    labels.add(badge)
    const name = v.name?.trim()
    if (name) {
      const { tex, aspect } = nameTexture(name)
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
      const h = 0.24
      tag.scale.set(h * aspect, h, 1)
      tag.position.y = HEAD_DIAMETER * 0.4 + 0.18
      tag.name = NAME_TAG
      tag.visible = false
      labels.add(tag)
    }
    g.add(labels)

    const rig: Rig = { H, female, torso, shoulders: mesh(this.limb, jersey), hips: mesh(this.ball, shorts), neck: mesh(this.limb, skin), head, arms, legs, labels }
    g.userData.rig = rig
    return g
  }

  /**
   * Frisur am Kopf (lokal: x nach vorn, y nach oben, z nach rechts; r = Kopfradius).
   * Haare sitzen oben und hinten – so erkennt man auch von Weitem die Blickrichtung.
   */
  private hair(
    head: THREE.Group,
    look: ResolvedLook,
    r: number,
    mesh: (geo: THREE.BufferGeometry, m: THREE.Material, parent?: THREE.Object3D) => THREE.Mesh,
    m: THREE.Material
  ): void {
    const blob = (x: number, y: number, z: number, sx: number, sy = sx, sz = sx, rz = 0) => {
      const o = mesh(this.ball, m, head)
      o.position.set(x * r, y * r, z * r)
      o.scale.set(sx * r, sy * r, sz * r)
      o.rotation.z = rz
      return o
    }
    const cap = (scale: number, tilt: number, long = false) => {
      const o = mesh(long ? this.capLong : this.cap, m, head)
      o.scale.setScalar(scale * r)
      o.rotation.z = tilt
    }
    switch (look.hair) {
      case 'glatze':
        return
      case 'raspel':
        return cap(1.025, 0.42)
      case 'locken':
        cap(1.09, 0.45)
        for (const [x, y, z] of [[-0.5, 0.8, 0], [-0.15, 0.95, 0.3], [-0.15, 0.95, -0.3], [-0.8, 0.45, 0.4], [-0.8, 0.45, -0.4], [0.2, 0.92, 0], [-0.9, 0.1, 0]])
          blob(x, y, z, 0.26)
        return
      case 'zopf':
        cap(1.07, 0.45)
        blob(-0.92, 0.35, 0, 0.32)
        blob(-1.12, -0.35, 0, 0.24, 0.75, 0.24, -0.3)
        return
      case 'dutt':
        cap(1.07, 0.45)
        blob(-0.72, 0.82, 0, 0.42)
        return
      case 'bob':
        return cap(1.11, 0.55, true)
      case 'zoepfe':
        cap(1.07, 0.45)
        for (const z of [0.72, -0.72]) blob(-0.55, -0.55, z, 0.2, 0.75, 0.2)
        return
      default:
        cap(1.06, 0.5)
    }
  }

  pose(obj: THREE.Object3D, sk: Skeleton): void {
    const rig = obj.userData.rig as Rig | undefined
    if (!rig) return
    const H = rig.H
    const [tx, , tz] = worldToThree(sk.root.x, sk.root.y, 0)
    obj.position.set(tx, sk.root.z, tz)
    obj.rotation.y = sk.root.yaw

    // Rumpf zwischen Becken und Schulterlinie, um die Körperachse verdreht
    _a.set(...sk.pelvis)
    _b.set(...sk.chest)
    _d.subVectors(_b, _a).normalize()
    rig.torso.position.addVectors(_a, _b).multiplyScalar(0.5)
    rig.torso.quaternion.setFromUnitVectors(UP, _d)
    const twist = Math.atan2(-(sk.shoulderR[0] - sk.shoulderL[0]), sk.shoulderR[2] - sk.shoulderL[2])
    rig.torso.quaternion.multiply(_q.setFromAxisAngle(UP, -twist * 0.6))
    stretch(rig.shoulders, sk.shoulderL, sk.shoulderR, 0.05 * H)
    rig.hips.position.set(...sk.pelvis)
    rig.hips.scale.set(0.072 * H, 0.06 * H, (rig.female ? 0.118 : 0.105) * H)
    stretch(rig.neck, sk.chest, sk.head, 0.027 * H)
    rig.head.position.set(...sk.head)

    const arm = (i: number, shoulder: V3, elbow: V3, wrist: V3, hand: V3, palm: V3) => {
      const a = rig.arms[i]
      // Frauen-Trikots: kürzere Ärmel
      const mid = lerp3(shoulder, elbow, rig.female ? 0.32 : 0.55)
      stretch(a.sleeve, shoulder, mid, (rig.female ? 0.033 : 0.036) * H)
      stretch(a.upper, mid, elbow, 0.027 * H)
      stretch(a.fore, elbow, wrist, 0.023 * H)
      a.elbow.position.set(...elbow)
      a.elbow.scale.setScalar(0.027 * H)
      // Hand: Längsachse in Unterarm-Richtung, flache Seite zur Handflächen-Richtung
      _y.set(hand[0] - elbow[0], hand[1] - elbow[1], hand[2] - elbow[2]).normalize()
      _x.set(...palm)
      _x.addScaledVector(_y, -_x.dot(_y))
      if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0).addScaledVector(_y, -_y.x)
      _x.normalize()
      _z.crossVectors(_x, _y)
      a.hand.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z))
      a.hand.position.set(...hand)
      const thumb = a.hand.getObjectByName('thumb')!
      // Daumen innen (zum Körper hin)
      thumb.position.set(0, -0.012 * H, (i === 0 ? 1 : -1) * 0.034 * H)
    }
    arm(0, sk.shoulderL, sk.elbowL, sk.wristL, sk.handL, sk.palmL)
    arm(1, sk.shoulderR, sk.elbowR, sk.wristR, sk.handR, sk.palmR)

    const leg = (i: number, hip: V3, knee: V3, foot: V3) => {
      const l = rig.legs[i]
      // Frauen: kurze, enge Hosen
      const mid = lerp3(hip, knee, rig.female ? 0.26 : 0.5)
      stretch(l.shorts, hip, mid, (rig.female ? 0.052 : 0.055) * H)
      stretch(l.thigh, mid, knee, (rig.female ? 0.044 : 0.042) * H)
      stretch(l.shin, knee, foot, 0.033 * H)
      l.knee.position.set(...knee)
      l.knee.scale.setScalar(0.043 * H)
      // Schuh: flach, Spitze nach vorn; in der Luft etwas gestreckt
      const lifted = Math.max(0, foot[1] - BODY.ankle * H)
      l.foot.scale.set(BODY.foot * H, 0.045 * H, 0.055 * H)
      l.foot.position.set(foot[0] + 0.035 * H, foot[1] - 0.012 * H, foot[2])
      l.foot.rotation.set(0, 0, -Math.min(0.7, lifted * 4))
    }
    leg(0, sk.hipL, sk.kneeL, sk.footL)
    leg(1, sk.hipR, sk.kneeR, sk.footR)

    // Schild über dem Kopf – und über den Händen, wenn die Arme oben sind (verdeckt so nie den Ballkontakt)
    const top = Math.max(sk.head[1] + BODY.headR * H, sk.handL[1] + 0.12, sk.handR[1] + 0.12)
    rig.labels.position.set(sk.head[0], top + HEAD_DIAMETER * 0.35 + 0.1, sk.head[2])
  }

  dispose(obj: THREE.Object3D): void {
    // Geometrien gehören der Factory; Materialien und Texturen dem Spieler
    obj.traverse((o) => {
      const m = (o as THREE.Mesh | THREE.Sprite).material as (THREE.Material & { map?: THREE.Texture | null }) | undefined
      if (!m) return
      m.map?.dispose()
      m.dispose()
    })
  }

  /** Gemeinsame Geometrien freigeben (wenn die Ansicht geschlossen wird) */
  destroy(): void {
    for (const geo of [this.limb, this.taper, this.taperF, this.ball, this.cap, this.capLong, this.box, this.plane]) geo.dispose()
  }
}

function numberTexture(n: number, color: string): THREE.Texture {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${n > 9 ? 84 : 100}px "Segoe UI", system-ui, sans-serif`
  ctx.fillText(String(n), size / 2, size / 2 + 6)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
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
 * Läufer-Abzeichen „L2“ am Bezugs-Steller: kleines Schild oben rechts am Kopfschild, immer zur Kamera gedreht.
 * Steht der Libero für den Steller, ist das Schild nur umrandet.
 */
export function setLaeuferMark(obj: THREE.Object3D, mark: { standIn: boolean; n: number } | undefined, color: string, dark: string): void {
  const labels = obj.getObjectByName(LABELS) ?? obj
  const key = mark ? `${mark.n}|${mark.standIn}` : ''
  const old = labels.getObjectByName(MARK) as THREE.Sprite | undefined
  if (old && old.userData.key !== key) {
    labels.remove(old)
    old.material.map?.dispose()
    old.material.dispose()
  }
  if (!mark || labels.getObjectByName(MARK)) return
  const c = document.createElement('canvas')
  c.width = 108
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.beginPath()
  ctx.roundRect(4, 4, 100, 56, 28)
  ctx.fillStyle = mark.standIn ? dark : color
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.fillStyle = mark.standIn ? color : dark
  ctx.font = 'bold 36px "Segoe UI", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`L${mark.n}`, 54, 34)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
  const h = 0.18
  badge.scale.set(h * (108 / 64), h, 1)
  // Anker in der Mitte des Kopfschilds, nach rechts oben versetzt (in Bildschirmrichtung)
  badge.center.set(-0.15, -0.35)
  badge.name = MARK
  badge.userData.key = key
  badge.renderOrder = 4
  labels.add(badge)
}

/** Namensschilder eines Spieler-Objekts ein-/ausblenden */
export function showNameTag(obj: THREE.Object3D, show: boolean): void {
  const tag = obj.getObjectByName(NAME_TAG)
  if (tag) tag.visible = show
}

/** Kennung, ob sich das Aussehen geändert hat (dann neu erzeugen statt nur bewegen). */
export function visualKey(v: PlayerVisual): string {
  const l = v.look
  return `${v.side}|${v.role}|${v.number}|${v.jersey.fill}|${v.jersey.text}|${v.height}|${v.name ?? ''}|${l.body}|${l.skin}|${l.hair}|${l.hairColor}`
}
