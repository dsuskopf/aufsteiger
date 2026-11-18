import { create } from 'zustand'
import type { LastUpdate, UpdateStatus } from '@shared/update'
import { usePlay } from './playStore'
import { saveCurrent } from './playDocs'

/**
 * Update der installierten App aus dem Projektordner.
 * Ablauf: prüfen → (Dialog) → neue Version bauen → Spielzug sichern → App beendet sich, Austausch, Neustart.
 */
export type UpdatePhase = 'idle' | 'checking' | 'building' | 'restarting' | 'error'

interface UpdateStore {
  status: UpdateStatus | null
  phase: UpdatePhase
  error: string | null
  /** Dialog offen */
  open: boolean
  /** Meldung zum Update vor diesem Start */
  last: LastUpdate | null
  check: () => Promise<UpdateStatus | null>
  /** Beim Start: Ergebnis des letzten Updates zeigen, sonst nachsehen und ggf. vorschlagen */
  startup: () => Promise<void>
  /** Dialog öffnen und dabei neu prüfen (Button in Einstellungen/Werkzeugleiste) */
  show: () => void
  close: () => void
  run: () => Promise<void>
}

export const useUpdate = create<UpdateStore>((set, get) => ({
  status: null,
  phase: 'idle',
  error: null,
  open: false,
  last: null,

  check: async () => {
    if (!window.api.update) return null
    set({ phase: 'checking' })
    try {
      const status = await window.api.update.check()
      set({ status, phase: 'idle' })
      return status
    } catch {
      set({ phase: 'idle' })
      return null
    }
  },

  startup: async () => {
    if (!window.api.update) return
    const last = await window.api.update.last().catch(() => null)
    if (last) {
      set({ last, open: true })
      void get().check()
      return
    }
    const status = await get().check()
    if (status?.state === 'available') set({ open: true })
  },

  show: () => {
    set({ open: true, last: null, error: null })
    if (get().phase === 'idle' || get().phase === 'error') {
      set({ phase: 'idle' })
      void get().check()
    }
  },

  close: () => {
    const { phase } = get()
    if (phase === 'building' || phase === 'restarting') return
    set({ open: false, last: null, error: null, phase: 'idle' })
  },

  run: async () => {
    set({ phase: 'building', error: null, last: null })
    const res = await window.api.update.prepare().catch((e: unknown) => ({ ok: false, message: String(e) }))
    if (!res.ok) {
      set({ phase: 'error', error: res.message ?? 'Der Build ist fehlgeschlagen.' })
      return
    }
    // Benannten Spielzug mit ungespeicherten Änderungen vor dem Neustart sichern
    const { current, dirty } = usePlay.getState()
    if (dirty && current) {
      try {
        await saveCurrent(current.code, current.title, false)
      } catch {
        set({ phase: 'error', error: 'Der Spielzug konnte vor dem Neustart nicht gespeichert werden. Bitte speichern und noch einmal versuchen.' })
        return
      }
    }
    set({ phase: 'restarting' })
    const ok = await window.api.update.apply().catch(() => false)
    if (!ok) set({ phase: 'error', error: 'Die neue Version ist nicht mehr da. Bitte noch einmal versuchen.' })
  }
}))
