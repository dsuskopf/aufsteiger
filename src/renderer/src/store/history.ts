import { create } from 'zustand'
import { usePlay } from './playStore'
import { usePlayback } from './playbackStore'

/**
 * Rückgängig und Wiederholen (Strg+Z, Strg+Y) für den Spielzug: Aufstellung, Laufwege, Sprünge, Block,
 * Ballwege, Kopplungen, Anzeige und die Skizze. Eine zusammenhängende Bearbeitung (Ziehen, Regler, das Gleiten in eine neue
 * Aufstellung) wird zu einem Schritt zusammengefasst: Erst nach einer kurzen Pause beginnt ein neuer.
 * Öffnen oder neu Anlegen eines Spielzugs leert den Verlauf.
 */
type PlayState = ReturnType<typeof usePlay.getState>
type Snapshot = Pick<PlayState, 'sides' | 'trajectories' | 'schlag' | 'contacts' | 'display' | 'sketch'>

const LIMIT = 100
/** Änderungen, die schneller aufeinander folgen, gehören zum selben Schritt (ms) */
const GROUP_MS = 600

const take = (s: PlayState): Snapshot => ({ sides: s.sides, trajectories: s.trajectories, schlag: s.schlag, contacts: s.contacts, display: s.display, sketch: s.sketch })
const changed = (a: Snapshot, b: Snapshot) =>
  a.sides !== b.sides || a.trajectories !== b.trajectories || a.schlag !== b.schlag || a.contacts !== b.contacts || a.display !== b.display || a.sketch !== b.sketch

interface HistoryState {
  canUndo: boolean
  canRedo: boolean
}
export const useHistory = create<HistoryState>(() => ({ canUndo: false, canRedo: false }))

let past: Snapshot[] = []
let future: Snapshot[] = []
let lastEdit = 0
/** Während Rückgängig/Wiederholen selbst den Spielzug setzt, nichts aufzeichnen */
let applying = false

const publish = () => useHistory.setState({ canUndo: past.length > 0, canRedo: future.length > 0 })

usePlay.subscribe((s, prev) => {
  if (applying) return
  const before = take(prev)
  if (!changed(before, take(s))) return
  const now = performance.now()
  // Neuer Schritt nur nach einer Pause; sonst gehört die Änderung zum laufenden
  if (now - lastEdit > GROUP_MS || past.length === 0) {
    past.push(before)
    if (past.length > LIMIT) past.shift()
  }
  lastEdit = now
  future = []
  publish()
})

function apply(snap: Snapshot) {
  applying = true
  const play = usePlay.getState()
  // Auswahl aufheben, wenn das Gewählte danach nicht mehr existiert
  const selected = play.selected && (play.selected === 'schlag' ? snap.schlag : snap.trajectories[play.selected]) ? play.selected : null
  const sp = play.selectedPlayer
  const selectedPlayer = sp && snap.sides[sp.side].players.some((c) => c.playerId === sp.playerId) ? sp : null
  usePlay.setState({ ...snap, selected, selectedPlayer })
  applying = false
  lastEdit = 0
  // Die Grundstellung zeigen, wie sie jetzt ist
  usePlayback.getState().pause()
  usePlayback.setState({ t: 0 })
  publish()
}

export function undo(): void {
  const snap = past.pop()
  if (!snap) return
  future.push(take(usePlay.getState()))
  apply(snap)
}

export function redo(): void {
  const snap = future.pop()
  if (!snap) return
  past.push(take(usePlay.getState()))
  apply(snap)
}

/** Verlauf leeren (neuer oder geöffneter Spielzug) */
export function clearHistory(): void {
  past = []
  future = []
  lastEdit = 0
  publish()
}
