import { useEffect, useState } from 'react'

interface Props {
  label: string
  confirmLabel: string
  title?: string
  onConfirm: () => void
}

/**
 * Zweistufiger Lösch-Button (statt eines Bestätigungsdialogs):
 * erstes Tippen fragt nach, zweites Tippen löscht; nach 3 s ohne Bestätigung zurück.
 */
export function ConfirmButton({ label, confirmLabel, title, onConfirm }: Props) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      className={`danger ${armed ? 'armed' : ''}`}
      title={title ?? label}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
