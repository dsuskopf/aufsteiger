import * as THREE from 'three'
import { COURT, courtLines } from '@renderer/core/geometry/court'
import { worldToThree } from '@renderer/core/geometry/transform'
import { COLORS } from '@renderer/theme/colors'

const LINE_Y = 0.002

/** Boden + Feldlinien (statisch). */
export function buildCourt(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'court'

  const fzW = COURT.length + 2 * COURT.freeZone + 4
  const fzD = COURT.width + 2 * COURT.freeZone + 4
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(fzW, fzD),
    new THREE.MeshStandardMaterial({ color: COLORS.freeZone, roughness: 0.95 })
  )
  floor.rotation.x = -Math.PI / 2
  g.add(floor)

  const court = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.length, COURT.width),
    new THREE.MeshStandardMaterial({ color: COLORS.courtFloor, roughness: 0.9 })
  )
  court.rotation.x = -Math.PI / 2
  court.position.y = LINE_Y / 2
  g.add(court)

  const lineMat = new THREE.MeshBasicMaterial({ color: COLORS.line })
  const attackMat = new THREE.MeshBasicMaterial({ color: COLORS.lineDim })
  for (const l of courtLines()) {
    const dx = l.b.x - l.a.x
    const dy = l.b.y - l.a.y
    const len = Math.hypot(dx, dy) + COURT.lineWidth
    const geo = new THREE.PlaneGeometry(len, COURT.lineWidth)
    const mesh = new THREE.Mesh(geo, l.kind === 'attack' ? attackMat : lineMat)
    mesh.rotation.x = -Math.PI / 2
    const [tx, , tz] = worldToThree((l.a.x + l.b.x) / 2, (l.a.y + l.b.y) / 2, 0)
    mesh.position.set(tx, LINE_Y, tz)
    // Winkel in der Bodenebene (Welt-y → Three −z)
    mesh.rotation.z = Math.atan2(dy, dx)
    g.add(mesh)
  }
  return g
}

/** Netz, Pfosten und Antennen für eine gegebene Netzhöhe. */
export function buildNet(netHeight: number): THREE.Group {
  const g = new THREE.Group()
  g.name = 'net'
  const postY = COURT.halfWidth + COURT.postDistFromSideline

  // Netzfläche (halbtransparent mit Maschen-Textur)
  const netMat = new THREE.MeshBasicMaterial({
    map: meshTexture(),
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  })
  const net = new THREE.Mesh(new THREE.PlaneGeometry(COURT.netWidth, COURT.netBandDepth), netMat)
  net.rotation.y = Math.PI / 2
  net.position.set(0, netHeight - COURT.netBandDepth / 2, 0)
  g.add(net)

  // Oberkante + Unterkante
  const bandMat = new THREE.MeshBasicMaterial({ color: '#c9c9cf' })
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, COURT.netWidth), bandMat)
  top.position.set(0, netHeight - 0.035, 0)
  g.add(top)
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, COURT.netWidth), bandMat)
  bottom.position.set(0, netHeight - COURT.netBandDepth, 0)
  g.add(bottom)

  // Pfosten
  const postMat = new THREE.MeshStandardMaterial({ color: '#55555c', metalness: 0.4, roughness: 0.5 })
  for (const side of [-1, 1]) {
    const h = netHeight + 0.1
    const post = new THREE.Mesh(new THREE.CylinderGeometry(COURT.postRadius, COURT.postRadius, h, 16), postMat)
    const [tx, , tz] = worldToThree(0, side * postY, 0)
    post.position.set(tx, h / 2, tz)
    g.add(post)
  }

  for (const side of [-1, 1]) g.add(buildAntenna(netHeight, side))
  return g
}

/**
 * Seitenband + Antenne wie im echten Spiel: Das Seitenband (5 cm, weiß) liegt senkrecht über der Seitenlinie,
 * die Antenne sitzt an seiner Außenkante. Auf Netzhöhe steckt sie in einer Stofftasche,
 * oberhalb der Netzkante ragt sie 80 cm rot-weiß gestreift (10-cm-Felder) heraus.
 */
function buildAntenna(netHeight: number, side: number): THREE.Group {
  const g = new THREE.Group()
  const netBottom = netHeight - COURT.netBandDepth
  const white = new THREE.MeshStandardMaterial({ color: '#e6e6ea', roughness: 0.6 })
  const red = new THREE.MeshStandardMaterial({ color: '#c62828', roughness: 0.5 })

  // Seitenband: von der Seitenlinie (innen) bis zur Außenkante der Linie
  const bandY = side * (COURT.halfWidth - COURT.sideBandWidth / 2)
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.012, COURT.netBandDepth, COURT.sideBandWidth), white)
  const [bx, , bz] = worldToThree(0, bandY, 0)
  band.position.set(bx, netBottom + COURT.netBandDepth / 2, bz)
  g.add(band)

  // Antenne an der Außenkante des Seitenbands
  const antY = side * (COURT.halfWidth + COURT.antennaPocketRadius)
  const [ax, , az] = worldToThree(0, antY, 0)

  // Tasche (Stoffhülle) über die gesamte Netzhöhe
  const pocket = new THREE.Mesh(
    new THREE.CylinderGeometry(COURT.antennaPocketRadius, COURT.antennaPocketRadius, COURT.netBandDepth, 16),
    new THREE.MeshStandardMaterial({ color: '#d4d4da', roughness: 0.85 })
  )
  pocket.position.set(ax, netBottom + COURT.netBandDepth / 2, az)
  g.add(pocket)

  // Rot-weiße Felder ab der Netzkante; das oberste Feld ist rot
  const n = Math.round(COURT.antennaHeightAboveNet / COURT.antennaStripe)
  const stripeGeo = new THREE.CylinderGeometry(COURT.antennaRadius, COURT.antennaRadius, COURT.antennaStripe, 12)
  for (let i = 0; i < n; i++) {
    const isRed = (n - 1 - i) % 2 === 0
    const stripe = new THREE.Mesh(stripeGeo, isRed ? red : white)
    stripe.position.set(ax, netHeight + COURT.antennaStripe * (i + 0.5), az)
    g.add(stripe)
  }
  return g
}

let cachedTexture: THREE.Texture | null = null
function meshTexture(): THREE.Texture {
  if (cachedTexture) return cachedTexture
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 64, 64)
  ctx.strokeStyle = 'rgba(200,200,210,0.55)'
  ctx.lineWidth = 3
  ctx.strokeRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  // Maschenweite ca. 10 cm
  tex.repeat.set(COURT.netWidth / 0.1, COURT.netBandDepth / 0.1)
  tex.anisotropy = 4
  cachedTexture = tex
  return tex
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
    else mat?.dispose()
  })
}
