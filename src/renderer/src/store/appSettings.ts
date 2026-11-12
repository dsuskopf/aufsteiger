import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Settings, type Trajectory } from '@shared/types'
import { sanitizeSettings } from '@shared/validate'

interface SettingsState {
  settings: Settings
  loaded: boolean
  load: () => Promise<Settings>
  update: (patch: Partial<Settings>) => void
  reset: () => void
}

let timer: ReturnType<typeof setTimeout> | undefined
let pending = false

/** Dauerhafte Einstellungen (settings.json): Standardhöhen, Netz, Schleife, Tempo, Finger-Zeichnen. */
export const useSettings = create<SettingsState>((set, get) => {
  const persist = () => {
    clearTimeout(timer)
    pending = true
    timer = setTimeout(saveNow, 300)
  }
  const saveNow = () => {
    clearTimeout(timer)
    pending = false
    void window.api.settings.save(get().settings).catch(() => {})
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

/**
 * Standardwerte für eine neue Flugbahn des Typs. Ein Zuspiel, das an einer Annahme hängt,
 * startet auf der echten Schlagpunkthöhe der Annahme – der Scheitel-Offset gilt dann von dort.
 */
export function trajectoryDefaults(type: 'annahme' | 'zuspiel', s: Settings, annahme?: Trajectory) {
  if (type === 'annahme')
    return { startH: s.defaultStartHAnnahme, hitH: s.defaultEndHAnnahme, apexOffset: s.defaultApexOffsetAnnahme }
  return { startH: annahme ? annahme.hitH : s.defaultStartHZuspiel, hitH: s.defaultHitH, apexOffset: s.defaultApexOffsetZuspiel }
}

// Beim Schließen des Fensters ausstehende Änderungen sofort speichern
if (typeof window !== 'undefined')
  window.addEventListener('beforeunload', () => {
    if (pending) {
      clearTimeout(timer)
      pending = false
      window.api.flushSync('settings', useSettings.getState().settings)
    }
  })
