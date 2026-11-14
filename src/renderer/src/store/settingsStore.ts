import { create } from 'zustand'
import type { CourtSide, NetPresetId } from '@shared/types'
import type { PxRect } from '@renderer/core/geometry/transform'
import { NET_PRESETS, clampNetHeight, presetForHeight } from '@renderer/core/geometry/court'

/** 2D = eine große Ansicht + die andere als Pop-up (Bild-im-Bild); 3D = 3D-Ansicht */
export type ViewMode = '2d' | '3d'
/** Welche 2D-Ansicht groß ist; die andere erscheint im Pop-up */
export type Main2D = 'top' | 'net'

/** Werkzeug der Draufsicht: auswählen/ziehen oder eine Flugbahn zeichnen */
export type Tool = 'select' | 'annahme' | 'zuspiel' | 'schlag' | 'laufweg'

export type Dialog = 'library' | 'save' | 'saveAs' | 'export'
/** Reiter der Seitenleiste: Ablauf des Spielzugs oder Aufstellung der Teams */
export type SidebarTab = 'play' | 'lineup'

interface UiState {
  /** Seitenleiste links (Ablauf, Aufstellung) eingeblendet */
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  sidebarTab: SidebarTab
  /** Reiter wählen (blendet die Seitenleiste ein) */
  showSidebar: (tab: SidebarTab) => void
  /** Zonen auf dem Feldboden einblenden (welche Art: Einstellungen → Zonen) */
  showZones: boolean
  setShowZones: (show: boolean) => void
  /** Namen der Spieler einblenden (nur wenn ein Name eingetragen ist) */
  showNames: boolean
  setShowNames: (show: boolean) => void
  /** 3D: Die Kamera folgt dem Ball */
  followBall: boolean
  setFollowBall: (follow: boolean) => void
  tool: Tool
  setTool: (t: Tool) => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  /** Offenes Fenster: Bibliothek, Speichern-Dialog (auch „als Kopie“), Export */
  dialog: Dialog | null
  setDialog: (d: Dialog | null) => void
  viewMode: ViewMode
  main2D: Main2D
  /** Große Ansicht und Pop-up tauschen */
  swapMain2D: () => void
  /** Netzansicht: von welcher Feldseite man aufs Netz schaut */
  netViewFrom: CourtSide
  /** Netzansicht: Spieler einblenden */
  netShowPlayers: boolean
  toggleNetViewFrom: () => void
  /** Drehung der Netzansicht um die senkrechte Achse in Grad (−90 … 90), 0 = frontal */
  netAngle: number
  setNetAngle: (deg: number) => void
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
  teamsOpen: boolean
  setTeamsOpen: (open: boolean) => void
  rotateTop: () => void
  setViewMode: (m: ViewMode) => void
  setNetPreset: (p: NetPresetId) => void
  setNetHeight: (h: number) => void
}

/** Anzeige-Zustand der Oberfläche (nicht dauerhaft gespeichert; dauerhafte Einstellungen: appSettings.ts). */
export const useUi = create<UiState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  sidebarTab: 'play',
  showSidebar: (sidebarTab) => set({ sidebarTab, sidebarOpen: true }),
  showZones: false,
  setShowZones: (showZones) => set({ showZones }),
  showNames: false,
  setShowNames: (showNames) => set({ showNames }),
  followBall: false,
  setFollowBall: (followBall) => set({ followBall }),
  tool: 'select',
  setTool: (tool) => set({ tool }),
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
  netAngle: 0,
  setNetAngle: (deg) => set({ netAngle: Math.max(-90, Math.min(90, Number.isFinite(deg) ? deg : 0)) }),
  toggleNetViewFrom: () => set((s) => ({ netViewFrom: s.netViewFrom === 'A' ? 'B' : 'A' })),
  setNetShowPlayers: (netShowPlayers) => set({ netShowPlayers }),
  // Pop-up (Netzansicht) startet eingeklappt
  netPipCollapsed: true,
  setNetPipCollapsed: (netPipCollapsed) => set({ netPipCollapsed }),
  netPipRect: null,
  setNetPipRect: (netPipRect) => set({ netPipRect }),
  netPreset: 'herren',
  netHeight: NET_PRESETS.herren.height,
  topTurns: 0,
  teamsOpen: false,
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
