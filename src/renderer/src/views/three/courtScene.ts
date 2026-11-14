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
  floor.receiveShadow = true
  g.add(floor)

  const court = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.length, COURT.width),
    new THREE.MeshStandardMaterial({ color: COLORS.courtFloor, roughness: 0.9 })
  )
  court.rotation.x = -Math.PI / 2
  court.position.y = LINE_Y / 2
  court.receiveShadow = true
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
  // Fein unterteilt, damit das Netz ausbeulen kann, wenn der Ball hineinfliegt (deformNet)
  const flex: THREE.Mesh[] = []
  const strip = (height: number, y: number, mat: THREE.Material, segH: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(COURT.netWidth, height, NET_SEGMENTS, segH), mat)
    m.rotation.y = Math.PI / 2
    m.position.set(0, y, 0)
    m.userData.base = Float32Array.from(m.geometry.attributes.position.array)
    flex.push(m)
    g.add(m)
    return m
  }
  strip(COURT.netBandDepth, netHeight - COURT.netBandDepth / 2, netMat, 10)

  // Oberkante + Unterkante (Bänder)
  const bandMat = new THREE.MeshBasicMaterial({ color: '#c9c9cf', side: THREE.DoubleSide })
  strip(0.07, netHeight - 0.035, bandMat, 1)
  strip(0.025, netHeight - COURT.netBandDepth, bandMat, 1)
  g.userData.flex = flex
  g.userData.netHeight = netHeight

  // Pfosten
  const postMat = new THREE.MeshStandardMaterial({ color: '#55555c', metalness: 0.4, roughness: 0.5 })
  for (const side of [-1, 1]) {
    const h = netHeight + 0.1
    const post = new THREE.Mesh(new THREE.CylinderGeometry(COURT.postRadius, COURT.postRadius, h, 16), postMat)
    const [tx, , tz] = worldToThree(0, side * postY, 0)
    post.position.set(tx, h / 2, tz)
    g.add(post)
  }

  // Abspannseile oben und unten vom Netzende zum Pfosten, grau wie die Pfosten
  const ropeMat = new THREE.MeshStandardMaterial({ color: '#55555c', metalness: 0.3, roughness: 0.6 })
  const ropeLen = postY - COURT.netWidth / 2
  for (const side of [-1, 1])
    for (const h of [netHeight - 0.035, netHeight - COURT.netBandDepth]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, ropeLen, 8), ropeMat)
      rope.rotation.x = Math.PI / 2
      const [tx, , tz] = worldToThree(0, side * (COURT.netWidth / 2 + ropeLen / 2), 0)
      rope.position.set(tx, h, tz)
      g.add(rope)
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
  // Unbeleuchtete Materialien wie bei der Netzkante, damit Band, Tasche und Antenne gleich hell wirken
  const white = new THREE.MeshBasicMaterial({ color: '#e6e6ea' })
  const red = new THREE.MeshBasicMaterial({ color: '#d63230' })

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
    new THREE.MeshBasicMaterial({ color: '#d5d5da' })
  )
  pocket.position.set(ax, netBottom + COURT.netBandDepth / 2, az)
  g.add(pocket)

  // Rot-weiße Felder ab der Netzkante; das oberste Feld ist rot. Als eigene Gruppe mit dem Drehpunkt an der
  // Netzkante, damit sich die Antenne biegen kann, wenn der Ball sie trifft (bendAntennas)
  const top = new THREE.Group()
  top.name = 'antennaTop'
  top.position.set(ax, netHeight, az)
  top.userData.side = side
  const n = Math.round(COURT.antennaHeightAboveNet / COURT.antennaStripe)
  const stripeGeo = new THREE.CylinderGeometry(COURT.antennaDisplayRadius, COURT.antennaDisplayRadius, COURT.antennaStripe, 16)
  for (let i = 0; i < n; i++) {
    const isRed = (n - 1 - i) % 2 === 0
    const stripe = new THREE.Mesh(stripeGeo, isRed ? red : white)
    stripe.position.set(0, COURT.antennaStripe * (i + 0.5), 0)
    top.add(stripe)
  }
  g.add(top)
  return g
}

/** Treffer an einer Antenne: Seite (Vorzeichen von y), Zeit seit dem Treffer, Stärke (rad), Flugrichtung (x, y) */
export interface AntennaHit {
  side: number
  age: number
  strength: number
  dx: number
  dy: number
}

/**
 * Antennen biegen: Der getroffene Stab gibt in Flugrichtung nach und schwingt gedämpft aus (Glasfaser).
 * Reine Funktion der Treffer – stimmt auch beim Zurückspulen.
 */
export function bendAntennas(net: THREE.Object3D | null, hits: AntennaHit[]): void {
  if (!net) return
  net.traverse((o) => {
    if (o.name !== 'antennaTop') return
    let bx = 0
    let by = 0
    for (const h of hits) {
      if (h.side !== o.userData.side || h.age < 0) continue
      const swing = h.strength * Math.exp(-h.age * 3.2) * Math.sin(h.age * 24)
      bx += swing * h.dx
      by += swing * h.dy
    }
    // Welt x → Three x, Welt y → Three −z: Neigung nach +x ist eine Drehung um −z, nach +y eine um −x
    o.rotation.set(-by, 0, -bx)
  })
}

const NET_SEGMENTS = 64

/** Treffer im Netz: Ort (Welt y, z), Zeit seit dem Treffer, Stärke und Richtung (+1 = nach Seite B) */
export interface NetHit {
  y: number
  z: number
  age: number
  strength: number
  dir: number
}

/**
 * Netz ausbeulen: Jeder Treffer drückt das Netz in Flugrichtung ein; die Beule schwingt gedämpft aus.
 * Ohne Treffer hängt das Netz wieder gerade. Reine Funktion der Treffer – stimmt auch beim Zurückspulen.
 */
export function deformNet(net: THREE.Object3D | null, hits: NetHit[]): void {
  const flex = net?.userData.flex as THREE.Mesh[] | undefined
  if (!net || !flex) return
  const active = hits.filter((h) => h.age >= 0 && h.age < 1.6)
  if (active.length === 0 && !net.userData.bent) return
  net.userData.bent = active.length > 0
  const half = COURT.netWidth / 2
  for (const m of flex) {
    const base = m.userData.base as Float32Array
    const pos = m.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      // Lokales x der Fläche läuft entlang der Netzbreite (= Welt y), lokales y ist die Höhe
      const wy = base[i * 3]
      const wz = m.position.y + base[i * 3 + 1]
      let d = 0
      for (const h of active) {
        const r2 = (wy - h.y) ** 2 + ((wz - h.z) * 1.4) ** 2
        const swing = Math.exp(-h.age * 3.4) * Math.cos(h.age * 15)
        d += h.dir * h.strength * swing * Math.exp(-r2 / 0.9)
      }
      // An den Pfosten ist das Netz fest
      const edge = 1 - (wy / half) ** 2
      // Die Fläche ist um 90° gedreht: lokales z zeigt entlang Welt x
      pos.setZ(i, base[i * 3 + 2] + d * Math.max(0, edge))
    }
    pos.needsUpdate = true
  }
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
    // Texturen (z. B. Beschriftungen) mit freigeben
    const free = (x: THREE.Material) => {
      ;(x as THREE.MeshBasicMaterial).map?.dispose()
      x.dispose()
    }
    if (Array.isArray(mat)) mat.forEach(free)
    else if (mat) free(mat)
  })
}
