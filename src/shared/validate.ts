import {
  DEFAULT_DISPLAY,
  DEFAULT_SETTINGS,
  MAX_PLAYERS_PER_SIDE,
  PLAYER_HEIGHT,
  ROLES,
  SCHEMA_VERSION,
  TRAJECTORY_TYPES,
  ZONE_STYLES,
  type CourtPlayer,
  type NetPresetId,
  type PlayDoc,
  type PlaySideDoc,
  type Player,
  type Role,
  type Settings,
  type Team,
  type Trajectory,
  type ZoneStyle
} from './types'
import { DEFAULT_LIBERO_COLOR, DEFAULT_TEAM_COLOR, isHexColor, pairedLibero } from './teamColors'

/** Alte Rollenkürzel (bis Phase 2) auf die neuen abbilden */
const LEGACY_ROLES: Record<string, Role> = { AA: 'A', DA: 'D' }

/**
 * Prüft und bereinigt Team-Daten (aus Datei oder vom Renderer).
 * Ungültige Einträge werden verworfen statt die ganze Datei abzulehnen.
 */
export function sanitizeTeams(raw: unknown): Team[] {
  const list = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.teams) ? raw.teams : []
  const teams: Team[] = []
  for (const t of list) {
    if (!isObj(t) || typeof t.id !== 'string') continue
    const players: Player[] = []
    for (const p of Array.isArray(t.players) ? t.players : []) {
      if (!isObj(p) || typeof p.id !== 'string') continue
      const positions = (Array.isArray(p.positions) ? p.positions : [])
        .map((r) => (typeof r === 'string' && r in LEGACY_ROLES ? LEGACY_ROLES[r] : r))
        .filter((r): r is Role => ROLES.includes(r as Role))
      players.push({
        id: p.id,
        name: typeof p.name === 'string' ? p.name.slice(0, 80) : '',
        number: clampNumber(p.number),
        positions: [...new Set(positions)],
        height: clampHeight(p.height)
      })
    }
    const color = isHexColor(t.color) ? t.color.toLowerCase() : DEFAULT_TEAM_COLOR
    teams.push({
      id: t.id,
      name: typeof t.name === 'string' ? t.name.slice(0, 80) : 'Team',
      color,
      // Ohne gespeicherte Libero-Farbe: der passende Partner der Trikotfarbe
      liberoColor: isHexColor(t.liberoColor) ? t.liberoColor.toLowerCase() : (pairedLibero(color) ?? DEFAULT_LIBERO_COLOR),
      players
    })
  }
  return teams
}

/** Körpergröße auf 1,0–2,3 m begrenzen, auf Zentimeter runden; ohne Angabe 1,75 m */
export function clampHeight(h: unknown): number {
  const v = Number(h)
  if (h === undefined || h === null || h === '' || !Number.isFinite(v)) return PLAYER_HEIGHT.default
  return Math.round(Math.min(PLAYER_HEIGHT.max, Math.max(PLAYER_HEIGHT.min, v)) * 100) / 100
}

export function clampNumber(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return 0
  return Math.min(99, Math.max(0, v))
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/* ---------- Einstellungen & Spielzüge ---------- */

const NET_PRESET_IDS: NetPresetId[] = ['herren', 'damen', 'mixed', 'custom']
const SPEED_STEPS = [0.25, 0.5, 1, 2, 4]

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v)
  if (v === null || v === undefined || v === '' || !Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS
  const r = isObj(raw) ? raw : {}
  const speed = Number(r.defaultSpeed)
  return {
    schemaVersion: SCHEMA_VERSION,
    netPreset: NET_PRESET_IDS.includes(r.netPreset as NetPresetId) ? (r.netPreset as NetPresetId) : d.netPreset,
    netHeight: num(r.netHeight, d.netHeight, 1, 3),
    defaultStartHZuspiel: num(r.defaultStartHZuspiel, d.defaultStartHZuspiel, 0, 6),
    defaultStartHAnnahme: num(r.defaultStartHAnnahme, d.defaultStartHAnnahme, 0, 6),
    defaultEndHAnnahme: num(r.defaultEndHAnnahme, d.defaultEndHAnnahme, 0, 6),
    defaultHitH: num(r.defaultHitH, d.defaultHitH, 0, 6),
    defaultApexOffsetZuspiel: num(r.defaultApexOffsetZuspiel, d.defaultApexOffsetZuspiel, 0, 10),
    defaultApexOffsetAnnahme: num(r.defaultApexOffsetAnnahme, d.defaultApexOffsetAnnahme, 0, 10),
    defaultLoop: bool(r.defaultLoop, d.defaultLoop),
    defaultSpeed: SPEED_STEPS.includes(speed) ? speed : d.defaultSpeed,
    fingerDraws: bool(r.fingerDraws, d.fingerDraws),
    zoneStyle: ZONE_STYLES.includes(r.zoneStyle as ZoneStyle) ? (r.zoneStyle as ZoneStyle) : d.zoneStyle
  }
}

function sanitizeTrajectory(raw: unknown): Trajectory | undefined {
  if (!isObj(raw) || !isObj(raw.start) || !isObj(raw.end)) return undefined
  const c = (v: unknown) => num(v, 0, -30, 30)
  return {
    start: { x: c(raw.start.x), y: c(raw.start.y), h: num(raw.start.h, 1, 0, 6) },
    end: { x: c(raw.end.x), y: c(raw.end.y) },
    apexH: num(raw.apexH, 3, 0, 15),
    hitH: num(raw.hitH, 2, 0, 6),
    ...(raw.rising === true ? { rising: true } : {})
  }
}

function sanitizeSide(raw: unknown): PlaySideDoc {
  const r = isObj(raw) ? raw : {}
  const players: CourtPlayer[] = []
  for (const p of Array.isArray(r.players) ? r.players : []) {
    if (!isObj(p) || typeof p.playerId !== 'string') continue
    const role = (typeof p.role === 'string' && p.role in LEGACY_ROLES ? LEGACY_ROLES[p.role] : p.role) as Role
    players.push({
      playerId: p.playerId,
      role: ROLES.includes(role) ? role : 'A',
      x: num(p.x, 0, -11, 11),
      y: num(p.y, 0, -6.5, 6.5)
    })
  }
  const snap = sanitizeTeams([r.teamSnapshot])[0] ?? null
  return {
    teamId: typeof r.teamId === 'string' ? r.teamId : null,
    players: players.slice(0, MAX_PLAYERS_PER_SIDE),
    teamSnapshot: snap
  }
}

const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.slice(0, max) : fallback)

/** Prüft einen gespeicherten Spielzug; null, wenn er unbrauchbar ist. */
export function sanitizePlay(raw: unknown): PlayDoc | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !/^[\w-]{1,64}$/.test(raw.id)) return null
  const tr = isObj(raw.trajectories) ? raw.trajectories : {}
  const trajectories: PlayDoc['trajectories'] = {}
  for (const t of TRAJECTORY_TYPES) {
    const v = sanitizeTrajectory(tr[t])
    if (v) trajectories[t] = v
  }
  const sides = isObj(raw.sides) ? raw.sides : {}
  const disp = isObj(raw.display) ? raw.display : {}
  const now = new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    id: raw.id,
    code: str(raw.code, 24),
    title: str(raw.title, 120),
    createdAt: str(raw.createdAt, 40, now),
    updatedAt: str(raw.updatedAt, 40, now),
    sides: { A: sanitizeSide(sides.A), B: sanitizeSide(sides.B) },
    trajectories,
    netPreset: NET_PRESET_IDS.includes(raw.netPreset as NetPresetId) ? (raw.netPreset as NetPresetId) : 'herren',
    netHeight: num(raw.netHeight, 2.43, 1, 3),
    display: {
      showAnnahme: bool(disp.showAnnahme, DEFAULT_DISPLAY.showAnnahme),
      showZuspiel: bool(disp.showZuspiel, DEFAULT_DISPLAY.showZuspiel),
      showAfterHit: bool(disp.showAfterHit, DEFAULT_DISPLAY.showAfterHit),
      ballOnly: bool(disp.ballOnly, DEFAULT_DISPLAY.ballOnly)
    },
    netViewFrom: raw.netViewFrom === 'B' ? 'B' : 'A',
    netAngle: Math.round(num(raw.netAngle, 0, -90, 90)),
    netShowPlayers: bool(raw.netShowPlayers, false)
  }
}

/** Dateiname aus einem Kürzel (für Exporte) */
export function safeFileName(name: string): string {
  const s = name.replace(/[<>:"/\|?*\u0000-\u001f]/g, '').trim().replace(/[. ]+$/, '')
  return s.slice(0, 80) || 'Spielzug'
}
