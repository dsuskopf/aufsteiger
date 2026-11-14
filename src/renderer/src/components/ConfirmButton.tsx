import { useEffect, useState } from 'react'
import { Icon, type IconName } from './Icon'

interface Props {
  /** Beschriftung bzw. bei Icon-Buttons die Bedienhilfe-Beschriftung */
  label: string
  confirmLabel: string
  /** Optional: nur Icon zeigen, bis nachgefragt wird */
  icon?: IconName
  onConfirm: () => void
  disabled?: boolean
  /** Icon und Beschriftung zusammen zeigen (kleiner, unauffälliger Button) */
  text?: boolean
}

/**
 * Zweistufiger Lösch-Button (Warnung ohne Dialog): erstes Tippen fragt nach, zweites löscht;
 * nach 3 s ohne Bestätigung zurück (= Abbrechen).
 */
export function ConfirmButton({ label, confirmLabel, icon, onConfirm, disabled = false, text = false }: Props) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  const iconOnly = icon && !armed && !text
  return (
    <button
      className={`danger ${armed ? 'armed' : ''} ${iconOnly ? 'icon-only plain' : ''} ${text ? 'small' : ''} ${text && !armed ? 'plain' : ''}`}
      title={label}
      disabled={disabled}
      aria-label={armed ? confirmLabel : label}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
      onBlur={() => setArmed(false)}
    >
      {iconOnly ? (
        <Icon name={icon} />
      ) : armed ? (
        confirmLabel
      ) : (
        <>
          {text && icon && <Icon name={icon} size={16} />}
          {label}
        </>
      )}
    </button>
  )
}
