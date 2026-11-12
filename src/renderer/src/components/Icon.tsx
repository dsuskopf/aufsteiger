/**
 * Ein einheitlicher Icon-Satz (Linien-Icons, 1,75 px Strich, currentColor), passend zur Textstärke.
 * Icons ohne Text brauchen immer ein aria-label am Button.
 */
const PATHS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  // Ansicht zurücksetzen: Pfeil gegen den Uhrzeigersinn
  reset: 'M4 12a8 8 0 1 0 2.35-5.65M4 4v4.5h4.5',
  // Feld um 90° drehen: kleines Feld mit Drehpfeil
  rotate: 'M4 10h10v10H4zM4 15h10M12 3.5a7 7 0 0 1 7.5 6.5M21 7.5l-1.5 2.5-2.5-1.5',
  // Seitenansicht spiegeln
  flip: 'M7 7h13l-3-3M17 17H4l3 3',
  close: 'M6 6l12 12M18 6L6 18',
  // Tauschen: große Ansicht ↔ Pop-up
  swap: 'M4 4h9v7H4zM11 13h9v7h-9zM17 5.5a3 3 0 0 1 3 3V10M18.5 8.5 20 10l1.5-1.5M7 18.5a3 3 0 0 1-3-3V14M2.5 15.5 4 14l1.5 1.5',
  // Bearbeiten: Stift
  pencil: 'M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4zM13.5 6.5l4 4',
  check: 'M5 12.5l4.5 4.5L19 7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  // Teams: zwei Personen
  people:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8',
  // Aufstellung: Seitenleiste rechts
  sidebar: 'M4 5h16v14H4zM15 5v14',
  // Grundaufstellung: Raster aus Positionen
  formation: 'M6 8h.01M12 8h.01M18 8h.01M6 16h.01M12 16h.01M18 16h.01',
  // Namen: Namensschild
  name: 'M3 7h18v10H3zM7 11h6M7 14h10',
  // Laufweg: geschwungene Linie mit Pfeil
  run: 'M4 18c4 0 4-8 8-8s4-5 8-5M20 5l-3-.5M20 5l-.8 3',
  // Sprung: Pfeil nach oben über dem Boden
  jump: 'M12 15V4M8 8l4-4 4 4M5 20h14',
  // Zonen: Feld mit Raster
  zones: 'M3 5h18v14H3zM9 5v14M15 5v14M3 12h18',
  net: 'M3 6h18M3 6v12M21 6v12M3 10h18M7 6v6M11 6v6M15 6v6M19 6v6',
  play: 'M7 4.5v15l12.5-7.5z',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  pause: 'M8 5v14M16 5v14',
  loop: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
  pointer: 'M5 3l6 16 2.2-6.8L20 10z',
  // Flugbahn zeichnen: Bogen mit Punkt
  arc: 'M3 19C6 7 14 4 21 12M21 12l-1-3.5M21 12l-3.5 1',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
  library: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM20 17v5H6.5A2.5 2.5 0 0 1 4 19.5',
  share: 'M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  newfile: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M12 12v6M9 15h6',
  doc: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  video: 'M3 6h12v12H3zM15 10l6-4v12l-6-4',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const bold = name === 'formation'
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={bold ? 3.2 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
