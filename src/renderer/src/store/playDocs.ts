import { DEFAULT_DISPLAY, SCHEMA_VERSION, type CourtSide, type PlayDoc, type PlaySummary } from '@shared/types'
import { usePlay } from './playStore'
import { useUi } from './settingsStore'
import { useTeams } from './teamsStore'
import { useSettings } from './appSettings'
import { usePlayback } from './playbackStore'
import { inferSlots } from '@renderer/core/lineup/lineup'

/** Aktuellen Spielzug als speicherbares Dokument (Teams als Referenz + Kopie) */
export function currentDoc(meta: { id: string; code: string; title: string; createdAt: string }): PlayDoc {
  const play = usePlay.getState()
  const ui = useUi.getState()
  const teams = useTeams.getState().teams
  const side = (s: CourtSide) => ({
    ...play.sides[s],
    teamSnapshot: teams.find((t) => t.id === play.sides[s].teamId) ?? null
  })
  return {
    schemaVersion: SCHEMA_VERSION,
    ...meta,
    updatedAt: new Date().toISOString(),
    sides: { A: side('A'), B: side('B') },
    trajectories: play.trajectories,
    ...(play.schlag ? { schlag: play.schlag } : {}),
    netPreset: ui.netPreset,
    netHeight: ui.netHeight,
    display: play.display,
    netViewFrom: ui.netViewFrom,
    netAngle: ui.netAngle,
    netShowPlayers: ui.netShowPlayers
  }
}

/** Speichert den aktuellen Spielzug (überschreibt den geöffneten oder legt einen neuen an). */
export async function saveCurrent(code: string, title: string, asNew: boolean): Promise<PlayDoc> {
  const cur = usePlay.getState().current
  const meta =
    cur && !asNew
      ? { id: cur.id, code, title, createdAt: cur.createdAt }
      : { id: crypto.randomUUID(), code, title, createdAt: new Date().toISOString() }
  const saved = await window.api.plays.save(currentDoc(meta))
  usePlay.setState({
    current: { id: saved.id, code: saved.code, title: saved.title, createdAt: saved.createdAt },
    dirty: false
  })
  return saved
}

/** Öffnet einen gespeicherten Spielzug; fehlende Teams werden aus der Kopie wiederhergestellt. */
export function openDoc(doc: PlayDoc): void {
  const teams = useTeams.getState()
  for (const s of ['A', 'B'] as const) {
    const snap = doc.sides[s].teamSnapshot
    if (doc.sides[s].teamId && snap && !teams.teams.some((t) => t.id === doc.sides[s].teamId)) teams.restoreTeam(snap)
  }
  // Spielzug-Seite ohne Team-Kopie; ältere Spielzüge bekommen ihre Positionen 1–6 aus der Lage
  const strip = (s: CourtSide) => {
    const { teamSnapshot: _snap, ...side } = doc.sides[s]
    return { ...side, players: inferSlots(side.players, s) }
  }
  usePlayback.getState().pause()
  usePlayback.setState({ t: 0 })
  const ui = useUi.getState()
  ui.setNetHeight(doc.netHeight)
  useUi.setState({ netViewFrom: doc.netViewFrom, netAngle: doc.netAngle, netShowPlayers: doc.netShowPlayers, tool: 'select' })
  usePlay.setState({
    sides: { A: strip('A'), B: strip('B') },
    trajectories: doc.trajectories,
    schlag: doc.schlag ?? null,
    display: doc.display,
    selected: null,
    current: { id: doc.id, code: doc.code, title: doc.title, createdAt: doc.createdAt }
  })
  usePlay.setState({ dirty: false })
}

/** Neuer, leerer Spielzug mit den Standardwerten aus den Einstellungen */
export function newPlay(): void {
  const st = useSettings.getState().settings
  usePlayback.getState().pause()
  usePlayback.setState({ t: 0, loop: st.defaultLoop, speed: st.defaultSpeed })
  useUi.getState().setNetHeight(st.netHeight)
  useUi.setState({ tool: 'select' })
  usePlay.setState({
    sides: { A: { teamId: null, players: [] }, B: { teamId: null, players: [] } },
    trajectories: {},
    schlag: null,
    display: { ...DEFAULT_DISPLAY },
    selected: null,
    selectedPlayer: null,
    current: null
  })
  const first = useTeams.getState().teams[0]
  if (first) usePlay.getState().setTeam('A', first.id)
  usePlay.setState({ dirty: false })
}

export async function duplicatePlay(id: string): Promise<PlaySummary | null> {
  const doc = await window.api.plays.load(id)
  if (!doc) return null
  const now = new Date().toISOString()
  const copy = await window.api.plays.save({
    ...doc,
    id: crypto.randomUUID(),
    code: `${doc.code} Kopie`.slice(0, 24),
    createdAt: now,
    updatedAt: now
  })
  return { id: copy.id, code: copy.code, title: copy.title, updatedAt: copy.updatedAt }
}

export async function renamePlay(id: string, code: string, title: string): Promise<void> {
  const doc = await window.api.plays.load(id)
  if (!doc) return
  await window.api.plays.save({ ...doc, code, title, updatedAt: new Date().toISOString() })
  const cur = usePlay.getState().current
  if (cur?.id === id) usePlay.setState({ current: { ...cur, code, title } })
}

export async function deletePlay(id: string): Promise<void> {
  await window.api.plays.remove(id)
  const cur = usePlay.getState().current
  // Der geöffnete Spielzug bleibt sichtbar, gilt aber wieder als neu und ungespeichert
  if (cur?.id === id) usePlay.setState({ current: null, dirty: true })
}

// Netzhöhe und Netzansicht gehören zum Spielzug: Änderungen gelten als ungespeichert
useUi.subscribe((s, prev) => {
  if (s.netHeight !== prev.netHeight || s.netViewFrom !== prev.netViewFrom || s.netAngle !== prev.netAngle || s.netShowPlayers !== prev.netShowPlayers)
    if (!usePlay.getState().dirty) usePlay.setState({ dirty: true })
})
