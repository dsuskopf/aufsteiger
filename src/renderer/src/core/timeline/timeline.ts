import { positionAt, solveTrajectory, type SolvedTrajectory, type TrajectoryInput } from '../physics/trajectory'
import { attackPositionAt, solveAttack, trackPositionAt, type AttackInput, type SolvedAttack, type Track } from '../physics/attack'

/** Physik-Zeitschritt für Frame-für-Frame (unabhängig vom Tempo) */
export const FRAME_DT = 1 / 60
export const SPEEDS = [0.25, 0.5, 1, 2, 4] as const

/** Ein Ballflug auf der Zeitachse: Parabel (Annahme, Zuspiel) oder Schlag (mit Drall) */
export interface Segment<T extends string = string> {
  type: T
  /** Parabel: Eingabe und Lösung */
  input?: TrajectoryInput
  sol?: SolvedTrajectory
  /** Schlag: Eingabe und Lösung */
  attack?: AttackInput
  asol?: SolvedAttack
  /** Vorberechnete Bewegung (Abprall nach dem Schlag) */
  track?: Track
  /** Beginn und Ende auf der Gesamt-Zeitachse (s) */
  t0: number
  t1: number
}

export interface Timeline<T extends string = string> {
  segments: Segment<T>[]
  total: number
}

export type TimelineItem<T extends string> =
  | { type: T; input: TrajectoryInput }
  | { type: T; attack: AttackInput }
  | { type: T; track: Track }

/** Hängt die sichtbaren Ballflüge nacheinander (Annahme, Zuspiel, Schlag); jeder dauert bis zu seinem Schlagpunkt/Ziel. */
export function buildTimeline<T extends string>(list: TimelineItem<T>[]): Timeline<T> {
  let t = 0
  const segments = list.map((item) => {
    if ('track' in item) {
      const seg: Segment<T> = { type: item.type, track: item.track, t0: t, t1: t + item.track.t[item.track.t.length - 1] }
      t = seg.t1
      return seg
    }
    if ('attack' in item) {
      const asol = solveAttack(item.attack)
      const seg: Segment<T> = { type: item.type, attack: item.attack, asol, t0: t, t1: t + asol.tHit }
      t = seg.t1
      return seg
    }
    const sol = solveTrajectory(item.input)
    const seg: Segment<T> = { type: item.type, input: item.input, sol, t0: t, t1: t + sol.tHit }
    t = seg.t1
    return seg
  })
  return { segments, total: t }
}

/** Position innerhalb eines Segments zur lokalen Zeit (ab seinem Beginn) */
export function segmentPosition<T extends string>(seg: Segment<T>, local: number): { x: number; y: number; z: number } {
  const tl = Math.min(seg.t1 - seg.t0, Math.max(0, local))
  if (seg.track) return trackPositionAt(seg.track, tl)
  if (seg.asol) return attackPositionAt(seg.asol, tl)
  return positionAt(seg.sol!, seg.input!.start, tl)
}

/** Ballposition zur Zeit t (geklemmt auf 0..total); null ohne Flugbahn */
export function ballAt<T extends string>(
  tl: Timeline<T>,
  t: number
): { x: number; y: number; z: number; type: T } | null {
  if (tl.segments.length === 0) return null
  const tc = Math.min(tl.total, Math.max(0, t))
  const seg = tl.segments.find((s) => tc <= s.t1) ?? tl.segments[tl.segments.length - 1]
  return { ...segmentPosition(seg, tc - seg.t0), type: seg.type }
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
