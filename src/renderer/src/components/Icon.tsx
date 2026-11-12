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
  net: 'M3 6h18M3 6v12M21 6v12M3 10h18M7 6v6M11 6v6M15 6v6M19 6v6'
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
