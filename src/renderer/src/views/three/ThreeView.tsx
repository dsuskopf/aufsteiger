import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { COLORS } from '@renderer/theme/colors'
import { useUi } from '@renderer/store/settingsStore'
import { bendAntennas, buildCourt, buildNet, deformNet, disposeObject } from './courtScene'
import { CAMERA_LIMITS, clampTarget } from './camera'
import { ViewControls } from '@renderer/components/ViewControls'
import { NamesButton, ZonesButton } from '@renderer/components/ViewToggles'
import { Icon } from '@renderer/components/Icon'
import { applyDrag, buildPickables, dragAnchor, draggable, faceCamera, groundPoint, pickAt, selectPick, type Pick } from './picking'
import { rewind } from '@renderer/store/actions'
import { ZOOM_DURATION_MS, ZOOM_STEP, tween } from '@renderer/components/tween'
import { useCourtPlayers, useLaeuferMarkers, useVisibleTrajectories, type CourtPlayerView } from '@renderer/store/selectors'
import { HumanoidPlayerFactory, setLaeuferMark, showNameTag, visualKey } from './players'
import { usePlay } from '@renderer/store/playStore'
import { currentBall, currentScene, usePathsHidden, usePlayback, useScene } from '@renderer/store/playbackStore'
import { ballOrientation, buildBall, buildTrajectories, placeBall, updateTrajectoryProgress } from './trajectories'
import { buildZones, orientZoneLabels } from './zones'
import { pathCurve } from '@renderer/core/motion/motion'
import { skeletonAt } from '@renderer/core/motion/pose'
import { worldToThree } from '@renderer/core/geometry/transform'
import { useSettings } from '@renderer/store/appSettings'
import { antennaHits, buildEffects, cameraShake, netHits, updateEffects } from './effects'
import { KEY_HELP, createKeyCamera, typingTarget } from './keyCamera'

/** Zeichenfläche der laufenden 3D-Ansicht (für den Video-Export) */
export let activeThreeCanvas: HTMLCanvasElement | null = null

interface PlayerItems {
  group: THREE.Group
  factory: HumanoidPlayerFactory
  items: Map<string, { obj: THREE.Object3D; vkey: string }>
}

/** Feste Blickwinkel zum Durchschalten: Ziel und Kamera-Versatz (Three-Koordinaten) */
const ANGLES: { label: string; target: [number, number, number]; offset: [number, number, number] }[] = [
  { label: 'Schräg', target: [0, 0, 0], offset: [-16, 9, 14] },
  { label: 'Seite', target: [0, 1.2, 0], offset: [0, 4.5, 17] },
  { label: 'Hinter Seite A', target: [1, 1.4, 0], offset: [-17, 5.5, 0] },
  { label: 'Hinter Seite B', target: [-1, 1.4, 0], offset: [17, 5.5, 0] },
  { label: 'Am Netz', target: [0, 2, 0], offset: [0, 1.2, 9.5] },
  { label: 'Von oben', target: [0, 0, 0], offset: [0, 24, 0.5] }
]

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
    picks: THREE.Group | null
    ball: THREE.Group
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
  } | null>(null)
  const netHeight = useUi((s) => s.netHeight)
  const players = useCourtPlayers()
  const playersRef = useRef<PlayerItems | null>(null)
  const trajectories = useVisibleTrajectories()
  const schlag = usePlay((s) => s.schlag)
  const rally = useScene()
  const pathOpacity = useSettings((s) => s.settings.trajectoryOpacity3d)
  const selected = usePlay((s) => s.selected)
  const hidePaths = usePathsHidden()
  const showZones = useUi((s) => s.showZones)
  const showNames = useUi((s) => s.showNames)
  const followBall = useUi((s) => s.followBall)
  const lock3d = useUi((s) => s.lock3d)
  const setFollowBall = useUi((s) => s.setFollowBall)
  const markers = useLaeuferMarkers()
  const contacts = usePlay((s) => s.contacts)
  const zoneStyle = useSettings((s) => s.settings.zoneStyle)

  useEffect(() => {
    const host = hostRef.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(COLORS.bgDeep)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    host.appendChild(renderer.domElement)
    activeThreeCanvas = renderer.domElement

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(COLORS.bgDeep, 35, 80)
    scene.add(new THREE.HemisphereLight('#c4c4ca', '#0c0c0e', 1.15))
    // Hallenlicht von schräg oben: wirft weiche Schatten der Spieler auf den Boden
    const sun = new THREE.DirectionalLight('#ffffff', 1.35)
    sun.position.set(5, 18, 7)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -14
    sun.shadow.camera.right = 14
    sun.shadow.camera.top = 10
    sun.shadow.camera.bottom = -10
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 45
    sun.shadow.bias = -0.0006
    sun.shadow.radius = 5
    scene.add(sun)
    scene.add(buildCourt())
    const playerGroup = new THREE.Group()
    playerGroup.name = 'players'
    scene.add(playerGroup)
    const factory = new HumanoidPlayerFactory()
    playersRef.current = { group: playerGroup, factory, items: new Map() }
    const ball = buildBall()
    scene.add(ball)
    const effects = buildEffects()
    scene.add(effects)

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

    sceneRef.current = { scene, net: null, trajectories: null, zones: null, paths: null, picks: null, ball, camera, controls }

    // Gewählter Spieler: heller Ring am Boden unter ihm
    const selRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 48),
      new THREE.MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.9, depthWrite: false })
    )
    selRing.rotation.x = -Math.PI / 2
    selRing.visible = false
    scene.add(selRing)

    /*
     * Anklicken und Ziehen: Tippen wählt (Spieler, Ballweg), Ziehen verschiebt (Spieler, Griffe an Start und Ziel,
     * Laufweg-Ende). Beginnt ein Druck auf etwas Ziehbarem, dreht die Kamera nicht mit.
     * Tippen ins Leere hebt die Auswahl auf; Ziehen ins Leere dreht wie gewohnt die Kamera.
     */
    const raycaster = new THREE.Raycaster()
    raycaster.camera = camera
    const ndc = new THREE.Vector2()
    const aim = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
    }
    const layers = () => [sceneRef.current?.picks ?? null, sceneRef.current?.paths ?? null, playersRef.current?.group ?? null]
    let press: { id: number; x: number; y: number; time: number; pick: Pick | null; dragging: boolean; offset: { dx: number; dy: number }; h: number } | null = null
    const onDown = (e: PointerEvent) => {
      // Gesperrt: die Maus gehört ganz der Kamera
      if (e.button !== 0 || press || useUi.getState().lock3d) return
      aim(e)
      const hit = pickAt(raycaster, layers())
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, time: performance.now(), pick: hit?.pick ?? null, dragging: false, offset: { dx: 0, dy: 0 }, h: 0 }
      if (hit && draggable(hit.pick)) {
        const anchor = dragAnchor(hit.pick)
        const g = anchor && groundPoint(raycaster, anchor.h)
        if (anchor && g) {
          press.offset = { dx: anchor.x - g.x, dy: anchor.y - g.y }
          press.h = anchor.h
          // Die Kamera bleibt stehen, solange man etwas zieht
          controls.enabled = false
        }
      }
    }
    const onMove = (e: PointerEvent) => {
      aim(e)
      if (!press || e.pointerId !== press.id) {
        // Zeiger zeigt, was man anfassen kann (gesperrt: nichts)
        const hit = e.buttons === 0 && !useUi.getState().lock3d ? pickAt(raycaster, layers()) : null
        renderer.domElement.style.cursor = hit ? (draggable(hit.pick) ? 'grab' : 'pointer') : ''
        return
      }
      const p = press
      if (!p.pick || controls.enabled) return
      if (!p.dragging) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < (e.pointerType === 'touch' ? 10 : 5)) return
        p.dragging = true
        // Verschieben gilt für die Grundstellung: an den Anfang
        rewind()
        selectPick(p.pick)
        renderer.domElement.style.cursor = 'grabbing'
      }
      const g = groundPoint(raycaster, p.h)
      if (g) applyDrag(p.pick, g.x + p.offset.dx, g.y + p.offset.dy)
    }
    const onUp = (e: PointerEvent) => {
      const p = press
      if (!p || e.pointerId !== p.id) return
      press = null
      controls.enabled = true
      const tap = !p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6 && performance.now() - p.time < 600
      if (tap && useUi.getState().tool === 'select') selectPick(p.pick)
      renderer.domElement.style.cursor = p.dragging ? 'grab' : renderer.domElement.style.cursor
    }
    const onCancel = (e: PointerEvent) => {
      if (press && e.pointerId === press.id) press = null
      controls.enabled = true
    }
    // Vor den OrbitControls (Capture), damit sie bei einem Griff gar nicht erst anfangen zu drehen
    renderer.domElement.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    // Nur für automatische Tests (?test): Kamera steuerbar
    const testHook = (window as unknown as { __vbp?: Record<string, unknown> }).__vbp
    if (testHook) testHook.three = { camera, controls }

    // Ball, Spieler und Effekte folgen der Uhr ohne React-Neuzeichnung
    const spin = new THREE.Quaternion()
    const update = () => {
      const sc = currentScene()
      const t = usePlayback.getState().t
      const b = currentBall()
      placeBall(ball, b, ballOrientation(sc.timeline, t, spin))
      // Schon geflogener Teil der Bahnen blass, Lücke um den Ball
      updateTrajectoryProgress(sceneRef.current?.trajectories ?? null, sc.timeline, t, sc.total)
      updateEffects(effects, sc.events, sc.timeline, t, sc.total)
      deformNet(sceneRef.current?.net ?? null, netHits(sc.events, t, sc.total))
      bendAntennas(sceneRef.current?.net ?? null, antennaHits(sc.events, t, sc.total))
      const pr = playersRef.current
      if (pr)
        for (const [key, item] of pr.items) {
          const plan = sc.plans.get(key)
          if (plan) pr.factory.pose(item.obj, skeletonAt(plan, t, b))
        }
      // Ring unter dem gewählten Spieler
      const sp = usePlay.getState().selectedPlayer
      const obj = sp ? pr?.items.get(`${sp.side}:${sp.playerId}`)?.obj : undefined
      selRing.visible = !!obj
      if (obj) selRing.position.set(obj.position.x, 0.016, obj.position.z)
    }
    update()
    const unsubA = usePlayback.subscribe(update)
    const unsubB = usePlay.subscribe(update)

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

    const shake = new THREE.Vector3()
    const follow = new THREE.Vector3()
    // Tastatur-Kamera (WASD …), nicht während ein Dialog offen ist
    const keys = createKeyCamera(camera, controls, {
      blocked: () => {
        const ui = useUi.getState()
        return !!ui.dialog || ui.teamsOpen || ui.settingsOpen
      },
      onStart: () => {
        animRef.current.cancel?.()
        animRef.current = { cancel: null, goalDist: null }
      },
      onPan: () => {
        if (useUi.getState().followBall) useUi.getState().setFollowBall(false)
      }
    })
    let lastFrame = performance.now()
    renderer.setAnimationLoop(() => {
      const now = performance.now()
      keys.update(Math.min(0.05, (now - lastFrame) / 1000))
      lastFrame = now
      // Ballkamera: das Ziel der Kamera gleitet dem Ball nach (Blickwinkel und Abstand bleiben)
      if (useUi.getState().followBall) {
        const b = currentBall()
        if (b) {
          follow.set(...worldToThree(b.x, b.y, Math.min(3, b.z * 0.6)))
          const c = clampTarget(follow)
          follow.set(c.x, c.y, c.z).sub(controls.target).multiplyScalar(0.07)
          controls.target.add(follow)
          camera.position.add(follow)
        }
      }
      controls.update()
      // Zonen-Beschriftung immer zur Kamera ausrichten (lesbar aus jedem Winkel)
      const zones = sceneRef.current?.zones
      if (zones) orientZoneLabels(zones, camera, controls.target)
      faceCamera(sceneRef.current?.picks ?? null, camera)
      // Kamera-Wackeln bei harten Ballkontakten – nur beim Abspielen, nur fürs Bild (die Kamera selbst bleibt, wo sie ist)
      const pb = usePlayback.getState()
      const shaking = pb.playing && useSettings.getState().settings.cameraShake
      if (shaking) {
        cameraShake(currentScene().events, pb.t, shake).multiplyScalar(camera.position.distanceTo(controls.target))
        camera.position.add(shake)
      }
      renderer.render(scene, camera)
      if (shaking) camera.position.sub(shake)
    })

    return () => {
      renderer.domElement.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      keys.dispose()
      unsubA()
      unsubB()
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

  // Spieler abgleichen: neue anlegen, geänderte neu erzeugen; die Haltung folgt der Uhr
  useEffect(() => {
    const pr = playersRef.current
    if (!pr) return
    const sc = currentScene()
    const t = usePlayback.getState().t
    const b = currentBall()
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
      item.obj.userData.pick = { kind: 'player', side: p.side, playerId: p.playerId } satisfies Pick
      const plan = sc.plans.get(p.key)
      if (plan) pr.factory.pose(item.obj, skeletonAt(plan, t, b))
      showNameTag(item.obj, showNames)
      setLaeuferMark(item.obj, markers.get(p.key), COLORS.accent, COLORS.bgDeep)
    }
    for (const [key, item] of pr.items) {
      if (seen.has(key)) continue
      pr.group.remove(item.obj)
      pr.factory.dispose(item.obj)
      pr.items.delete(key)
    }
  }, [players, showNames, markers, rally])

  // Flugbahnen neu aufbauen, wenn sie sich ändern
  useEffect(() => {
    const ref = sceneRef.current
    if (!ref) return
    if (ref.trajectories) {
      ref.scene.remove(ref.trajectories)
      disposeObject(ref.trajectories)
    }
    ref.trajectories = buildTrajectories(trajectories, selected, schlag, pathOpacity / 100, rally)
    updateTrajectoryProgress(ref.trajectories, rally.timeline, usePlayback.getState().t, rally.total)
    ref.trajectories.visible = !hidePaths
    ref.scene.add(ref.trajectories)
    // Trefferflächen und Griffe zum Anklicken und Ziehen
    if (ref.picks) {
      ref.scene.remove(ref.picks)
      disposeObject(ref.picks)
    }
    const flights = [
      ...trajectories.map((tv) => ({ type: tv.type, start: tv.input.start, end: tv.input.end, endH: tv.input.hitH })),
      ...(schlag ? [{ type: 'schlag' as const, start: schlag.start, end: schlag.end, endH: 0.06 }] : [])
    ]
    ref.picks = buildPickables(rally.timeline, flights, selected)
    ref.picks.visible = !hidePaths
    ref.scene.add(ref.picks)
  }, [trajectories, selected, schlag, pathOpacity, rally, contacts])

  // „Nur Ball“ beim Abspielen: Bahnen aus-/einblenden, ohne sie neu aufzubauen
  useEffect(() => {
    const ref = sceneRef.current
    if (ref?.trajectories) ref.trajectories.visible = !hidePaths
    if (ref?.picks) ref.picks.visible = !hidePaths
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

  const angleRef = useRef(0)
  const goAngle = (i: number) => {
    angleRef.current = i
    const a = ANGLES[i]
    setFollowBall(false)
    flyTo(new THREE.Vector3(...a.target), new THREE.Spherical().setFromVector3(new THREE.Vector3(...a.offset)), null)
  }
  // Tastatur: 1–6 feste Blickwinkel, B Ballkamera (WASD usw. in keyCamera.ts)
  const goAngleRef = useRef(goAngle)
  goAngleRef.current = goAngle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || typingTarget(e)) return
      const ui = useUi.getState()
      if (ui.dialog || ui.teamsOpen || ui.settingsOpen) return
      const n = /^Digit([1-6])$/.exec(e.code)
      if (n) {
        e.preventDefault()
        goAngleRef.current(Number(n[1]) - 1)
      } else if (e.code === 'KeyB') {
        e.preventDefault()
        ui.setFollowBall(!ui.followBall)
      } else if (e.code === 'KeyL') {
        e.preventDefault()
        ui.setLock3d(!ui.lock3d)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const keyHelp = KEY_HELP.map((k) => `${k.keys}: ${k.label}`).join('\n')

  return (
    <>
      <div className="canvas-host" ref={hostRef} />
      <ViewControls onZoomIn={() => zoom(1 / ZOOM_STEP)} onZoomOut={() => zoom(ZOOM_STEP)} onReset={() => goAngle(0)}>
        <button
          title={`Blickwinkel wechseln (nächster: ${ANGLES[(angleRef.current + 1) % ANGLES.length].label})\n\nTastatur:\n${keyHelp}`}
          aria-label="Blickwinkel wechseln"
          onClick={() => goAngle((angleRef.current + 1) % ANGLES.length)}
        >
          <Icon name="camera" />
        </button>
        <button
          className={followBall ? 'selected' : ''}
          aria-pressed={followBall}
          title={followBall ? 'Ballkamera aus (B)' : 'Ballkamera: die Kamera folgt dem Ball (B)'}
          aria-label="Ballkamera"
          onClick={() => setFollowBall(!followBall)}
        >
          <Icon name="follow" />
        </button>
        <button
          className={lock3d ? 'selected' : ''}
          aria-pressed={lock3d}
          title={lock3d ? 'Entsperren: Spieler und Bahnen wieder anklicken und verschieben (L)' : 'Sperren: nichts anklicken, die Maus bedient nur die Kamera (L)'}
          aria-label={lock3d ? 'Entsperren' : 'Sperren'}
          onClick={() => useUi.getState().setLock3d(!lock3d)}
        >
          <Icon name={lock3d ? 'lock' : 'unlock'} />
        </button>
        <NamesButton />
        <ZonesButton />
      </ViewControls>
      {lock3d && (
        <div className="lock-badge" role="status">
          <Icon name="lock" size={14} />
          Gesperrt – nur Kamera
        </div>
      )}
    </>
  )
}

const DEFAULT_CAMERA = new THREE.Vector3(-16, 9, 14)

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
    // Ende des Laufwegs: zum Verschieben anfassen (große, unsichtbare Trefferfläche)
    const grab = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), new THREE.MeshBasicMaterial({ visible: false }))
    grab.rotation.x = -Math.PI / 2
    grab.position.set(...worldToThree(end.x, end.y, 0.02))
    grab.userData.pick = { kind: 'pathEnd', side: p.side, playerId: p.playerId, x: end.x, y: end.y } satisfies Pick
    g.add(grab)
  }
  return g
}
