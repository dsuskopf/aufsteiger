import { create } from 'zustand'
import type { CourtSide, NetPresetId } from '@shared/types'
import type { PxRect } from '@renderer/core/geometry/transform'
import { NET_PRESETS, clampNetHeight, presetForHeight } from '@renderer/core/geometry/court'

/** split = Draufsicht (groß) + Netzansicht (klein) */
export type ViewMode = 'split' | 'top' | 'net' | '3d'

interface UiState {
  viewMode: ViewMode
  /** Netzansicht: von welcher Feldseite man aufs Netz schaut */
  netViewFrom: CourtSide
  /** Netzansicht: Spieler einblenden */
  netShowPlayers: boolean
  toggleNetViewFrom: () => void
  setNetShowPlayers: (show: boolean) => void
  /** „Beide“: Netz-Bild-im-Bild eingeklappt (Draufsicht nutzt dann die volle Fläche) */
  netPipCollapsed: boolean
  setNetPipCollapsed: (collapsed: boolean) => void
  /** Lage und Größe des Netz-Bild-im-Bild (px im Ansichtsbereich); null = Standard unten rechts */
  netPipRect: PxRect | null
  setNetPipRect: (r: PxRect | null) => void
  netPreset: NetPresetId
  netHeight: number
  /** Zusätzliche Drehung der Draufsicht in 90-Grad-Schritten (zur automatischen Ausrichtung). */
  topTurns: number
  lineupOpen: boolean
  teamsOpen: boolean
  setLineupOpen: (open: boolean) => void
  setTeamsOpen: (open: boolean) => void
  rotateTop: () => void
  setViewMode: (m: ViewMode) => void
  setNetPreset: (p: NetPresetId) => void
  setNetHeight: (h: number) => void
}

/** Phase 1: Anzeige- und Netz-Einstellungen. Persistenz folgt mit dem Settings-IPC. */
export const useUi = create<UiState>((set) => ({
  viewMode: 'split',
  netViewFrom: 'A',
  // Spieler in der Netzansicht standardmäßig ausgeblendet
  netShowPlayers: false,
  toggleNetViewFrom: () => set((s) => ({ netViewFrom: s.netViewFrom === 'A' ? 'B' : 'A' })),
  setNetShowPlayers: (netShowPlayers) => set({ netShowPlayers }),
  netPipCollapsed: false,
  setNetPipCollapsed: (netPipCollapsed) => set({ netPipCollapsed }),
  netPipRect: null,
  setNetPipRect: (netPipRect) => set({ netPipRect }),
  netPreset: 'herren',
  netHeight: NET_PRESETS.herren.height,
  topTurns: 0,
  lineupOpen: false,
  teamsOpen: false,
  setLineupOpen: (lineupOpen) => set({ lineupOpen }),
  setTeamsOpen: (teamsOpen) => set({ teamsOpen }),
  // Ohne Modulo: der Winkel wächst weiter, damit die Animation immer in dieselbe Richtung dreht
  rotateTop: () => set((s) => ({ topTurns: s.topTurns + 1 })),
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
