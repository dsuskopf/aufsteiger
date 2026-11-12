import { create } from 'zustand'
import type { CourtSide, NetPresetId } from '@shared/types'
import type { PxRect } from '@renderer/core/geometry/transform'
import { NET_PRESETS, clampNetHeight, presetForHeight } from '@renderer/core/geometry/court'

/** 2D = eine große Ansicht + die andere als Pop-up (Bild-im-Bild); 3D = 3D-Ansicht */
export type ViewMode = '2d' | '3d'
/** Welche 2D-Ansicht groß ist; die andere erscheint im Pop-up */
export type Main2D = 'top' | 'net'

/** Werkzeug der Draufsicht: auswählen/ziehen oder eine Flugbahn zeichnen */
export type Tool = 'select' | 'annahme' | 'zuspiel'

interface UiState {
  tool: Tool
  setTool: (t: Tool) => void
  /** Netzhöhe in der zweiten Toolbar-Reihe ausgeklappt */
  netBarOpen: boolean
  setNetBarOpen: (open: boolean) => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  /** Offenes Fenster: Bibliothek, Speichern-Dialog, Export */
  dialog: 'library' | 'save' | 'export' | null
  setDialog: (d: 'library' | 'save' | 'export' | null) => void
  viewMode: ViewMode
  main2D: Main2D
  /** Große Ansicht und Pop-up tauschen */
  swapMain2D: () => void
  /** Netzansicht: von welcher Feldseite man aufs Netz schaut */
  netViewFrom: CourtSide
  /** Netzansicht: Spieler einblenden */
  netShowPlayers: boolean
  toggleNetViewFrom: () => void
  setNetShowPlayers: (show: boolean) => void
  /** 2D: Pop-up eingeklappt (die große Ansicht nutzt dann die volle Fläche) */
  netPipCollapsed: boolean
  setNetPipCollapsed: (collapsed: boolean) => void
  /** Lage und Größe des Pop-ups (px im Ansichtsbereich); null = Standard unten rechts */
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

/** Anzeige-Zustand der Oberfläche (nicht dauerhaft gespeichert; dauerhafte Einstellungen: appSettings.ts). */
export const useUi = create<UiState>((set) => ({
  tool: 'select',
  setTool: (tool) => set({ tool }),
  netBarOpen: true,
  setNetBarOpen: (netBarOpen) => set({ netBarOpen }),
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  dialog: null,
  setDialog: (dialog) => set({ dialog }),
  viewMode: '2d',
  main2D: 'top',
  swapMain2D: () => set((s) => ({ main2D: s.main2D === 'top' ? 'net' : 'top' })),
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
