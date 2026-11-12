import { usePlayback, currentTimeline } from '@renderer/store/playbackStore'
import { useUi } from '@renderer/store/settingsStore'
import { activeThreeCanvas } from '@renderer/views/three/ThreeView'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Bestes verfügbares Format: MP4 bevorzugt, sonst WebM (zur Laufzeit geprüft) */
export function pickVideoFormat(): { mime: string; ext: 'mp4' | 'webm' } | null {
  const candidates: [string, 'mp4' | 'webm'][] = [
    ['video/mp4;codecs=avc1', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm;codecs=vp8', 'webm'],
    ['video/webm', 'webm']
  ]
  for (const [mime, ext] of candidates) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) return { mime, ext }
  return null
}

/**
 * Nimmt die 3D-Animation in Echtzeit auf (einmal durch, 100 %): wechselt dazu in die 3D-Ansicht,
 * spielt ab und zeichnet die Zeichenfläche auf. Schleife und Tempo werden danach wiederhergestellt.
 */
export async function recordVideo(onProgress: (k: number) => void): Promise<{ data: Uint8Array; ext: 'mp4' | 'webm' }> {
  const fmt = pickVideoFormat()
  if (!fmt) throw new Error('Dieses System kann kein Video aufnehmen.')
  const total = currentTimeline().total
  if (total <= 0) throw new Error('Keine Flugbahn zum Abspielen.')

  const ui = useUi.getState()
  const prevMode = ui.viewMode
  if (prevMode !== '3d') ui.setViewMode('3d')
  for (let i = 0; i < 40 && !activeThreeCanvas; i++) await wait(50)
  const canvas = activeThreeCanvas
  if (!canvas) throw new Error('3D-Ansicht nicht verfügbar.')
  await wait(400)

  const pb = usePlayback.getState()
  const prev = { loop: pb.loop, speed: pb.speed, t: pb.t }
  pb.pause()
  usePlayback.setState({ t: 0, loop: false, speed: 1 })

  const stream = canvas.captureStream(60)
  const rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 8_000_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()))
  rec.start(250)
  try {
    await wait(500)
    usePlayback.getState().play()
    while (usePlayback.getState().playing) {
      onProgress(usePlayback.getState().t / total)
      await wait(50)
    }
    onProgress(1)
    await wait(700)
  } finally {
    rec.stop()
    stream.getTracks().forEach((t) => t.stop())
    await stopped
    usePlayback.setState({ loop: prev.loop, speed: prev.speed, t: prev.t })
    if (prevMode !== '3d') useUi.getState().setViewMode(prevMode)
  }
  const blob = new Blob(chunks, { type: fmt.mime })
  return { data: new Uint8Array(await blob.arrayBuffer()), ext: fmt.ext }
}
