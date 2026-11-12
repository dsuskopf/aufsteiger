import { positionAt, solveTrajectory, type SolvedTrajectory, type TrajectoryInput } from '../physics/trajectory'

/** Physik-Zeitschritt für Frame-für-Frame (unabhängig vom Tempo) */
export const FRAME_DT = 1 / 60
export const SPEEDS = [0.25, 0.5, 1, 2, 4] as const

export interface Segment<T extends string = string> {
  type: T
  input: TrajectoryInput
  sol: SolvedTrajectory
  /** Beginn und Ende auf der Gesamt-Zeitachse (s) */
  t0: number
  t1: number
}

export interface Timeline<T extends string = string> {
  segments: Segment<T>[]
  total: number
}

/** Hängt die sichtbaren Flugbahnen nacheinander (Annahme, dann Zuspiel); jede dauert bis zu ihrem Schlagpunkt. */
export function buildTimeline<T extends string>(list: { type: T; input: TrajectoryInput }[]): Timeline<T> {
  let t = 0
  const segments = list.map(({ type, input }) => {
    const sol = solveTrajectory(input)
    const seg = { type, input, sol, t0: t, t1: t + sol.tHit }
    t = seg.t1
    return seg
  })
  return { segments, total: t }
}

/** Ballposition zur Zeit t (geklemmt auf 0..total); null ohne Flugbahn */
export function ballAt<T extends string>(
  tl: Timeline<T>,
  t: number
): { x: number; y: number; z: number; type: T } | null {
  if (tl.segments.length === 0) return null
  const tc = Math.min(tl.total, Math.max(0, t))
  const seg = tl.segments.find((s) => tc <= s.t1) ?? tl.segments[tl.segments.length - 1]
  return { ...positionAt(seg.sol, seg.input.start, Math.min(seg.sol.tHit, tc - seg.t0)), type: seg.type }
}

/** Nächster Zeitpunkt beim Abspielen; Schleife springt an den Anfang, sonst bleibt er am Ende stehen. */
export function advance(t: number, dtReal: number, speed: number, total: number, loop: boolean): { t: number; ended: boolean } {
  if (total <= 0) return { t: 0, ended: true }
  const next = t + dtReal * speed
  if (next < total) return { t: next, ended: false }
  if (loop) return { t: next % total, ended: false }
  return { t: total, ended: true }
}

/** Ein Frame vor bzw. zurück */
export function stepFrame(t: number, dir: 1 | -1, total: number): number {
  const f = Math.round(t / FRAME_DT) + dir
  return Math.min(total, Math.max(0, f * FRAME_DT))
}

export function formatTime(t: number): string {
  return `${t.toFixed(2).replace('.', ',')} s`
}
