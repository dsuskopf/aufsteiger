import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CAMERA_LIMITS, clampTarget } from './camera'

/**
 * Kamera per Tastatur, wie in Aufbau- und Strategiespielen – alles um WASD herum:
 *   W/S vor/zurück, A/D links/rechts (parallel zum Boden, in Blickrichtung)
 *   Q/E um das Ziel drehen, T/G steiler/flacher kippen, Shift = schneller. Zoomen nur mit dem Mausrad
 *   (F schaltet die Flugbahn, siehe App).
 * Es zählen die Tasten an ihrer Stelle (KeyboardEvent.code), nicht die Beschriftung –
 * auf deutscher und englischer Tastatur liegen sie gleich.
 */
export const KEY_HELP: { keys: string; label: string }[] = [
  { keys: 'W A S D', label: 'bewegen' },
  { keys: 'Q E', label: 'drehen' },
  { keys: 'T G', label: 'kippen' },
  { keys: 'Mausrad', label: 'zoomen' },
  { keys: 'Shift', label: 'schneller' },
  { keys: '1–6', label: 'Blickwinkel' },
  { keys: 'B', label: 'Ballkamera' },
  { keys: 'L', label: 'Sperren (nur Kamera)' },
  { keys: 'F', label: 'Flugbahn ein/aus' }
]

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyT', 'KeyG'])

/** Tastatureingabe gehört gerade einem Eingabefeld (dann keine Kamera) */
export function typingTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  return tag === 'INPUT' && (el as HTMLInputElement).type !== 'range' && (el as HTMLInputElement).type !== 'checkbox'
}

export interface KeyCamera {
  /** Pro Bild aufrufen; true, wenn sich die Kamera bewegt hat */
  update(dt: number): boolean
  dispose(): void
}

/**
 * blocked(): keine Tastatur-Kamera (z. B. offener Dialog). onPan(): wird beim Verschieben gemeldet
 * (z. B. um die Ballkamera auszuschalten); onStart(): beim ersten Tastendruck (laufende Kamerafahrt abbrechen).
 */
export function createKeyCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  opts: { blocked: () => boolean; onStart?: () => void; onPan?: () => void }
): KeyCamera {
  const down = new Set<string>()
  let shift = false
  // Geglättete Geschwindigkeiten: vor, rechts, Drehung, Kippen
  const v = { f: 0, r: 0, rot: 0, tilt: 0 }

  const onDown = (e: KeyboardEvent) => {
    shift = e.shiftKey
    if (!MOVE_KEYS.has(e.code) || e.ctrlKey || e.metaKey || e.altKey || typingTarget(e) || opts.blocked()) return
    e.preventDefault()
    if (down.size === 0) opts.onStart?.()
    down.add(e.code)
  }
  const onUp = (e: KeyboardEvent) => {
    shift = e.shiftKey
    down.delete(e.code)
  }
  const clear = () => down.clear()
  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  window.addEventListener('blur', clear)

  const fwd = new THREE.Vector3()
  const right = new THREE.Vector3()
  const delta = new THREE.Vector3()
  const offset = new THREE.Vector3()
  const sph = new THREE.Spherical()
  const UP = new THREE.Vector3(0, 1, 0)

  const axis = (plus: string, minus: string) => (down.has(plus) ? 1 : 0) - (down.has(minus) ? 1 : 0)

  return {
    update(dt) {
      if (opts.blocked()) down.clear()
      const boost = shift ? 2.6 : 1
      const target = {
        f: axis('KeyW', 'KeyS') * boost,
        r: axis('KeyD', 'KeyA') * boost,
        rot: axis('KeyQ', 'KeyE') * boost,
        tilt: axis('KeyG', 'KeyT') * boost
      }
      // Weich anfahren und abbremsen
      const k = 1 - Math.exp(-dt * 12)
      let moving = false
      for (const key of Object.keys(v) as (keyof typeof v)[]) {
        v[key] += (target[key] - v[key]) * k
        if (Math.abs(v[key]) < 1e-3) v[key] = 0
        if (v[key] !== 0) moving = true
      }
      if (!moving) return false

      offset.subVectors(camera.position, controls.target)
      const dist = offset.length()
      // Verschieben: Geschwindigkeit wächst mit dem Abstand, damit es nah wie fern gleich schnell wirkt
      if (v.f || v.r) {
        fwd.set(-offset.x, 0, -offset.z)
        if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, -1).applyQuaternion(camera.quaternion).setY(0)
        fwd.normalize()
        right.crossVectors(fwd, UP).normalize()
        const speed = Math.max(3, dist * 0.75)
        delta.copy(fwd).multiplyScalar(v.f * speed * dt).addScaledVector(right, v.r * speed * dt)
        const before = controls.target.clone()
        const t = clampTarget(before.clone().add(delta))
        controls.target.set(t.x, t.y, t.z)
        camera.position.add(controls.target.clone().sub(before))
        offset.subVectors(camera.position, controls.target)
        opts.onPan?.()
      }
      sph.setFromVector3(offset)
      sph.theta += v.rot * 1.7 * dt
      sph.phi = Math.min(CAMERA_LIMITS.maxPolar, Math.max(CAMERA_LIMITS.minPolar + 0.02, sph.phi + v.tilt * 0.9 * dt))
      camera.position.setFromSpherical(sph).add(controls.target)
      camera.lookAt(controls.target)
      return true
    },
    dispose() {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
    }
  }
}
