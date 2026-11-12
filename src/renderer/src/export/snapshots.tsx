import { createRoot } from 'react-dom/client'
import { Layer, Stage } from 'react-konva'
import type Konva from 'konva'
import * as THREE from 'three'
import { fitViewport, isNearSide, netDepth, netHalfExtent, type NetViewport } from '@renderer/core/geometry/transform'
import { COURT } from '@renderer/core/geometry/court'
import { COLORS } from '@renderer/theme/colors'
import { CourtLayer, WORLD_H, WORLD_W } from '@renderer/views/top/TopView'
import { PathLayer } from '@renderer/views/top/PathLayer'
import { PlayersLayer } from '@renderer/views/top/PlayersLayer'
import { TrajectoryLayer } from '@renderer/views/top/TrajectoryLayer'
import { Floor, HALF_W, Net, PlayerFigure } from '@renderer/views/net/NetView'
import { NetTrajectories } from '@renderer/views/net/NetTrajectories'
import { buildCourt, buildNet, disposeObject } from '@renderer/views/three/courtScene'
import { buildZones, orientZoneLabels } from '@renderer/views/three/zones'
import { useSettings } from '@renderer/store/appSettings'
import { CylinderPlayerFactory, placePlayer, showNameTag } from '@renderer/views/three/players'
import { buildTrajectories } from '@renderer/views/three/trajectories'
import { courtPlayers, visibleTrajectories } from '@renderer/store/selectors'
import { usePlay } from '@renderer/store/playStore'
import { useTeams } from '@renderer/store/teamsStore'
import { useUi } from '@renderer/store/settingsStore'

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)))

/** Rendert einen Konva-Baum unsichtbar und liefert ein PNG (Data-URL). */
async function renderKonva(layers: (ref: (s: Konva.Stage | null) => void) => React.ReactNode): Promise<string> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none;'
  document.body.appendChild(host)
  const root = createRoot(host)
  let stage: Konva.Stage | null = null
  root.render(<>{layers((s) => (stage = s))}</>)
  try {
    for (let i = 0; i < 4 && !stage; i++) await frame()
    await frame()
    if (!stage) throw new Error('Ansicht konnte nicht gerendert werden')
    return (stage as Konva.Stage).toDataURL({ pixelRatio: 2 })
  } finally {
    root.unmount()
    host.remove()
  }
}

/** Draufsicht (Seite A links, Netz in der Mitte) ohne Griffe und Ball */
export function snapshotTop(width = 1100, height = 600): Promise<string> {
  const vp = fitViewport(width, height, WORLD_W, WORLD_H, 12, 0)
  return renderKonva((ref) => (
    <Stage ref={ref} width={width} height={height}>
      <CourtLayer vp={vp} />
      <PathLayer vp={vp} interactive={false} />
      <PlayersLayer vp={vp} interactive={false} />
      <TrajectoryLayer vp={vp} interactive={false} preview={null} showBall={false} />
    </Stage>
  ))
}

/** Netzansicht (Blickseite wie eingestellt) mit Spielern, falls eingeblendet */
export function snapshotNet(width = 1100, height = 520): Promise<string> {
  const ui = useUi.getState()
  const players = courtPlayers(usePlay.getState().sides, useTeams.getState().teams)
  const list = visibleTrajectories(usePlay.getState().trajectories, usePlay.getState().display)
  // Höhe so wählen, dass Netz und höchster Scheitel sichtbar sind
  const top = Math.max(4, ...list.map((t) => t.sol.apexH + 0.6))
  const padB = 20
  const angle = (ui.netAngle * Math.PI) / 180
  const halfW = netHalfExtent({ from: ui.netViewFrom, angle }, COURT.halfLength + COURT.freeZone, HALF_W)
  const scale = Math.min((width - 32) / (2 * halfW), (height - padB - 16) / top)
  const vp: NetViewport = { scale, originX: width / 2, groundY: height - padB, from: ui.netViewFrom, angle }
  const sorted = [...players].sort((a, b) => netDepth(vp, b.x, b.y) - netDepth(vp, a.x, a.y))
  return renderKonva((ref) => (
    <Stage ref={ref} width={width} height={height}>
      <Layer listening={false}>
        <Floor vp={vp} />
        {ui.netShowPlayers && sorted.filter((p) => !isNearSide(vp, p.x)).map((p) => <PlayerFigure key={p.key} vp={vp} p={p} dim />)}
        <Net vp={vp} netHeight={ui.netHeight} />
        {ui.netShowPlayers && sorted.filter((p) => isNearSide(vp, p.x)).map((p) => <PlayerFigure key={p.key} vp={vp} p={p} />)}
      </Layer>
      <Layer listening={false}>
        <NetTrajectories vp={vp} interactive={false} showBall={false} />
      </Layer>
    </Stage>
  ))
}

/** Feste Kamerapositionen für den PDF-Export (Welt: x Länge, y Breite, z Höhe) */
export const CAMERA_PRESETS: { label: string; pos: [number, number, number]; target: [number, number, number] }[] = [
  { label: 'Seitlich', pos: [0, -17, 6], target: [0, 0, 1.5] },
  { label: 'Hinter Seite A', pos: [-17, 0, 5], target: [0, 0, 1.8] },
  { label: '45°', pos: [-13, -11, 10], target: [0, 0, 0.5] },
  { label: 'Von oben', pos: [0, -0.01, 26], target: [0, 0, 0] }
]

/** 3D-Ansichten aus mehreren Winkeln (offscreen gerendert) */
export function snapshotsThree(width = 900, height = 560): { label: string; url: string }[] {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(2)
  renderer.setSize(width, height, false)
  renderer.setClearColor(COLORS.bgDeep)
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#c4c4ca', '#0c0c0e', 1.2))
  const sun = new THREE.DirectionalLight('#ffffff', 1.2)
  sun.position.set(6, 14, 8)
  scene.add(sun)
  scene.add(buildCourt())
  scene.add(buildNet(useUi.getState().netHeight))
  // Eingeblendete Zonen kommen mit ins Bild
  const zones = useUi.getState().showZones ? buildZones(useSettings.getState().settings.zoneStyle) : null
  if (zones) scene.add(zones)
  const factory = new CylinderPlayerFactory()
  const created: THREE.Object3D[] = []
  for (const p of courtPlayers(usePlay.getState().sides, useTeams.getState().teams)) {
    const obj = factory.create(p)
    showNameTag(obj, useUi.getState().showNames)
    placePlayer(obj, p.x, p.y)
    scene.add(obj)
    created.push(obj)
  }
  const { trajectories, display } = usePlay.getState()
  scene.add(buildTrajectories(visibleTrajectories(trajectories, display), display.showAfterHit, null))

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200)
  const out: { label: string; url: string }[] = []
  for (const preset of CAMERA_PRESETS) {
    const [x, y, z] = preset.pos
    const [tx, ty, tz] = preset.target
    camera.position.set(x, z, -y)
    camera.lookAt(tx, tz, -ty)
    if (zones) orientZoneLabels(zones, camera, new THREE.Vector3(tx, tz, -ty))
    renderer.render(scene, camera)
    out.push({ label: preset.label, url: renderer.domElement.toDataURL('image/png') })
  }
  for (const o of created) factory.dispose(o)
  disposeObject(scene)
  renderer.dispose()
  return out
}

