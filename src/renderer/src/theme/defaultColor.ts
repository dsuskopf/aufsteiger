import { hexToRgb, luminance, mixWhite, rgbToHex, textOn } from '@shared/teamColors'

/**
 * ===================================================================================
 *  STANDARDFARBE DER APP  –  aktuell „Weiß“ #ffffff
 * ===================================================================================
 *  Die einzige Stelle, an der die Standardfarbe festgelegt wird. Alles andere leitet sich ab:
 *   - CSS-Variablen --accent, --accent-hover, --accent-ring, --accent-text, --on-accent
 *     (werden beim Start von applyDefaultColor() gesetzt, siehe main.tsx)
 *   - COLORS.accent für Konva/Three (2D- und 3D-Ansichten)
 *   - Flugbahnen, Ball, Referenzlinien, Auswahl, Hauptaktionen („Fertig“)
 *  Hover-Ton und Schriftfarbe auf der Farbe werden automatisch berechnet.
 *  Zum Ändern nur DEFAULT_COLOR anpassen.
 *  Teamfarben sind davon getrennt (siehe src/shared/teamColors.ts).
 * ===================================================================================
 */
export const DEFAULT_COLOR = '#ffffff'

/** Hover-Ton: aufhellen – bei sehr hellen Farben (z. B. Weiß) stattdessen leicht abdunkeln, damit er sichtbar bleibt. */
function hoverTone(hex: string): string {
  if (luminance(hex) < 0.7) return mixWhite(hex, 0.25)
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r * 0.86, g * 0.86, b * 0.86)
}

/** Abgeleitete Töne der Standardfarbe */
export const DEFAULT_COLOR_TONES = {
  base: DEFAULT_COLOR,
  hover: hoverTone(DEFAULT_COLOR),
  /** Schrift auf der Standardfarbe (beste Lesbarkeit) */
  on: textOn(DEFAULT_COLOR)
} as const

/** Schreibt die Standardfarbe in die CSS-Variablen, damit Stylesheet und Ansichten dieselbe Farbe nutzen. */
export function applyDefaultColor(root: HTMLElement = document.documentElement): void {
  const t = DEFAULT_COLOR_TONES
  root.style.setProperty('--accent', t.base)
  root.style.setProperty('--accent-hover', t.hover)
  root.style.setProperty('--accent-ring', t.base)
  root.style.setProperty('--accent-text', t.base)
  root.style.setProperty('--on-accent', t.on)
}
