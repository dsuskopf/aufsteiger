import { create } from 'zustand'
import { advance, ballAt, buildTimeline, stepFrame, type Timeline } from '@renderer/core/timeline/timeline'
import { visibleTrajectories } from './selectors'
import { usePlay } from './playStore'
import { motionDuration } from '@renderer/core/motion/motion'
import type { TrajectoryType } from '@shared/types'

interface PlaybackState {
  /** Zeit auf der Gesamtachse (s) */
  t: number
  playing: boolean
  loop: boolean
  speed: number
  setT: (t: number) => void
  play: () => void
  pause: () => void
  toggle: () => void
  setLoop: (loop: boolean) => void
  setSpeed: (speed: number) => void
  step: (dir: 1 | -1) => void
}

/** Timeline der aktuell sichtbaren Flugbahnen (Annahme, dann Zuspiel) */
export function currentTimeline(): Timeline<TrajectoryType> {
  const { trajectories, display } = usePlay.getState()
  return buildTimeline(visibleTrajectories(trajectories, display).map((v) => ({ type: v.type, input: v.input })))
}

/** Gesamtdauer des Spielzugs: Ballflug und Bewegungen der Spieler (Laufwege, Sprünge) */
export function totalDuration(): number {
  const { sides } = usePlay.getState()
  return Math.max(currentTimeline().total, motionDuration([sides.A, sides.B]))
}

/** React-Hook: Gesamtdauer */
export function useTotalDuration(): number {
  usePlay((s) => s.trajectories)
  usePlay((s) => s.display)
  usePlay((s) => s.sides)
  return totalDuration()
}

/** Ballposition zur aktuellen Zeit (oder null ohne Flugbahn) */
export function currentBall() {
  return ballAt(currentTimeline(), usePlayback.getState().t)
}

let raf = 0
let last = 0

/** Globale Animationsuhr: treibt 3D und beide 2D-Ansichten. */
export const usePlayback = create<PlaybackState>((set, get) => {
  const tick = (now: number) => {
    const s = get()
    if (!s.playing) return
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    const r = advance(s.t, dt, s.speed, totalDuration(), s.loop)
    set({ t: r.t, playing: !r.ended })
    if (!r.ended) raf = requestAnimationFrame(tick)
  }
  return {
    t: 0,
    playing: false,
    loop: true,
    speed: 1,
    setT: (t) => set({ t: Math.min(totalDuration(), Math.max(0, t)) }),
    play: () => {
      const total = totalDuration()
      if (total <= 0) return
      // Am Ende angekommen: von vorn
      if (get().t >= total - 1e-6) set({ t: 0 })
      set({ playing: true })
      cancelAnimationFrame(raf)
      last = performance.now()
      raf = requestAnimationFrame(tick)
    },
    pause: () => {
      cancelAnimationFrame(raf)
      set({ playing: false })
    },
    toggle: () => (get().playing ? get().pause() : get().play()),
    setLoop: (loop) => set({ loop }),
    setSpeed: (speed) => set({ speed }),
    step: (dir) => {
      get().pause()
      set({ t: stepFrame(get().t, dir, totalDuration()) })
    }
  }
})

// Ändern sich die Flugbahnen, bleibt die Zeit im gültigen Bereich
usePlay.subscribe((s, prev) => {
  if (s.trajectories === prev.trajectories && s.display === prev.display && s.sides === prev.sides) return
  const total = totalDuration()
  if (usePlayback.getState().t > total) usePlayback.setState({ t: total })
})

/**
 * Flugbahnen ausgeblendet („Nur Ball“): solange die Animation läuft oder mitten im Flug angehalten ist.
 * Am Anfang und am Ende sind die Bahnen wieder da, damit man sie bearbeiten kann.
 */
export function usePathsHidden(): boolean {
  const ballOnly = usePlay((s) => s.display.ballOnly)
  usePlay((s) => s.trajectories)
  const playing = usePlayback((s) => s.playing)
  // Nur der Wahrheitswert hängt an t, damit nicht jedes Bild neu gezeichnet wird
  usePlay((s) => s.sides)
  const midFlight = usePlayback((s) => s.t > 1e-6 && s.t < totalDuration() - 1e-6)
  return ballOnly && (playing || midFlight)
}

/** React-Hook: Ballposition, aktualisiert mit der Uhr */
export function useBall() {
  usePlayback((s) => s.t)
  usePlay((s) => s.trajectories)
  usePlay((s) => s.display)
  return currentBall()
}
