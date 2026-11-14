import { create } from 'zustand'
import { advance, ballAt, buildTimeline, stepFrame, type Timeline, type TimelineItem } from '@renderer/core/timeline/timeline'
import { visibleTrajectories } from './selectors'
import { usePlay } from './playStore'
import type { CourtSide } from '@shared/types'
import { useSettings } from './appSettings'
import { useUi } from './settingsStore'
import { useTeams } from './teamsStore'
import { buildRally, type BallEvent, type BlockerFn, type Rally, type RallyType } from '@renderer/core/physics/rally'
import { bodyOf } from '@shared/looks'
import { bodyCapsules, bridge, handPlates } from '@renderer/core/motion/pose'
import { planAt, planXY, planDuration, planKey, planPlayers, type PlayerPlan } from '@renderer/core/motion/plan'

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

/** Der ganze Spielzug in Bewegung: Ballwechsel (mit Abprallern und Ereignissen) und die Bewegungspläne der Spieler */
export interface Scene extends Rally {
  plans: Map<string, PlayerPlan>
  /** Gesamtdauer: Ballflug und Bewegungen der Spieler */
  total: number
}

let memo: { key: unknown[]; scene: Scene } | null = null

/** Aktueller Spielzug in Bewegung (zwischengespeichert, solange sich nichts ändert) */
export function currentScene(): Scene {
  const { trajectories, display, schlag, sides, contacts } = usePlay.getState()
  const st = useSettings.getState().settings
  const netHeight = useUi.getState().netHeight
  const teams = useTeams.getState().teams
  const key = [trajectories, schlag, sides, contacts, teams, netHeight, st.bounce, st.bounceDuration]
  if (memo && memo.key.every((k, i) => k === key[i])) return memo.scene

  const items: TimelineItem<RallyType>[] = visibleTrajectories(trajectories, display).map((v) => ({ type: v.type, input: v.input }))
  if (schlag) items.push({ type: 'schlag', attack: schlag })
  const heightOf = (side: CourtSide, playerId: string) =>
    teams.find((t) => t.id === sides[side].teamId)?.players.find((p) => p.id === playerId)?.height ?? 1.75
  // Pläne aus den Flügen ohne Abpraller (Kontaktzeiten), dann der Ballwechsel mit den Blockern
  const femaleOf = (side: CourtSide, playerId: string) => {
    const team = teams.find((t) => t.id === sides[side].teamId)
    const p = team?.players.find((q) => q.id === playerId)
    return bodyOf(team?.gender, playerId, p?.look) === 'f'
  }
  const plans = planPlayers({ sides, contacts, timeline: buildTimeline(items), heightOf, femaleOf, netHeight })
  // Blocker: ihre echten Arme, Hände und der Kopf – weit weg vom Ball wird gar nicht erst gerechnet
  const blocking = [...plans.values()].filter((p) => p.actions.some((a) => a.kind === 'block'))
  const near = (p: PlayerPlan, t: number, ball: { x: number; y: number }) => {
    const at = planXY(p, t)
    return Math.hypot(at.x - ball.x, at.y - ball.y) <= 2.5
  }
  const blockers: BlockerFn[] = blocking.map((p) => (t, ball) => (near(p, t, ball) ? { key: p.key, caps: bodyCapsules(p, t, ball) } : null))
  // Doppel- und Dreierblock: Liegen die Hände zweier Blocker dicht beieinander, ist dazwischen keine Lücke
  for (let i = 0; i < blocking.length; i++)
    for (let j = i + 1; j < blocking.length; j++) {
      const p = blocking[i]
      const q = blocking[j]
      blockers.push((t, ball) => {
        if (!near(p, t, ball) || !near(q, t, ball)) return null
        const hp = handPlates(p, t, ball)
        const hq = handPlates(q, t, ball)
        const caps = hp.flatMap((a) => hq.map((b) => bridge(a, b))).filter((c) => !!c)
        // Gewertet wird der Blocker, dessen Hand näher am Ball ist
        const dp = Math.min(...hp.map((h) => Math.hypot(h.c[0] - ball.x, h.c[1] - ball.y)))
        const dq = Math.min(...hq.map((h) => Math.hypot(h.c[0] - ball.x, h.c[1] - ball.y)))
        return caps.length ? { key: dp <= dq ? p.key : q.key, caps } : null
      })
    }
  const rally = buildRally({ items, netHeight, blockers, bounce: st.bounce, bounceDuration: st.bounceDuration })
  const scene: Scene = { ...rally, plans, total: Math.max(rally.timeline.total, planDuration(plans.values())) }
  memo = { key, scene }
  return scene
}

/** Timeline der Ballflüge (Annahme, Zuspiel, Schlag, Abprall) */
export function currentTimeline(): Timeline<RallyType> {
  return currentScene().timeline
}

/** Ballkontakte des Spielzugs (für Zeitleiste, Geräusche, Effekte) */
export function currentEvents(): BallEvent[] {
  return currentScene().events
}

/** Gesamtdauer des Spielzugs: Ballflug und Bewegungen der Spieler (Läufe, Sprünge) */
export function totalDuration(): number {
  return currentScene().total
}

/** Position eines Spielers zur Zeit t (mit Lauf und Sprung); null, wenn er nicht auf dem Feld steht */
export function playerPosition(side: CourtSide, playerId: string, t: number): { x: number; y: number; z: number } | null {
  const plan = currentScene().plans.get(planKey(side, playerId))
  return plan ? planAt(plan, t) : null
}

/** React-Hook: Spielzug in Bewegung, neu berechnet bei jeder Änderung */
export function useScene(): Scene {
  useSettings((s) => s.settings.bounce)
  useSettings((s) => s.settings.bounceDuration)
  useUi((s) => s.netHeight)
  useTeams((s) => s.teams)
  usePlay((s) => s.trajectories)
  usePlay((s) => s.schlag)
  usePlay((s) => s.sides)
  usePlay((s) => s.contacts)
  return currentScene()
}

/** React-Hook: Gesamtdauer */
export function useTotalDuration(): number {
  return useScene().total
}

/** Ballposition zur aktuellen Zeit (oder null ohne Flugbahn) */
export function currentBall() {
  return ballAt(currentTimeline(), usePlayback.getState().t)
}

let raf = 0
let last = 0
/** Wird für jedes Ballereignis aufgerufen, das beim Abspielen überschritten wird (Geräusche) */
const eventListeners = new Set<(e: BallEvent, speed: number) => void>()
export function onBallEvent(fn: (e: BallEvent, speed: number) => void): () => void {
  eventListeners.add(fn)
  return () => eventListeners.delete(fn)
}
const fire = (from: number, to: number, speed: number) => {
  if (eventListeners.size === 0) return
  for (const e of currentEvents()) if (e.t >= from && e.t < to) for (const fn of eventListeners) fn(e, speed)
}

/** Globale Animationsuhr: treibt 3D und beide 2D-Ansichten. */
export const usePlayback = create<PlaybackState>((set, get) => {
  const tick = (now: number) => {
    const s = get()
    if (!s.playing) return
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    const total = totalDuration()
    const r = advance(s.t, dt, s.speed, total, s.loop)
    // Ereignisse im durchlaufenen Abschnitt melden (auch über das Schleifenende hinweg)
    if (r.t >= s.t) fire(s.t, r.ended ? total + 1 : r.t, s.speed)
    else {
      fire(s.t, total + 1, s.speed)
      fire(0, r.t, s.speed)
    }
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

// Ändert sich der Spielzug, bleibt die Zeit im gültigen Bereich
const clampTime = () => {
  const total = totalDuration()
  if (usePlayback.getState().t > total) usePlayback.setState({ t: total })
}
usePlay.subscribe((s, prev) => {
  if (s.trajectories === prev.trajectories && s.schlag === prev.schlag && s.display === prev.display && s.sides === prev.sides && s.contacts === prev.contacts) return
  clampTime()
})
useUi.subscribe((s, prev) => {
  if (s.netHeight !== prev.netHeight) clampTime()
})

/**
 * Flugbahnen ausgeblendet („Nur Ball“): solange die Animation läuft oder mitten im Flug angehalten ist.
 * Am Anfang und am Ende sind die Bahnen wieder da, damit man sie bearbeiten kann.
 */
export function usePathsHidden(): boolean {
  const ballOnly = usePlay((s) => s.display.ballOnly)
  const total = useTotalDuration()
  const playing = usePlayback((s) => s.playing)
  // Nur der Wahrheitswert hängt an t, damit nicht jedes Bild neu gezeichnet wird
  const midFlight = usePlayback((s) => s.t > 1e-6 && s.t < total - 1e-6)
  return ballOnly && (playing || midFlight)
}

/** React-Hook: Ballposition, aktualisiert mit der Uhr */
export function useBall() {
  usePlayback((s) => s.t)
  useScene()
  return currentBall()
}
