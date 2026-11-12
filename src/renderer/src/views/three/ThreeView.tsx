import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { COLORS } from '@renderer/theme/colors'
import { useUi } from '@renderer/store/settingsStore'
import { buildCourt, buildNet, disposeObject } from './courtScene'
import { CAMERA_LIMITS, clampTarget } from './camera'
import { ViewControls } from '@renderer/components/ViewControls'
import { ZOOM_DURATION_MS, ZOOM_STEP, tween } from '@renderer/components/tween'

/**
 * 3D-Ansicht: Feld, Netz (später Spieler, Flugbahnen, Ball).
 * Kamera per OrbitControls, beschränkt auf die obere Halbkugel.
 */
export function ThreeView() {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    scene: THREE.Scene
    net: THREE.Group | null
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
  } | null>(null)
  const netHeight = useUi((s) => s.netHeight)

  useEffect(() => {
    const host = hostRef.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(COLORS.bgDeep)
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(COLORS.bgDeep, 35, 80)
    scene.add(new THREE.HemisphereLight('#b9b4c8', '#0b0b0d', 1.2))
    const sun = new THREE.DirectionalLight('#ffffff', 1.2)
    sun.position.set(6, 14, 8)
    scene.add(sun)
    scene.add(buildCourt())

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

    sceneRef.current = { scene, net: null, camera, controls }

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
      renderer.render(scene, camera)
    })

    return () => {
      renderer.setAnimationLoop(null)
      ro.disconnect()
      controls.dispose()
      disposeObject(scene)
      renderer.dispose()
      renderer.domElement.remove()
      sceneRef.current = null
    }
  }, [])

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
      />
    </>
  )
}

const DEFAULT_CAMERA = new THREE.Vector3(-16, 9, 14)
