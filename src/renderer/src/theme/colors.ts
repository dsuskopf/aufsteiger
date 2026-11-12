/** Farben für Konva und Three (CSS nutzt dieselben Werte in theme.css). */
export const COLORS = {
  bgDeep: '#0b0b0d',
  bg: '#121214',
  panel: '#1c1c20',
  panelRaised: '#25252b',
  border: '#2e2e35',
  text: '#d8d8de',
  textDim: '#8a8a93',
  courtFloor: '#18181c',
  freeZone: '#141417',
  line: '#6b6b70',
  lineDim: '#4a4a50',
  net: '#9a9aa2',
  violet: '#5b2a86',
  violetLight: '#7e4bb0',
  violetGlow: 'rgba(126, 75, 176, 0.35)'
} as const

/** Trikotfarben je Seite; der Libero trägt ein abweichendes Trikot (heller). */
export const TEAM_COLORS = {
  A: { fill: '#3d1f5c', libero: '#6a4a94', stroke: '#8a5cc2', text: '#f1eaf8' },
  B: { fill: '#26303c', libero: '#4a5a70', stroke: '#8796ab', text: '#e6ebf1' }
} as const
