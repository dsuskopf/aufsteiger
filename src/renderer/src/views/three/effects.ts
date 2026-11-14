import * as THREE from 'three'
import { worldToThree } from '@renderer/core/geometry/transform'
import type { BallEvent } from '@renderer/core/physics/rally'
import { BALL_RADIUS } from '@renderer/core/physics/trajectory'
import { ballAt, type Timeline } from '@renderer/core/timeline/timeline'
import { COLORS } from '@renderer/theme/colors'
import type { AntennaHit, NetHit } from './courtScene'

/**
 * Effekte rund um die Ballkontakte – alle als reine Funktion der Zeit, damit sie beim Abspielen,
 * beim Ziehen an der Zeitleiste und Bild für Bild gleich aussehen:
 *  - Ring auf dem Boden, wo der Ball aufschlägt
 *  - kurzes Aufblitzen bei Schlag und Block
 *  - Nachzieh-Spur hinter schnellen Bällen
 *  - Kamera-Wackeln bei harten Kontakten
 */

const RINGS = 3
const FLASHES = 3
const GHOSTS = 6
const RING_TIME = 0.55
const FLASH_TIME = 0.16
/** Ab dieser Ballgeschwindigkeit (m/s) zieht der Ball eine Spur */
const TRAIL_FROM = 9
const GHOST_DT = 0.011

/** Wie hart ist der Kontakt (0–1)? Bestimmt Wackeln, Ringgröße und Lautstärke. */
export function hardness(e: BallEvent): number {
  const k = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)))
  switch (e.kind) {
    case 'schlag':
      return e.finte ? 0.05 : k(e.speed, 10, 32)
    case 'block':
      return 0.35 + 0.65 * k(e.speed, 8, 30)
    case 'boden':
      return k(e.speed, 5, 26)
    case 'netz':
      return 0.25 * k(e.speed, 4, 25)
    case 'netzkante':
      return 0.15
    case 'antenne':
      return 0.3
    case 'annahme':
      return 0.12
    default:
      return 0.04
  }
}

export function buildEffects(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'effects'
  const ringGeo = new THREE.RingGeometry(0.86, 1, 48)
  for (let i = 0; i < RINGS; i++) {
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COLORS.trajectory, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }))
    ring.rotation.x = -Math.PI / 2
    ring.name = `ring${i}`
    ring.visible = false
    g.add(ring)
  }
  const tex = glowTexture()
  for (let i = 0; i < FLASHES; i++) {
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
    flash.name = `flash${i}`
    flash.visible = false
    flash.renderOrder = 5
    g.add(flash)
  }
  const ghostGeo = new THREE.SphereGeometry(BALL_RADIUS, 16, 12)
  for (let i = 0; i < GHOSTS; i++) {
    const ghost = new THREE.Mesh(ghostGeo, new THREE.MeshBasicMaterial({ color: '#f2e6a0', transparent: true, opacity: 0, depthWrite: false }))
    ghost.name = `ghost${i}`
    ghost.visible = false
    g.add(ghost)
  }
  return g
}

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,244,200,0.55)')
  grad.addColorStop(1, 'rgba(255,244,200,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Effekte zur Zeit t setzen */
export function updateEffects(g: THREE.Object3D, events: BallEvent[], tl: Timeline<string>, t: number, total: number): void {
  // Am Anfang und Ende (zum Bearbeiten) keine Effekte
  const live = t > 1e-6 && t < total - 1e-6

  let r = 0
  let f = 0
  if (live)
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]
      const age = t - e.t
      if (age < 0) continue
      const h = hardness(e)
      if (e.kind === 'boden' && age < RING_TIME && h > 0.05 && r < RINGS) {
        const ring = g.getObjectByName(`ring${r++}`) as THREE.Mesh
        const k = age / RING_TIME
        ring.visible = true
        ring.position.set(...worldToThree(e.x, e.y, 0.008))
        ring.scale.setScalar(0.14 + (0.5 + 1.3 * h) * (1 - (1 - k) ** 2))
        ;(ring.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (0.35 + 0.5 * h)
      }
      if ((e.kind === 'schlag' || e.kind === 'block' || e.kind === 'antenne') && age < FLASH_TIME && h > 0.2 && f < FLASHES) {
        const flash = g.getObjectByName(`flash${f++}`) as THREE.Sprite
        const k = age / FLASH_TIME
        flash.visible = true
        flash.position.set(...worldToThree(e.x, e.y, e.z))
        flash.scale.setScalar(0.3 + (0.5 + 0.9 * h) * k)
        flash.material.opacity = (1 - k) * (0.4 + 0.5 * h)
      }
    }
  for (; r < RINGS; r++) g.getObjectByName(`ring${r}`)!.visible = false
  for (; f < FLASHES; f++) g.getObjectByName(`flash${f}`)!.visible = false

  // Spur: blasse Bälle an den Orten kurz zuvor – je schneller, desto deutlicher
  let speed = 0
  if (live) {
    const a = ballAt(tl, t)
    const b = ballAt(tl, Math.max(0, t - 0.004))
    if (a && b && t > 0.004) speed = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) / 0.004
  }
  const strength = Math.min(1, Math.max(0, (speed - TRAIL_FROM) / 16))
  for (let i = 0; i < GHOSTS; i++) {
    const ghost = g.getObjectByName(`ghost${i}`) as THREE.Mesh
    const tg = t - (i + 1) * GHOST_DT
    const p = strength > 0 && tg > 0 ? ballAt(tl, tg) : null
    ghost.visible = !!p
    if (!p) continue
    ghost.position.set(...worldToThree(p.x, p.y, Math.max(BALL_RADIUS, p.z)))
    ghost.scale.setScalar(1 - (i + 1) * 0.07)
    ;(ghost.material as THREE.MeshBasicMaterial).opacity = strength * 0.32 * (1 - i / GHOSTS)
  }
}

/** Treffer an den Antennen zur Zeit t (für das Biegen) */
export function antennaHits(events: BallEvent[], t: number, total: number): AntennaHit[] {
  if (t <= 1e-6 || t >= total - 1e-6) return []
  const out: AntennaHit[] = []
  for (const e of events) {
    if (e.kind !== 'antenne') continue
    const age = t - e.t
    if (age < 0 || age > 2) continue
    out.push({ side: Math.sign(e.y) || 1, age, strength: Math.min(0.32, 0.05 + e.speed * 0.011), dx: e.dir ?? 1, dy: 0.25 * (Math.sign(e.y) || 1) })
  }
  return out
}

/** Treffer im Netz zur Zeit t (für die Ausbeulung) */
export function netHits(events: BallEvent[], t: number, total: number): NetHit[] {
  if (t <= 1e-6 || t >= total - 1e-6) return []
  const out: NetHit[] = []
  for (const e of events) {
    if (e.kind !== 'netz' && e.kind !== 'netzkante') continue
    const age = t - e.t
    if (age < 0 || age > 1.6) continue
    const strength = e.kind === 'netz' ? Math.min(0.42, 0.08 + e.speed * 0.014) : Math.min(0.12, 0.03 + e.speed * 0.004)
    out.push({ y: e.y, z: e.z, age, strength, dir: e.dir ?? 1 })
  }
  return out
}

/**
 * Geräusch eines Ballereignisses gedämpft wie das Kamera-Wackeln: Nur der erste Bodenkontakt klingt voll,
 * das Nachspringen danach leise und weicher – mit jedem weiteren Aufprall noch leiser.
 * Gibt den Lautstärke-Faktor und die Härte für den Klang zurück.
 */
export function sfxLevel(events: BallEvent[], e: BallEvent): { gain: number; hard: number } {
  const hard = hardness(e)
  if (e.kind !== 'boden') return { gain: 1, hard }
  const i = events.filter((x) => x.kind === 'boden').indexOf(e)
  if (i <= 0) return { gain: 1, hard }
  return { gain: 0.22 * Math.pow(0.6, i - 1), hard: hard * 0.5 }
}

/**
 * Kamera-Wackeln zur Zeit t: kurzer, schnell abklingender Stoß nach harten Kontakten.
 * Gibt den Versatz als Anteil des Kamera-Abstands zurück (damit es in jeder Zoomstufe gleich wirkt).
 */
export function cameraShake(events: BallEvent[], t: number, out: THREE.Vector3): THREE.Vector3 {
  out.set(0, 0, 0)
  // Nur der erste Aufprall darf wackeln; das Nachspringen danach ist kaum zu spüren
  const firstFloor = events.find((e) => e.kind === 'boden')
  for (const e of events) {
    const age = t - e.t
    if (age < 0 || age > 0.4) continue
    const later = e.kind === 'boden' && e !== firstFloor
    const h = hardness(e) * (later ? 0.15 : 1)
    if (h < (later ? 0.08 : 0.25)) continue
    const amp = h * Math.exp(-age / 0.085) * 0.0065
    out.x += amp * Math.sin(age * 96 + e.t * 7)
    out.y += amp * Math.sin(age * 121 + 1.3 + e.t * 3)
    out.z += amp * Math.sin(age * 73 + 2.1)
  }
  return out
}
