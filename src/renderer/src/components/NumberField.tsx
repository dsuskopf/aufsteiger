import { useEffect, useRef, useState } from 'react'

/** Zahl mit Komma, feste Nachkommastellen */
export const formatNumber = (v: number, digits: number) => v.toFixed(digits).replace('.', ',')

/** Eingetippten Wert lesen (Komma oder Punkt), auf den erlaubten Bereich klemmen; null bei Unsinn */
export function parseClamped(text: string, min: number, max: number): number | null {
  const n = Number(text.trim().replace(',', '.'))
  if (text.trim() === '' || !Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, n))
}

/**
 * Kleines Eingabefeld für Zahlenwerte neben Reglern: Wert eintippen, mit Enter oder beim Verlassen übernehmen.
 * Zu hohe oder zu niedrige Werte werden auf das Maximum bzw. Minimum gesetzt; Esc verwirft die Eingabe.
 */
export function NumberField(props: {
  value: number
  min: number
  max: number
  digits?: number
  unit?: string
  label: string
  onCommit: (v: number) => void
  /** Anzeige statt der Zahl, solange das Feld nicht bearbeitet wird (z. B. „Boden“) */
  display?: string
}) {
  const { value, min, max, digits = 2, unit, label, onCommit, display } = props
  const [draft, setDraft] = useState<string | null>(null)
  // Aktueller Entwurf auch für Ereignisse aus älteren Renders (Esc → Verlassen darf nichts übernehmen)
  const draftRef = useRef<string | null>(null)
  const set = (d: string | null) => {
    draftRef.current = d
    setDraft(d)
  }
  useEffect(() => {
    if (document.activeElement?.classList.contains('value-input')) return
    set(null)
  }, [value])
  const commit = () => {
    const d = draftRef.current
    if (d === null) return
    const n = parseClamped(d, min, max)
    set(null)
    if (n !== null) onCommit(Math.round(n * 10 ** digits) / 10 ** digits)
  }
  return (
    <span className="number-field">
      <input
        className="field value-input"
        inputMode="decimal"
        aria-label={`${label} (${formatNumber(min, digits)}–${formatNumber(max, digits)}${unit ? ' ' + unit : ''})`}
        value={draft ?? display ?? formatNumber(value, digits)}
        onFocus={(e) => {
          set(formatNumber(value, digits))
          requestAnimationFrame(() => e.target.select())
        }}
        onChange={(e) => set(e.target.value.replace(/[^0-9.,-]/g, '').slice(0, 8))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit()
            ;(e.target as HTMLInputElement).blur()
          }
          if (e.key === 'Escape') {
            e.stopPropagation()
            set(null)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
      {unit && <span className="unit">{unit}</span>}
    </span>
  )
}
