import {
  DEFAULT_DISPLAY,
  DEFAULT_SETTINGS,
  BALL_TYPES,
  MAX_PLAYERS_PER_SIDE,
  PLAYER_HEIGHT,
  ROLES,
  SCHEMA_VERSION,
  TRAJECTORY_TYPES,
  ZONE_STYLES,
  type Attack,
  type Contacts,
  type CourtPlayer,
  type Formation,
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
import { TEAM_GENDERS, sanitizeLook, type TeamGender } from './looks'

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
        height: clampHeight(p.height),
        ...(sanitizeLook(p.look) ? { look: sanitizeLook(p.look) } : {})
      })
    }
    const color = isHexColor(t.color) ? t.color.toLowerCase() : DEFAULT_TEAM_COLOR
    const team: Team = {
      id: t.id,
      name: typeof t.name === 'string' ? t.name.slice(0, 80) : 'Team',
      color,
      // Ohne gespeicherte Libero-Farbe: der passende Partner der Trikotfarbe
      liberoColor: isHexColor(t.liberoColor) ? t.liberoColor.toLowerCase() : (pairedLibero(color) ?? DEFAULT_LIBERO_COLOR),
      ...(TEAM_GENDERS.includes(t.gender as TeamGender) ? { gender: t.gender as TeamGender } : {}),
      players
    }
    const rotations = sanitizeRotations(t.rotations, new Set(players.map((p) => p.id)))
    if (rotations) team.rotations = rotations
    teams.push(team)
  }
  return teams
}

/** Läufersystem eines Teams: nur gültige Schlüssel („1-annahme“ … „6-aufschlag“) und Spieler des Teams */
function sanitizeRotations(raw: unknown, ids: Set<string>): Record<string, Formation> | undefined {
  if (!isObj(raw)) return undefined
  const out: Record<string, Formation> = {}
  for (const [key, f] of Object.entries(raw)) {
    if (!/^[1-6]-(annahme|aufschlag)$/.test(key) || !isObj(f) || !isObj(f.pos)) continue
    const pos: Formation['pos'] = {}
    for (const [id, p] of Object.entries(f.pos)) if (ids.has(id) && isObj(p)) pos[id] = { x: num(p.x, 0, -11, 11), y: num(p.y, 0, -6.5, 6.5) }
    const formation: Formation = { pos }
    if (f.liberoFor === null) formation.liberoFor = null
    else if (typeof f.liberoFor === 'string' && ids.has(f.liberoFor)) formation.liberoFor = f.liberoFor
    out[key] = formation
  }
  return Object.keys(out).length ? out : undefined
}

/** Körpergröße auf 1,0–2,5 m begrenzen, auf Zentimeter runden; ohne Angabe 1,75 m */
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
    lineupRules: bool(r.lineupRules, d.lineupRules),
    showLaeuferMark: bool(r.showLaeuferMark, d.showLaeuferMark),
    trajectoryOpacity3d: Math.round(num(r.trajectoryOpacity3d, d.trajectoryOpacity3d, 10, 100)),
    bounce: bool(r.bounce, d.bounce),
    bounceDuration: Math.round(num(r.bounceDuration, d.bounceDuration, 0.5, 5) * 10) / 10,
    zoneStyle: ZONE_STYLES.includes(r.zoneStyle as ZoneStyle) ? (r.zoneStyle as ZoneStyle) : d.zoneStyle,
    cameraShake: bool(r.cameraShake, d.cameraShake),
    sound: bool(r.sound, d.sound),
    soundVolume: Math.round(num(r.soundVolume, d.soundVolume, 0, 100))
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
    ...(raw.rising === true ? { rising: true } : {}),
    ...(raw.backset === true ? { backset: true } : {})
  }
}

function sanitizeAttack(raw: unknown): Attack | undefined {
  if (!isObj(raw) || !isObj(raw.start) || !isObj(raw.end)) return undefined
  const c = (v: unknown) => num(v, 0, -30, 30)
  return {
    start: { x: c(raw.start.x), y: c(raw.start.y), h: num(raw.start.h, 3, 0, 6) },
    end: { x: c(raw.end.x), y: c(raw.end.y) },
    ...(raw.finte === true ? { finte: true } : {}),
    ...(raw.arc !== undefined ? { arc: num(raw.arc, 0.6, 0.1, 3) } : {}),
    speed: num(raw.speed, 70 / 3.6, 20 / 3.6, 130 / 3.6),
    topspin: num(raw.topspin, 0, -10, 10),
    sidespin: num(raw.sidespin, 0, -10, 10)
  }
}

function sanitizeSide(raw: unknown): PlaySideDoc {
  const r = isObj(raw) ? raw : {}
  const players: CourtPlayer[] = []
  for (const p of Array.isArray(r.players) ? r.players : []) {
    if (!isObj(p) || typeof p.playerId !== 'string') continue
    const role = (typeof p.role === 'string' && p.role in LEGACY_ROLES ? LEGACY_ROLES[p.role] : p.role) as Role
    const slot = Math.round(Number(p.slot))
    const c: CourtPlayer = {
      playerId: p.playerId,
      role: ROLES.includes(role) ? role : 'A',
      x: num(p.x, 0, -11, 11),
      y: num(p.y, 0, -6.5, 6.5),
      ...(slot >= 1 && slot <= 6 ? { slot } : {})
    }
    if (isObj(p.path) && Array.isArray(p.path.points)) {
      const points = p.path.points.filter(isObj).slice(0, 16).map((q) => ({ x: num(q.x, 0, -11, 11), y: num(q.y, 0, -6.5, 6.5) }))
      if (points.length) c.path = { points, delay: num(p.path.delay, 0, 0, 10), speed: num(p.path.speed, 4, 1, 8) }
    }
    if (isObj(p.jump)) c.jump = { at: num(p.jump.at, 0, 0, 20), height: num(p.jump.height, 0.6, 0.2, 1.1), ...(p.jump.sync === true ? { sync: true } : {}) }
    if (p.block === true) c.block = true
    if (p.fake === true) c.fake = true
    players.push(c)
  }
  const snap = sanitizeTeams([r.teamSnapshot])[0] ?? null
  const side: PlaySideDoc = {
    teamId: typeof r.teamId === 'string' ? r.teamId : null,
    players: players.slice(0, MAX_PLAYERS_PER_SIDE),
    teamSnapshot: snap
  }
  if (typeof r.liberoIdle === 'string' && !side.players.some((c) => c.playerId === r.liberoIdle)) side.liberoIdle = r.liberoIdle
  if (isObj(r.laeufer)) {
    const n = Math.round(Number(r.laeufer.n))
    const situation = r.laeufer.situation === 'aufschlag' ? 'aufschlag' : 'annahme'
    if (n >= 1 && n <= 6) side.laeufer = { n, situation }
  }
  // Libero ersetzt einen Spieler, der nicht auf dem Feld steht
  if (typeof r.liberoFor === 'string' && !side.players.some((c) => c.playerId === r.liberoFor) && side.players.some((c) => c.role === 'L')) {
    side.liberoFor = r.liberoFor
    if (ROLES.includes(r.liberoRole as Role) && r.liberoRole !== 'L') side.liberoRole = r.liberoRole as Role
  }
  return side
}

/** Gekoppelte Ballkontakte: nur Spieler, die auf dem Feld stehen */
function sanitizeContacts(raw: unknown, sides: PlayDoc['sides']): Contacts | undefined {
  if (!isObj(raw)) return undefined
  const out: Contacts = {}
  for (const type of BALL_TYPES) {
    const r = raw[type]
    if (!isObj(r) || (r.side !== 'A' && r.side !== 'B') || typeof r.playerId !== 'string') continue
    const side = r.side
    const playerId = r.playerId
    if (sides[side].players.some((c) => c.playerId === playerId)) out[type] = { side, playerId }
  }
  return Object.keys(out).length ? out : undefined
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
  const rawSides = isObj(raw.sides) ? raw.sides : {}
  const sides = { A: sanitizeSide(rawSides.A), B: sanitizeSide(rawSides.B) }
  const contacts = sanitizeContacts(raw.contacts, sides)
  const disp = isObj(raw.display) ? raw.display : {}
  const now = new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    id: raw.id,
    code: str(raw.code, 24),
    title: str(raw.title, 120),
    createdAt: str(raw.createdAt, 40, now),
    updatedAt: str(raw.updatedAt, 40, now),
    sides,
    trajectories,
    ...(contacts ? { contacts } : {}),
    netPreset: NET_PRESET_IDS.includes(raw.netPreset as NetPresetId) ? (raw.netPreset as NetPresetId) : 'herren',
    netHeight: num(raw.netHeight, 2.43, 1, 3),
    display: {
      ballOnly: bool(disp.ballOnly, DEFAULT_DISPLAY.ballOnly)
    },
    ...(sanitizeAttack(raw.schlag) ? { schlag: sanitizeAttack(raw.schlag) } : {}),
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
