import { create } from 'zustand'
import type { NetPresetId } from '@shared/types'
import { NET_PRESETS, clampNetHeight, presetForHeight } from '@renderer/core/geometry/court'

export type ViewMode = 'split' | 'top' | 'side' | '3d'

interface UiState {
  viewMode: ViewMode
  netPreset: NetPresetId
  netHeight: number
  /** Zusätzliche Drehung der Draufsicht in 90-Grad-Schritten (zur automatischen Ausrichtung). */
  topTurns: number
  /** Seitenansicht von der anderen Seite betrachten (horizontal gedreht). */
  sideMirrored: boolean
  rotateTop: () => void
  toggleSideMirror: () => void
  setViewMode: (m: ViewMode) => void
  setNetPreset: (p: NetPresetId) => void
  setNetHeight: (h: number) => void
}

/** Phase 1: Anzeige- und Netz-Einstellungen. Persistenz folgt mit dem Settings-IPC. */
export const useUi = create<UiState>((set) => ({
  viewMode: 'split',
  netPreset: 'herren',
  netHeight: NET_PRESETS.herren.height,
  topTurns: 0,
  sideMirrored: false,
  // Ohne Modulo: der Winkel wächst weiter, damit die Animation immer in dieselbe Richtung dreht
  rotateTop: () => set((s) => ({ topTurns: s.topTurns + 1 })),
  toggleSideMirror: () => set((s) => ({ sideMirrored: !s.sideMirrored })),
  setViewMode: (viewMode) => set({ viewMode }),
  setNetPreset: (netPreset) =>
    set((s) => ({
      netPreset,
      netHeight: netPreset === 'custom' ? s.netHeight : NET_PRESETS[netPreset].height
    })),
  setNetHeight: (h) => {
    const netHeight = Math.round(clampNetHeight(h) * 100) / 100
    set({ netHeight, netPreset: presetForHeight(netHeight) })
  }
}))
