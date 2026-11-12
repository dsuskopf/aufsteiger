import { DEFAULT_COLOR } from './defaultColor'

/** Farben für Konva und Three (CSS nutzt dieselben Werte in theme.css). */
export const COLORS = {
  bgDeep: '#0c0c0e',
  bg: '#121214',
  surface: '#141417',
  panel: '#1c1c20',
  panelRaised: '#25252b',
  border: '#2e2e35',
  text: '#d8d8de',
  textDim: '#8a8a93',
  courtFloor: '#1f1f25',
  freeZone: '#18181c',
  line: '#6b6b70',
  lineDim: '#4a4a50',
  net: '#9a9aa2',
  /** Standardfarbe (Auswahl, Referenzlinien) – festgelegt in defaultColor.ts */
  accent: DEFAULT_COLOR,
  /** Flugbahnen und Ball nutzen die Standardfarbe */
  trajectory: DEFAULT_COLOR
} as const
