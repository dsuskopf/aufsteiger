import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { COLORS } from '@renderer/theme/colors'
import { useUi } from '@renderer/store/settingsStore'
import { buildCourt, buildNet, disposeObject } from './courtScene'
import { CAMERA_LIMITS, clampTarget } from './camera'
import { ViewControls } from '@renderer/components/ViewControls'
import { NamesButton, ZonesButton } from '@renderer/components/ViewToggles'
import { ZOOM_DURATION_MS, ZOOM_STEP, tween } from '@renderer/components/tween'
import { useCourtPlayers } from '@renderer/store/selectors'
import { CylinderPlayerFactory, placePlayer, showNameTag, visualKey, type PlayerMeshFactory } from './players'
import { useVisibleTrajectories } from '@renderer/store/selectors'
import { usePlay } from '@renderer/store/playStore'
import { currentBall, currentTimeline, usePathsHidden, usePlayback } from '@renderer/store/playbackStore'
import { ballOrientation, buildBall, buildTrajectories, placeBall } from './trajectories'
import { buildZones, orientZoneLabels } from './zones'
import { playerAt, pathCurve } from '@renderer/core/motion/motion'
import { worldToThree } from '@renderer/core/geometry/transform'
import type { CourtPlayerView } from '@renderer/store/selectors'
import { useSettings } from '@renderer/store/appSettings'

/** Zeichenfläche der laufenden 3D-Ansicht (für den Video-Export) */
export let activeThreeCanvas: HTMLCanvasElement | null = null

interface PlayerItems {
  group: THREE.Group
  factory: PlayerMeshFactory
  items: Map<string, { obj: THREE.Object3D; vkey: string }>
}

/**
 * 3D-Ansicht: Feld, Netz, Spieler, Flugbahnen und Ball.
 * Kamera per OrbitControls, beschränkt auf die obere Halbkugel.
 */
export function ThreeView() {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    scene: THREE.Scene
    net: THREE.Group | null
    trajectories: THREE.Group | null
    zones: THREE.Group | null
    paths: THREE.Group | null
    ball: THREE.Group
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
  } | null>(null)
  const netHeight = useUi((s) => s.netHeight)
  const players = useCourtPlayers()
  const playersRef = useRef<PlayerItems | null>(null)
  const trajectories = useVisibleTrajectories()
  const showAfterHit = usePlay((s) => s.display.showAfterHit)
  const selected = usePlay((s) => s.selected)
  const hidePaths = usePathsHidden()
  const showZones = useUi((s) => s.showZones)
  const showNames = useUi((s) => s.showNames)
  const zoneStyle = useSettings((s) => s.settings.zoneStyle)

  useEffect(() => {
    const host = hostRef.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(COLORS.bgDeep)
    host.appendChild(renderer.domElement)
    activeThreeCanvas = renderer.domElement

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(COLORS.bgDeep, 35, 80)
    scene.add(new THREE.HemisphereLight('#c4c4ca', '#0c0c0e', 1.2))
    const sun = new THREE.DirectionalLight('#ffffff', 1.2)
    sun.position.set(6, 14, 8)
    scene.add(sun)
    scene.add(buildCourt())
    const playerGroup = new THREE.Group()
    playerGroup.name = 'players'
    scene.add(playerGroup)
    playersRef.current = { group: playerGroup, factory: new CylinderPlayerFactory(), items: new Map() }
    const ball = buildBall()
    scene.add(ball)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
    camera.position.copy(DEFAULT_CAMERA)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.minPolarAngle = CAMERA_LIMITS.minPolar
    controls.maxPolarAngle = CAMERA_LIMITS.maxPolar
    controls.minDistance = CAMERA_LIMITS.minDistance
    controls.maxDistance = CAMERA_LIMITS.maxDistance
    // Verschieben parallel zum Boden, damit das Ziel nie unter das Feld rutscht
    controls.screenSpacePanning = false
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
    controls.addEventListener('change', () => {
      const t = clampTarget(controls.target)
      if (t.x !== controls.target.x || t.y !== controls.target.y || t.z !== controls.target.z) {
        const delta = new THREE.Vector3(t.x, t.y, t.z).sub(controls.target)
        controls.target.add(delta)
        camera.position.add(delta)
      }
    })
    controls.update()

    sceneRef.current = { scene, net: null, trajectories: null, zones: null, paths: null, ball, camera, controls }
    // Nur für automatische Tests (?test): Kamera steuerbar
    const testHook = (window as unknown as { __vbp?: Record<string, unknown> }).__vbp
    if (testHook) testHook.three = { camera, controls }

    // Ball folgt der Uhr ohne React-Neuzeichnung (Position und Drall)
    const spin = new THREE.Quaternion()
    const updateBall = () =>
      placeBall(ball, currentBall(), ballOrientation(currentTimeline(), usePlayback.getState().t, spin))
    updateBall()
    const unsubA = usePlayback.subscribe(updateBall)
    const unsubB = usePlay.subscribe(updateBall)
    // Spieler laufen und springen mit der Uhr (ohne React-Neuzeichnung)
    const unsubC = usePlayback.subscribe(() => applyMotion(playersRef.current))

    const resize = () => {
      const w = Math.max(1, host.clientWidth)
      const h = Math.max(1, host.clientHeight)
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    renderer.setAnimationLoop(() => {
      controls.update()
      // Zonen-Beschriftung immer zur Kamera ausrichten (lesbar aus jedem Winkel)
      const zones = sceneRef.current?.zones
      if (zones) orientZoneLabels(zones, camera, controls.target)
      renderer.render(scene, camera)
    })

    return () => {
      unsubA()
      unsubB()
      unsubC()
      if (activeThreeCanvas === renderer.domElement) activeThreeCanvas = null
      const pr = playersRef.current
      if (pr) for (const { obj } of pr.items.values()) pr.factory.dispose(obj)
      playersRef.current = null
      renderer.setAnimationLoop(null)
      ro.disconnect()
      controls.dispose()
      disposeObject(scene)
      renderer.dispose()
      renderer.domElement.remove()
      sceneRef.current = null
    }
  }, [])

  // Spieler abgleichen: neue anlegen, geänderte neu erzeugen, sonst nur verschieben
  useEffect(() => {
    const pr = playersRef.current
    if (!pr) return
    const seen = new Set<string>()
    for (const p of players) {
      seen.add(p.key)
      const vkey = visualKey(p)
      let item = pr.items.get(p.key)
      if (item && item.vkey !== vkey) {
        pr.group.remove(item.obj)
        pr.factory.dispose(item.obj)
        item = undefined
      }
      if (!item) {
        item = { obj: pr.factory.create(p), vkey }
        pr.group.add(item.obj)
        pr.items.set(p.key, item)
      }
      placePlayer(item.obj, p.x, p.y)
      showNameTag(item.obj, showNames)
    }
    applyMotion(pr)
    for (const [key, item] of pr.items) {
      if (seen.has(key)) continue
      pr.group.remove(item.obj)
      pr.factory.dispose(item.obj)
      pr.items.delete(key)
    }
  }, [players, showNames])

  // Flugbahnen neu aufbauen, wenn sie sich ändern
  useEffect(() => {
    const ref = sceneRef.current
    if (!ref) return
    if (ref.trajectories) {
      ref.scene.remove(ref.trajectories)
      disposeObject(ref.trajectories)
    }
    ref.trajectories = buildTrajectories(trajectories, showAfterHit, selected)
    ref.trajectories.visible = !hidePaths
    ref.scene.add(ref.trajectories)
  }, [trajectories, showAfterHit, selected])

  // „Nur Ball“ beim Abspielen: Bahnen aus-/einblenden, ohne sie neu aufzubauen
  useEffect(() => {
    const ref = sceneRef.current
    if (ref?.trajectories) ref.trajectories.visible = !hidePaths
  }, [hidePaths])

  // Laufwege als gestrichelte Linien auf dem Boden („Nur Ball“ blendet sie beim Abspielen aus)
  useEffect(() => {
    const ref = sceneRef.current
    if (!ref) return
    if (ref.paths) {
      ref.scene.remove(ref.paths)
      disposeObject(ref.paths)
      ref.paths = null
    }
    if (hidePaths) return
    ref.paths = buildPaths(players)
    ref.scene.add(ref.paths)
  }, [players, hidePaths])

  // Zonen auf dem Boden ein-/ausblenden bzw. neu aufbauen, wenn sich die Art ändert
  useEffect(() => {
    const ref = sceneRef.current
    if (!ref) return
    if (ref.zones) {
      ref.scene.remove(ref.zones)
      disposeObject(ref.zones)
      ref.zones = null
    }
    if (!showZones) return
    ref.zones = buildZones(zoneStyle)
    orientZoneLabels(ref.zones, ref.camera, ref.controls.target)
    ref.scene.add(ref.zones)
  }, [showZones, zoneStyle])

  // Netz neu aufbauen, wenn sich die Netzhöhe ändert
  useEffect(() => {
    const ref = sceneRef.current
    if (!ref) return
    if (ref.net) {
      ref.scene.remove(ref.net)
      disposeObject(ref.net)
    }
    ref.net = buildNet(netHeight)
    ref.scene.add(ref.net)
  }, [netHeight])

  const animRef = useRef<{ cancel: (() => void) | null; goalDist: number | null }>({
    cancel: null,
    goalDist: null
  })
  const stopAnim = () => {
    animRef.current.cancel?.()
    animRef.current = { cancel: null, goalDist: null }
  }
  useEffect(() => {
    const ref = sceneRef.current
    if (!ref) return
    // Eigene Eingabe (Finger, Stift, Maus) bricht eine laufende Kamerafahrt ab
    ref.controls.addEventListener('start', stopAnim)
    return () => {
      ref.controls.removeEventListener('start', stopAnim)
      stopAnim()
    }
  }, [])

  /**
   * Kamerafahrt mit weicher Kurve: Ziel linear, Kamera auf einer Kugelbahn um das Ziel
   * (Abstand, Höhenwinkel und Drehwinkel werden gleichmäßig überblendet).
   */
  const flyTo = (toTarget: THREE.Vector3, toOffset: THREE.Spherical, goalDist: number | null) => {
    const ref = sceneRef.current
    if (!ref) return
    animRef.current.cancel?.()
    const fromTarget = ref.controls.target.clone()
    const from = new THREE.Spherical().setFromVector3(ref.camera.position.clone().sub(fromTarget))
    let dTheta = toOffset.theta - from.theta
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta)) // kürzester Drehweg
    const cancel = tween(
      ZOOM_DURATION_MS,
      (k) => {
        const sph = new THREE.Spherical(
          from.radius + (toOffset.radius - from.radius) * k,
          from.phi + (toOffset.phi - from.phi) * k,
          from.theta + dTheta * k
        )
        ref.controls.target.lerpVectors(fromTarget, toTarget, k)
        ref.camera.position.setFromSpherical(sph).add(ref.controls.target)
      },
      () => (animRef.current = { cancel: null, goalDist: null })
    )
    animRef.current = { cancel, goalDist }
  }

  /** Zoom per Button (wichtig für den Stift: OrbitControls zoomt sonst nur per Rad oder zwei Fingern). */
  const zoom = (factor: number) => {
    const ref = sceneRef.current
    if (!ref) return
    const current = new THREE.Spherical().setFromVector3(ref.camera.position.clone().sub(ref.controls.target))
    // Mehrfaches Tippen baut auf dem laufenden Ziel auf
    const startDist = animRef.current.goalDist ?? current.radius
    const dist = Math.min(CAMERA_LIMITS.maxDistance, Math.max(CAMERA_LIMITS.minDistance, startDist * factor))
    flyTo(ref.controls.target.clone(), new THREE.Spherical(dist, current.phi, current.theta), dist)
  }

  const resetView = () => {
    flyTo(new THREE.Vector3(0, 0, 0), new THREE.Spherical().setFromVector3(DEFAULT_CAMERA), null)
  }

  return (
    <>
      <div className="canvas-host" ref={hostRef} />
      <ViewControls
        onZoomIn={() => zoom(1 / ZOOM_STEP)}
        onZoomOut={() => zoom(ZOOM_STEP)}
        onReset={resetView}
      >
        <ZonesButton />
        <NamesButton />
      </ViewControls>
    </>
  )
}

const DEFAULT_CAMERA = new THREE.Vector3(-16, 9, 14)

/** Spieler zur aktuellen Zeit platzieren: entlang des Laufwegs, im Sprung angehoben */
function applyMotion(pr: PlayerItems | null): void {
  if (!pr) return
  const t = usePlayback.getState().t
  const { sides } = usePlay.getState()
  for (const side of ['A', 'B'] as const)
    for (const c of sides[side].players) {
      const item = pr.items.get(`${side}:${c.playerId}`)
      if (!item) continue
      const at = playerAt(c, t)
      placePlayer(item.obj, at.x, at.y)
      item.obj.position.y = at.z
    }
}

/** Laufwege als gestrichelte Linien knapp über dem Boden, in der Trikotfarbe */
function buildPaths(players: CourtPlayerView[]): THREE.Group {
  const g = new THREE.Group()
  g.name = 'paths'
  for (const p of players) {
    const path = p.court.path
    if (!path || path.points.length === 0) continue
    const { poly } = pathCurve(p.court, path)
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(poly.map((q) => new THREE.Vector3(...worldToThree(q.x, q.y, 0.012)))),
      new THREE.LineDashedMaterial({ color: p.jersey.fill, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.95 })
    )
    line.computeLineDistances()
    g.add(line)
    const end = poly[poly.length - 1]
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.3, 32),
      new THREE.MeshBasicMaterial({ color: p.jersey.fill, transparent: true, opacity: 0.8, depthWrite: false })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.set(...worldToThree(end.x, end.y, 0.013))
    g.add(ring)
  }
  return g
}
