import { hexToRgb, luminance, mixWhite, rgbToHex, textOn } from '@shared/teamColors'
import { PALETTES, type ThemeName } from './colors'

/**
 * Standardfarbe der App: Auswahl, Hauptaktionen („Fertig“), Flugbahnen, Referenzlinien.
 * Sie ist die Tinte des Erscheinungsbilds – Weiß im dunklen, fast Schwarz im hellen – und steht als
 * `accent` in den Paletten (colors.ts). Hier werden daraus die CSS-Variablen --accent, --accent-hover,
 * --accent-ring, --accent-text und --on-accent. Teamfarben sind davon getrennt (src/shared/teamColors.ts).
 */

/** Hover-Ton: dunkle Farben aufhellen, sehr helle (z. B. Weiß) leicht abdunkeln, damit er sichtbar bleibt. */
function hoverTone(hex: string): string {
  if (luminance(hex) < 0.7) return mixWhite(hex, 0.25)
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r * 0.86, g * 0.86, b * 0.86)
}

/** Schreibt die Standardfarbe des Erscheinungsbilds in die CSS-Variablen. */
export function applyDefaultColor(theme: ThemeName, root: HTMLElement = document.documentElement): void {
  const base = PALETTES[theme].accent
  root.style.setProperty('--accent', base)
  root.style.setProperty('--accent-hover', hoverTone(base))
  root.style.setProperty('--accent-ring', base)
  root.style.setProperty('--accent-text', base)
  root.style.setProperty('--on-accent', textOn(base))
}
