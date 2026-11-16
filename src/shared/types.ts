import type { Look, TeamGender } from './looks'

/** Schema-Version aller gespeicherten Dokumente (Migrationen ab Phase 5). */
export const SCHEMA_VERSION = 1

export type NetPresetId = 'herren' | 'damen' | 'mixed' | 'custom'

export type Role = 'S' | 'MB' | 'A' | 'D' | 'L'

/** Alle Rollen in Anzeige-Reihenfolge. Rollen sind rein optisch. */
export const ROLES: readonly Role[] = ['S', 'A', 'MB', 'D', 'L']

export const ROLE_LABELS: Record<Role, string> = {
  S: 'Steller',
  MB: 'Mittelblocker',
  A: 'Außenangreifer',
  D: 'Diagonalangreifer',
  L: 'Libero'
}

/* ---------- Teams ---------- */

export interface Player {
  id: string
  name: string
  /** Rückennummer (1–99) */
  number: number
  /** Eine oder mehrere Positionen; die erste gilt als Hauptposition. */
  positions: Role[]
  /** Körpergröße in Metern (Figur in 3D genau so groß) */
  height: number
  /** Aussehen der 3D-Figur; ohne Angabe fest-zufällig */
  look?: Look
}

/** Körpergröße: Standard und erlaubter Bereich (Meter) */
export const PLAYER_HEIGHT = { default: 1.75, min: 1.0, max: 2.5 } as const
/** Kopf (Kreis bzw. Schild mit Rolle und Nummer) über dem Körper: Durchmesser in Metern */
export const HEAD_DIAMETER = 0.4

/** Annahme (Gegner schlägt auf) oder eigener Aufschlag */
export type Situation = 'annahme' | 'aufschlag'

/** Gespeicherte Aufstellung eines Läufers: Plätze je Spieler (Seite-A-Koordinaten) und wen der Libero ersetzt */
export interface Formation {
  pos: Record<string, { x: number; y: number }>
  /** null = Libero in dieser Aufstellung draußen; fehlt = Standard (MB hinten) */
  liberoFor?: string | null
}

export interface Team {
  id: string
  name: string
  /** Trikotfarbe (Hex, z. B. #5b2a86) – gilt für alle Spieler außer dem Libero */
  color: string
  /** Libero-Trikotfarbe (Hex) – ein Spieler in der Rolle L trägt automatisch diese Farbe */
  liberoColor: string
  /** Männer, Frauen oder gemischt – bestimmt die 3D-Figuren (fehlt = Männer) */
  gender?: TeamGender
  players: Player[]
  /** Läufersystem: gespeicherte Aufstellungen je „Läufer-Situation“ (z. B. „1-annahme“) */
  rotations?: Record<string, Formation>
}

export interface TeamsFile {
  schemaVersion: number
  teams: Team[]
}

/* ---------- Spielzug: Aufstellung ---------- */

export type CourtSide = 'A' | 'B'

/** Ein Spieler auf dem Feld. Nummer und Name kommen aus dem Team, die Rolle wählt man im Spielzug. */
export interface CourtPlayer {
  playerId: string
  role: Role
  /** Position in Weltkoordinaten (Meter) */
  x: number
  y: number
  /** Feste Position 1–6 in der Rotation (2/3/4 vorne, 1/6/5 hinten); der Libero hat die des Ersetzten */
  slot?: number
  /** Laufweg ab seinem Platz (glatte Kurve durch die Punkte) */
  path?: RunPath
  /** Sprung (senkrecht) während des Spielzugs */
  jump?: Jump
  /** Blockt: springt am Netz mit beiden Armen hoch; der Schlag prallt an seinen Händen ab, wenn er sie trifft */
  block?: boolean
  /** Fake-Schlag: springt und schlägt am höchsten Punkt seines Sprungs – ohne Ball (bindet den Block) */
  fake?: boolean
}

/** Verweis auf einen Spieler auf dem Feld */
export interface PlayerRef {
  side: CourtSide
  playerId: string
}

/** Laufweg: Punkte nach dem Start (Start = Platz des Spielers), Startverzögerung und Tempo */
export interface RunPath {
  points: Vec2[]
  /** Start nach … Sekunden */
  delay: number
  /** Tempo in m/s */
  speed: number
}

/** Sprung: Absprung zur Zeit at (s), Steighöhe in Metern */
export interface Jump {
  at: number
  height: number
  /**
   * Zeitpunkt automatisch: Der höchste Punkt fällt auf den Ballkontakt bzw. Block des Spielers
   * (at wird dann ignoriert). Ohne Ballkontakt/Block gilt at.
   */
  sync?: boolean
}

export interface PlaySide {
  teamId: string | null
  /** Höchstens 6 Spieler (ein Libero ersetzt einen Hinterfeldspieler, zählt also nicht extra) */
  players: CourtPlayer[]
  /** Spieler, den der Libero gerade ersetzt (nicht auf dem Feld) */
  liberoFor?: string
  /** Rolle des ersetzten Spielers (für die Rückkehr aufs Feld) */
  liberoRole?: Role
  /** Libero, der in dieser Rotation draußen ist (z. B. der Mittelblocker schlägt auf) */
  liberoIdle?: string
  /** Zuletzt gewählter Läufer (Position des Stellers) und Situation */
  laeufer?: { n: number; situation: Situation }
}

export const MAX_PLAYERS_PER_SIDE = 6

export interface Vec2 {
  x: number
  y: number
}

/** Punkt in Weltkoordinaten (Meter). x = Länge, y = Breite, z = Höhe. */
export interface Vec3 {
  x: number
  y: number
  z: number
}

export type TrajectoryType = 'annahme' | 'zuspiel'
/** Alle Ballflüge eines Spielzugs: Annahme, Zuspiel (Parabeln) und Schlag (mit Drall) */
export type BallType = TrajectoryType | 'schlag'
export const BALL_LABELS: Record<BallType, string> = { annahme: 'Annahme', zuspiel: 'Zuspiel', schlag: 'Schlag' }
export const BALL_TYPES: readonly BallType[] = ['annahme', 'zuspiel', 'schlag']
/**
 * Wer den Ball spielt: je Ballflug der Spieler am Start (Annahme = Annehmer, Zuspiel = Steller, Schlag = Angreifer).
 * Gekoppelte Spieler führen die Bewegung aus (Bagger, Pritschen, Schlag) und laufen/springen von selbst zum Ball.
 */
export type Contacts = Partial<Record<BallType, PlayerRef>>

/**
 * Schlag (Angriff): Start = Schlagpunkt des Zuspiels, Ziel auf dem Boden.
 * Angriff: eingestellt werden Abschlaggeschwindigkeit und Drall; Winkel und höchster Punkt werden berechnet.
 * Finte: der Ball wird nur leicht über den Block getippt – eingestellt wird die Bogenhöhe, das Tempo ergibt sich.
 */
export interface Attack {
  start: { x: number; y: number; h: number }
  end: { x: number; y: number }
  /** Finte (Tipp über den Block) statt hartem Angriff */
  finte?: boolean
  /** Finte: höchster Punkt des Bogens über dem Schlagpunkt (m) */
  arc?: number
  /** Abschlaggeschwindigkeit in m/s (nur Angriff) */
  speed: number
  /** Topspin in U/s (negativ = Backspin) */
  topspin: number
  /** Seitendrall in U/s (positiv = Kurve nach rechts aus Sicht des Angreifers) */
  sidespin: number
}
export const TRAJECTORY_TYPES: readonly TrajectoryType[] = ['annahme', 'zuspiel']
export const TRAJECTORY_LABELS: Record<TrajectoryType, string> = { annahme: 'Annahme', zuspiel: 'Zuspiel' }

/**
 * Gespeicherte Flugbahn. In der Draufsicht eine Gerade von start nach end (= Schlagpunkt);
 * Parabel, Geschwindigkeit und Dauer werden daraus berechnet (core/physics).
 * Beim Zuspiel ist start an den Schlagpunkt der Annahme gekoppelt, sobald es eine Annahme gibt.
 */
export interface Trajectory {
  start: { x: number; y: number; h: number }
  end: { x: number; y: number }
  apexH: number
  hitH: number
  /** Schlagpunkt auf dem steigenden Ast (vor dem Scheitel) */
  rising?: boolean
  /** Nur Zuspiel: über Kopf nach hinten gestellt (Backset) – der Steller steht mit dem Rücken zur Spielrichtung */
  backset?: boolean
}

/** Anzeige-Optionen eines Spielzugs */
export interface PlayDisplay {
  /** Beim Abspielen nur den Ball zeigen, die Flugbahnen ausblenden (Checkbox „Flugbahn“ aus) */
  ballOnly: boolean
}

export const DEFAULT_DISPLAY: PlayDisplay = { ballOnly: false }

export interface Settings {
  schemaVersion: number
  netPreset: NetPresetId
  netHeight: number
  /** Hand des Stellers */
  defaultStartHZuspiel: number
  defaultStartHAnnahme: number
  /** Ende der Annahme (Standard = Starthöhe Zuspiel) */
  defaultEndHAnnahme: number
  /** Schlagpunkt des Angriffs (Ende des Zuspiels) */
  defaultHitH: number
  /** Scheitel relativ zum Start */
  defaultApexOffsetZuspiel: number
  defaultApexOffsetAnnahme: number
  defaultLoop: boolean
  defaultSpeed: number
  /** Finger zeichnet Flugbahnen auf leerem Feld (sonst nur Stift und Maus) */
  fingerDraws: boolean
  /**
   * Aufstellungsregeln: 1 Steller + 1 Diagonal oder 2 Steller, 2 MB, 2 Außen; Libero nur im Hinterfeld
   * (ersetzt einen Hinterfeldspieler). Aus: freie Aufstellung.
   */
  lineupRules: boolean
  /** Deckkraft der Flugbahnen in 3D in Prozent (10–100) */
  trajectoryOpacity3d: number
  /** Abprall nach dem Schlag, wenn er den Boden trifft (Animation läuft weiter) */
  bounce: boolean
  /** Dauer des Abpralls in Sekunden */
  bounceDuration: number
  /** Läufer-Abzeichen („L2“) am Bezugs-Steller des Läufersystems zeigen */
  showLaeuferMark: boolean
  /** Art der Zonen auf dem Feldboden (eingeblendet per Button in der Ansicht) */
  zoneStyle: ZoneStyle
  /** 3D: Kamera wackelt kurz bei harten Ballkontakten (Schlag, Block, Aufprall) */
  cameraShake: boolean
  /** Geräusche bei Ballkontakten beim Abspielen */
  sound: boolean
  /** Lautstärke der Geräusche in Prozent (0–100) */
  soundVolume: number
  /** Erscheinungsbild: hell, dunkel oder wie in Windows eingestellt */
  theme: ThemePref
}

/** Erscheinungsbild der App: „system“ folgt der Einstellung von Windows */
export type ThemePref = 'system' | 'light' | 'dark'
export const THEME_PREFS: readonly ThemePref[] = ['system', 'light', 'dark']

/** Zonen: Standard 1–6, erweitert 1–9, erweitert mit Unterzonen A–D */
export type ZoneStyle = 'standard' | 'advanced' | 'letters'
export const ZONE_STYLES: ZoneStyle[] = ['standard', 'advanced', 'letters']

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SCHEMA_VERSION,
  netPreset: 'herren',
  netHeight: 2.43,
  defaultStartHZuspiel: 2.5,
  defaultStartHAnnahme: 0.8,
  defaultEndHAnnahme: 2.5,
  defaultHitH: 3.0,
  defaultApexOffsetZuspiel: 1,
  defaultApexOffsetAnnahme: 5,
  defaultLoop: true,
  defaultSpeed: 1,
  fingerDraws: false,
  lineupRules: true,
  showLaeuferMark: false,
  trajectoryOpacity3d: 70,
  bounce: true,
  bounceDuration: 1.5,
  zoneStyle: 'standard',
  cameraShake: true,
  sound: true,
  soundVolume: 60,
  theme: 'system'
}

/* ---------- Skizze ---------- */

/**
 * Stiftfarben der Skizze. „ink“ ist die Tinte des Erscheinungsbilds: hell auf dunklem Feld, dunkel auf hellem.
 * Gespeichert wird der Name, nicht der Farbwert – so bleibt eine Skizze in beiden Erscheinungsbildern lesbar.
 */
export type SketchColor = 'ink' | 'red' | 'blue' | 'green' | 'yellow'
export const SKETCH_COLORS: readonly SketchColor[] = ['ink', 'red', 'blue', 'green', 'yellow']
export const SKETCH_COLOR_LABELS: Record<SketchColor, string> = { ink: 'Tinte', red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' }
/** Strichstärken in Metern auf dem Feld (der Strich wächst beim Zoomen mit) */
export const SKETCH_WIDTHS = [0.05, 0.09, 0.16] as const
/** Obergrenzen, damit eine Skizze die Datei nicht sprengt */
export const SKETCH_LIMITS = { strokes: 600, points: 1500 } as const

/** Ein Strich der Skizze: Farbe, Breite (m) und die Punkte als flache Liste x0, y0, x1, y1 … (Weltkoordinaten, m) */
export interface SketchStroke {
  color: SketchColor
  width: number
  points: number[]
}

/* ---------- Gespeicherter Spielzug ---------- */

export interface PlaySideDoc extends PlaySide {
  /** Kopie des Teams beim Speichern (falls es später gelöscht wird) */
  teamSnapshot: Team | null
}

export interface PlayDoc {
  schemaVersion: number
  id: string
  /** Kürzel, z. B. „AngrV1“ */
  code: string
  title: string
  createdAt: string
  updatedAt: string
  sides: Record<CourtSide, PlaySideDoc>
  trajectories: Partial<Record<TrajectoryType, Trajectory>>
  schlag?: Attack
  /** Ballkontakte, die an Spieler gekoppelt sind */
  contacts?: Contacts
  /** Freie Skizze auf dem Feld (Skizzenmodus) */
  sketch?: SketchStroke[]
  netPreset: NetPresetId
  netHeight: number
  display: PlayDisplay
  netViewFrom: CourtSide
  /** Drehung der Netzansicht in Grad (−90 … 90) – zusammen mit netViewFrom der Blickwinkel rundum */
  netAngle: number
  netShowPlayers: boolean
}

/** Eintrag der Bibliothek */
export interface PlaySummary {
  id: string
  code: string
  title: string
  updatedAt: string
}
