import type { SketchColor } from '@shared/types'

/** Aufgelöstes Erscheinungsbild (nach „System“) */
export type ThemeName = 'dark' | 'light'

/** Farben für Konva und Three. Die Oberfläche selbst nutzt die CSS-Variablen in theme.css. */
export interface Palette {
  /** Hintergrund hinter dem Feld (3D-Himmel, Flächen von Abzeichen und Griffen) */
  bgDeep: string
  text: string
  textDim: string
  /** Schein hinter Text auf dem Feld, damit er über Linien lesbar bleibt */
  halo: string
  courtFloor: string
  freeZone: string
  line: string
  lineDim: string
  /** Netz in der Draufsicht */
  net: string
  /** Netzgewebe, Netzbänder, Pfosten und Abspannseile (Netzansicht und 3D) */
  netMesh: string
  netTape: string
  netBand: string
  post: string
  rope: string
  /** Helle Streifen der Antenne (die anderen sind rot) */
  antenna: string
  /** 3D: Himmels- und Bodenlicht */
  skyLight: string
  groundLight: string
  /** Standardfarbe: Auswahl, Hauptaktion, Referenzlinien */
  accent: string
  /** Flugbahnen nutzen die Standardfarbe (der Ball hat eigene Farben, siehe BALL_COLORS) */
  trajectory: string
  /** Stiftfarben der Skizze */
  sketch: Record<SketchColor, string>
}

export const PALETTES: Record<ThemeName, Palette> = {
  dark: {
    bgDeep: '#0c0c0e',
    text: '#d8d8de',
    textDim: '#8a8a93',
    halo: '#000000',
    courtFloor: '#1f1f25',
    freeZone: '#18181c',
    line: '#6b6b70',
    lineDim: '#4a4a50',
    net: '#9a9aa2',
    netMesh: '#c8c8d0',
    netTape: '#e6e6ea',
    netBand: '#c9c9cf',
    post: '#55555c',
    rope: '#6a6a72',
    antenna: '#e6e6ea',
    skyLight: '#c4c4ca',
    groundLight: '#0c0c0e',
    accent: '#ffffff',
    trajectory: '#ffffff',
    sketch: { ink: '#f2f2f5', red: '#ff6b6b', blue: '#5aa9ff', green: '#5fd38d', yellow: '#f5d04a' }
  },
  light: {
    bgDeep: '#f1f1f4',
    text: '#1b1b1f',
    textDim: '#6a6a73',
    halo: '#ffffff',
    courtFloor: '#fbfbfc',
    freeZone: '#e8e8ed',
    line: '#4f4f57',
    lineDim: '#9d9da6',
    net: '#33333a',
    netMesh: '#3d3d45',
    netTape: '#2b2b31',
    netBand: '#4a4a52',
    post: '#7b7b84',
    rope: '#8d8d96',
    antenna: '#d3d3da',
    skyLight: '#ffffff',
    groundLight: '#b9b9c2',
    accent: '#1b1b1f',
    trajectory: '#1b1b1f',
    sketch: { ink: '#1b1b1f', red: '#d5303a', blue: '#1f6fd6', green: '#1f8a4c', yellow: '#b98500' }
  }
}

/**
 * Die aktuelle Palette. Wird beim Wechsel des Erscheinungsbilds von setPalette() überschrieben;
 * die Ansichten lesen sie beim Zeichnen und werden danach neu aufgebaut (siehe themeStore.ts).
 */
export const COLORS: Palette = { ...PALETTES.dark }

export function setPalette(name: ThemeName): void {
  Object.assign(COLORS, PALETTES[name])
}

/** Ball: klassischer Hallenball in Gelb/Blau (3D-Panels und 2D-Markierung) */
export const BALL_COLORS = {
  yellow: '#f2c418',
  blue: '#1f4fb4',
  seam: '#2a2a2e'
} as const
