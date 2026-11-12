import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types'
import { sanitizeSettings } from '@shared/validate'

interface SettingsState {
  settings: Settings
  loaded: boolean
  load: () => Promise<Settings>
  update: (patch: Partial<Settings>) => void
  reset: () => void
}

let timer: ReturnType<typeof setTimeout> | undefined

/** Dauerhafte Einstellungen (settings.json): Standardhöhen, Netz, Schleife, Tempo, Finger-Zeichnen. */
export const useSettings = create<SettingsState>((set, get) => {
  const persist = () => {
    clearTimeout(timer)
    timer = setTimeout(() => void window.api.settings.save(get().settings).catch(() => {}), 300)
  }
  return {
    settings: DEFAULT_SETTINGS,
    loaded: false,
    load: async () => {
      const s = sanitizeSettings(await window.api.settings.load().catch(() => null))
      set({ settings: s, loaded: true })
      return s
    },
    update: (patch) => {
      set({ settings: sanitizeSettings({ ...get().settings, ...patch }) })
      persist()
    },
    reset: () => {
      set({ settings: { ...DEFAULT_SETTINGS } })
      persist()
    }
  }
})

/** Standardwerte für eine neue Flugbahn des Typs */
export function trajectoryDefaults(type: 'annahme' | 'zuspiel', s: Settings = useSettings.getState().settings) {
  return type === 'annahme'
    ? { startH: s.defaultStartHAnnahme, hitH: s.defaultEndHAnnahme, apexOffset: s.defaultApexOffsetAnnahme }
    : { startH: s.defaultStartHZuspiel, hitH: s.defaultHitH, apexOffset: s.defaultApexOffsetZuspiel }
}
