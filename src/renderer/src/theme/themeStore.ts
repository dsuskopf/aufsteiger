import { create } from 'zustand'
import type { ThemePref } from '@shared/types'
import { setPalette, type ThemeName } from './colors'
import { applyDefaultColor } from './defaultColor'

/**
 * Erscheinungsbild: hell, dunkel oder wie in Windows eingestellt.
 * applyTheme() setzt alles auf einmal: data-theme am <html> (CSS-Variablen in theme.css), die Palette für
 * Konva und Three, die Standardfarbe und das Fenster selbst (Titelleiste, Hintergrund beim Vergrößern).
 * Die Ansichten zeichnen mit festen Farbwerten und werden beim Wechsel neu aufgebaut – App.tsx hängt dafür
 * `resolved` als key an die Ansichten.
 */
interface ThemeState {
  pref: ThemePref
  resolved: ThemeName
}

const CACHE_KEY = 'vbp-theme'
const systemDark = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
const resolve = (pref: ThemePref): ThemeName => (pref === 'system' ? (systemDark && !systemDark.matches ? 'light' : 'dark') : pref)

/** Zuletzt gewählte Einstellung – damit die App schon vor dem Laden der Einstellungen richtig startet (kein Aufblitzen) */
function cachedPref(): ThemePref {
  try {
    const v = localStorage.getItem(CACHE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export const useTheme = create<ThemeState>(() => {
  const pref = cachedPref()
  return { pref, resolved: resolve(pref) }
})

function paint(resolved: ThemeName): void {
  setPalette(resolved)
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = resolved
  applyDefaultColor(resolved)
}

export function applyTheme(pref: ThemePref): void {
  const resolved = resolve(pref)
  paint(resolved)
  try {
    localStorage.setItem(CACHE_KEY, pref)
  } catch {
    // ohne Zwischenspeicher startet die App beim nächsten Mal kurz im System-Erscheinungsbild
  }
  // Fenster: Hintergrund und Titelleiste passend (fehlt die Brücke, z. B. in Tests, bleibt es beim Inhalt)
  window.api?.theme?.set(pref, resolved)
  const s = useTheme.getState()
  if (s.pref !== pref || s.resolved !== resolved) useTheme.setState({ pref, resolved })
}

// Folgt Windows, solange „System“ gewählt ist
systemDark?.addEventListener('change', () => {
  if (useTheme.getState().pref === 'system') applyTheme('system')
})

// Vor dem ersten Rendern
paint(useTheme.getState().resolved)
