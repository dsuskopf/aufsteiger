import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { hexToHsv, hexToRgb, hsvToHex, parseHexInput, rgbToHex } from '@shared/teamColors'

interface Props {
  label: string
  value: string
  onChange: (hex: string) => void
  onClose: () => void
}

/**
 * Eigener Farbwähler als Pop-up: Fläche für Sättigung/Helligkeit, Farbton-Regler, Hex-Code und RGB.
 * Änderungen gelten sofort; „Fertig“, Esc oder ein Tippen daneben schließt.
 * Bedienbar mit Finger, Stift und Maus (Pointer Events, touch-action: none).
 */
export function ColorPopover({ label, value, onChange, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  // HSV lokal halten, damit der Farbton bei Grau/Schwarz nicht verloren geht
  const [hsv, setHsv] = useState(() => hexToHsv(value))
  const [draft, setDraft] = useState(value)
  const lastEmitted = useRef(value)

  // Von außen geänderte Farbe übernehmen (nicht die eigene)
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setHsv(hexToHsv(value))
      lastEmitted.current = value
    }
    setDraft(value)
  }, [value])

  const emit = (next: { h: number; s: number; v: number }) => {
    setHsv(next)
    const hex = hsvToHex(next.h, next.s, next.v)
    lastEmitted.current = hex
    setDraft(hex)
    onChange(hex)
  }

  // Tippen außerhalb schließt
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const root = rootRef.current
      if (!root || root.contains(e.target as Node)) return
      // Der auslösende Kreis toggelt selbst
      if ((e.target as HTMLElement).closest?.('[data-color-trigger]')) return
      onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [onClose])

  const dragArea = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const update = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect()
      const s = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
      const v = 1 - Math.min(1, Math.max(0, (clientY - r.top) / r.height))
      emit({ h: hsv.h, s, v })
    }
    el.setPointerCapture(e.pointerId)
    update(e.clientX, e.clientY)
    const move = (ev: PointerEvent) => update(ev.clientX, ev.clientY)
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  /** Exakte Farbe übernehmen (aus Hex- oder RGB-Eingabe) */
  const setExact = (hex: string) => {
    setHsv(hexToHsv(hex))
    lastEmitted.current = hex
    setDraft(hex)
    onChange(hex)
  }

  const parsed = parseHexInput(draft)
  const commitHex = () => {
    if (parsed) setExact(parsed)
    else setDraft(value)
  }
  const channels = hexToRgb(value)

  const pureHue = hsvToHex(hsv.h, 1, 1)
  return (
    <div
      ref={rootRef}
      className="color-popover"
      role="dialog"
      aria-label={`${label}farbe wählen`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <div
        className="sv-area"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHue})` }}
        onPointerDown={dragArea}
        role="slider"
        aria-label="Sättigung und Helligkeit"
        aria-valuetext={value}
      >
        <span
          className="sv-thumb"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: value }}
        />
      </div>
      <input
        className="hue"
        type="range"
        min={0}
        max={359}
        step={1}
        aria-label="Farbton"
        value={Math.round(hsv.h)}
        onChange={(e) => emit({ ...hsv, h: Number(e.target.value) })}
      />
      <div className="row">
        <span className="preview" style={{ background: value }} aria-hidden="true" />
        <input
          className={`field hex grow ${parsed ? '' : 'invalid'}`}
          aria-label={`${label}farbe als Hex-Code`}
          title="Hex-Code, z. B. #1f4e79"
          spellCheck={false}
          maxLength={7}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitHex()
          }}
        />
        <button className="prominent" onClick={onClose}>
          Fertig
        </button>
      </div>
      <div className="rgb-row" role="group" aria-label="RGB">
        {(['R', 'G', 'B'] as const).map((ch, i) => (
          <ChannelInput
            key={ch}
            label={ch}
            value={channels[i]}
            onCommit={(n) => {
              const next = [...channels] as [number, number, number]
              next[i] = n
              setExact(rgbToHex(...next))
            }}
          />
        ))}
      </div>
    </div>
  )
}

/** Ein RGB-Kanal (0–255): Entwurf lokal, übernommen bei Enter oder Verlassen. */
function ChannelInput({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const n = Number(draft)
  const valid = draft.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 255
  const commit = () => {
    if (valid) onCommit(n)
    else setDraft(String(value))
  }
  return (
    <label className="channel">
      <span>{label}</span>
      <input
        className={`field ${valid ? '' : 'invalid'}`}
        inputMode="numeric"
        aria-label={`${label}-Wert (0–255)`}
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </label>
  )
}
