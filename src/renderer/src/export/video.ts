import { usePlayback, totalDuration } from '@renderer/store/playbackStore'
import { useUi } from '@renderer/store/settingsStore'
import { activeThreeCanvas } from '@renderer/views/three/ThreeView'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Format = { mime: string; ext: 'mp4' | 'webm' }

/** Verfügbare Formate in Wunsch-Reihenfolge: MP4 bevorzugt, sonst WebM (zur Laufzeit geprüft) */
export function videoFormats(): Format[] {
  const candidates: Format[] = [
    { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' }
  ]
  if (typeof MediaRecorder === 'undefined') return []
  return candidates.filter((f) => MediaRecorder.isTypeSupported(f.mime))
}

export function pickVideoFormat(): Format | null {
  return videoFormats()[0] ?? null
}

/** Breite des Videos höchstens 1920 px: große Bilder lassen den Encoder spät oder gar nicht anlaufen */
const MAX_VIDEO_W = 1920

/**
 * Einmal abspielen und aufnehmen. Aufgenommen wird eine verkleinerte Kopie der 3D-Zeichenfläche (jedes Bild),
 * die Animation startet erst, wenn der Encoder die ersten Daten liefert – so fehlt der Anfang nicht.
 * Liefert leere Daten, wenn der Encoder nichts geliefert hat.
 */
async function recordOnce(source: HTMLCanvasElement, fmt: Format, total: number, onProgress: (k: number) => void): Promise<Blob> {
  usePlayback.setState({ t: 0 })
  const k = Math.min(1, MAX_VIDEO_W / source.width)
  const copy = document.createElement('canvas')
  copy.width = Math.round((source.width * k) / 2) * 2
  copy.height = Math.round((source.height * k) / 2) * 2
  const ctx = copy.getContext('2d')!
  let raf = 0
  const draw = () => {
    ctx.drawImage(source, 0, 0, copy.width, copy.height)
    raf = requestAnimationFrame(draw)
  }
  draw()
  const stream = copy.captureStream(60)
  const rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 8_000_000 })
  const chunks: Blob[] = []
  let firstData: () => void = () => {}
  const started = new Promise<void>((r) => (firstData = r))
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data)
      firstData()
    }
  }
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()))
  rec.start(100)
  try {
    // Vorlauf: auf den Encoder warten (höchstens 5 s), dann noch kurz das Standbild zeigen
    await Promise.race([started, wait(5000)])
    if (chunks.length === 0) return new Blob([])
    await wait(300)
    usePlayback.getState().play()
    while (usePlayback.getState().playing) {
      onProgress(usePlayback.getState().t / total)
      await wait(50)
    }
    onProgress(1)
    await wait(700)
  } finally {
    if (rec.state !== 'inactive') rec.stop()
    await stopped
    stream.getTracks().forEach((t) => t.stop())
    cancelAnimationFrame(raf)
  }
  return new Blob(chunks, { type: fmt.mime })
}

/**
 * Nimmt die 3D-Animation in Echtzeit auf (einmal durch, 100 %): wechselt dazu in die 3D-Ansicht,
 * spielt ab und zeichnet die Zeichenfläche auf. Liefert ein Format nichts (z. B. kein H.264-Encoder),
 * wird automatisch das nächste versucht. Schleife, Tempo und Ansicht werden danach wiederhergestellt.
 */
export async function recordVideo(onProgress: (k: number) => void): Promise<{ data: Uint8Array; ext: 'mp4' | 'webm' }> {
  const formats = videoFormats()
  if (formats.length === 0) throw new Error('Dieses System kann kein Video aufnehmen.')
  const total = totalDuration()
  if (total <= 0) throw new Error('Keine Flugbahn zum Abspielen.')

  const ui = useUi.getState()
  const prevMode = ui.viewMode
  if (prevMode !== '3d') ui.setViewMode('3d')
  const pb = usePlayback.getState()
  const prev = { loop: pb.loop, speed: pb.speed, t: pb.t }
  try {
    for (let i = 0; i < 40 && !activeThreeCanvas; i++) await wait(50)
    const canvas = activeThreeCanvas
    if (!canvas) throw new Error('3D-Ansicht nicht verfügbar.')
    await wait(400)
    pb.pause()
    usePlayback.setState({ loop: false, speed: 1 })
    // Pro Container nur ein Versuch (MP4, dann WebM)
    const tried = new Set<string>()
    for (const fmt of formats) {
      if (tried.has(fmt.ext)) continue
      tried.add(fmt.ext)
      const blob = await recordOnce(canvas, fmt, total, onProgress)
      if (blob.size > 0) return { data: new Uint8Array(await blob.arrayBuffer()), ext: fmt.ext }
    }
    throw new Error('Es wurden keine Bilder aufgenommen. Bitte die 3D-Ansicht sichtbar lassen und erneut versuchen.')
  } finally {
    usePlayback.getState().pause()
    usePlayback.setState({ loop: prev.loop, speed: prev.speed, t: prev.t })
    if (prevMode !== '3d') useUi.getState().setViewMode(prevMode)
  }
}
