import * as THREE from 'three'
import type { ZoneStyle } from '@shared/types'
import { worldToThree } from '@renderer/core/geometry/transform'
import { zoneLayout, type ZoneLabel } from '@renderer/core/geometry/zones'
import { COLORS } from '@renderer/theme/colors'

/** Höhe über dem Boden (über den Feldlinien bei 0,002 m) */
const LINE_Y = 0.003
const LABEL_Y = 0.004
const LABEL_NAME = 'zoneLabel'

/**
 * Zonen auf dem 3D-Feldboden: Linien liegen fest, Zahlen/Buchstaben liegen flach auf dem Boden
 * an fester Stelle und werden mit orientZoneLabels() zur Kamera gedreht, damit sie immer lesbar sind.
 */
export function buildZones(style: ZoneStyle): THREE.Group {
  const g = new THREE.Group()
  g.name = 'zones'
  const layout = zoneLayout(style)

  const zoneMat = new THREE.MeshBasicMaterial({ color: COLORS.line, transparent: true, opacity: 0.5, depthWrite: false })
  const subMat = new THREE.MeshBasicMaterial({ color: COLORS.line, transparent: true, opacity: 0.3, depthWrite: false })
  for (const l of layout.lines) {
    const dx = l.b.x - l.a.x
    const dy = l.b.y - l.a.y
    const len = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx)
    // Unterzonen gestrichelt
    const pieces: [number, number][] = l.kind === 'zone' ? [[0, len]] : dashes(len, 0.15, 0.12)
    const width = l.kind === 'zone' ? 0.03 : 0.022
    for (const [s0, s1] of pieces) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s1 - s0, width), l.kind === 'zone' ? zoneMat : subMat)
      const mid = (s0 + s1) / 2 / len
      const [tx, , tz] = worldToThree(l.a.x + dx * mid, l.a.y + dy * mid, 0)
      mesh.position.set(tx, LINE_Y, tz)
      mesh.rotation.x = -Math.PI / 2
      mesh.rotation.z = angle
      mesh.renderOrder = 1
      g.add(mesh)
    }
  }

  for (const label of layout.labels) g.add(labelMesh(label))
  return g
}

/**
 * Dreht alle Beschriftungen um die senkrechte Achse, sodass ihre Oberkante von der Kamera weg zeigt
 * (Kamera-Azimut um das Blickziel). Die Position jeder Beschriftung bleibt unverändert.
 */
export function orientZoneLabels(group: THREE.Object3D, camera: THREE.Camera, target: THREE.Vector3): void {
  const theta = Math.atan2(camera.position.x - target.x, camera.position.z - target.z)
  for (const child of group.children) if (child.name === LABEL_NAME) child.rotation.y = theta
}

function dashes(len: number, dash: number, gap: number): [number, number][] {
  const out: [number, number][] = []
  for (let s = 0; s < len; s += dash + gap) out.push([s, Math.min(len, s + dash)])
  return out
}

function labelMesh(l: ZoneLabel): THREE.Mesh {
  const px = 256
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')!
  // Fläche = 2 × Schrifthöhe, Schrift füllt die Hälfte
  const fs = px / 2
  if (l.disc) {
    ctx.beginPath()
    ctx.arc(px / 2, px / 2, fs * 0.62, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.courtFloor
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = withAlpha(COLORS.line, 0.6)
    ctx.stroke()
  }
  ctx.font = `${l.kind === 'zone' ? 'bold ' : ''}${fs}px system-ui, "Segoe UI", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = l.kind === 'zone' ? withAlpha(COLORS.text, 0.5) : withAlpha(COLORS.textDim, 0.7)
  // Ziffern sitzen mit „middle“ etwas zu hoch; leicht nach unten
  ctx.fillText(l.text, px / 2, px / 2 + fs * 0.05)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  const size = l.size * 2
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat)
  mesh.name = LABEL_NAME
  const [tx, , tz] = worldToThree(l.x, l.y, 0)
  mesh.position.set(tx, LABEL_Y, tz)
  // Erst flach legen (x), dann um die Senkrechte drehen (y): Reihenfolge YXZ
  mesh.rotation.order = 'YXZ'
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = 2
  return mesh
}

function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
