import * as THREE from 'three'
import type { SketchStroke } from '@shared/types'
import { worldToThree } from '@renderer/core/geometry/transform'
import { COLORS } from '@renderer/theme/colors'

/** Höhe über dem Boden (über Feldlinien 0,002 m, unter den Zonen 0,003 m) */
const Y = 0.0025

/**
 * Die Zeichnungen der Skizze flach auf dem 3D-Feldboden: je Strichstück ein schmales Rechteck,
 * an jedem Punkt eine runde Kappe (dann gibt es keine Lücken in Kurven).
 */
export function buildSketch(strokes: SketchStroke[]): THREE.Group {
  const g = new THREE.Group()
  g.name = 'sketch'
  const mats = new Map<string, THREE.MeshBasicMaterial>()
  const mat = (c: string) => {
    let m = mats.get(c)
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false })
      mats.set(c, m)
    }
    return m
  }
  strokes.forEach((s, k) => {
    const m = mat(COLORS.sketch[s.color])
    const r = s.width / 2
    const cap = new THREE.CircleGeometry(r, 12)
    const p = s.points
    const order = 1 + k * 1e-3
    const dot = (x: number, y: number) => {
      const mesh = new THREE.Mesh(cap, m)
      const [tx, , tz] = worldToThree(x, y, 0)
      mesh.position.set(tx, Y, tz)
      mesh.rotation.x = -Math.PI / 2
      mesh.renderOrder = order
      g.add(mesh)
    }
    for (let i = 0; i + 1 < p.length; i += 2) {
      dot(p[i], p[i + 1])
      if (i + 3 >= p.length) break
      const dx = p[i + 2] - p[i]
      const dy = p[i + 3] - p[i + 1]
      const len = Math.hypot(dx, dy)
      if (len < 1e-4) continue
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, s.width), m)
      const [tx, , tz] = worldToThree(p[i] + dx / 2, p[i + 1] + dy / 2, 0)
      mesh.position.set(tx, Y, tz)
      mesh.rotation.x = -Math.PI / 2
      mesh.rotation.z = Math.atan2(dy, dx)
      mesh.renderOrder = order
      g.add(mesh)
    }
  })
  return g
}
