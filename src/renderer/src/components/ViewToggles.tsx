import { useSettings } from '@renderer/store/appSettings'
import { useUi } from '@renderer/store/settingsStore'
import { Icon } from './Icon'

const STYLE_LABEL = { standard: '1–6', advanced: '1–9', letters: '1–9 mit A–D' } as const

/** 2D: große Ansicht wechseln (Draufsicht ↔ Netzansicht); die andere erscheint im Pop-up */
export function ViewSwapButton() {
  const main = useUi((s) => s.main2D)
  const swap = useUi((s) => s.swapMain2D)
  const title = main === 'top' ? 'Zur Netzansicht wechseln (Draufsicht ins Pop-up)' : 'Zur Draufsicht wechseln (Netzansicht ins Pop-up)'
  return (
    <button title={title} aria-label={title} onClick={swap}>
      <Icon name="swap" />
    </button>
  )
}

/** Namen der Spieler ein-/ausblenden (Spieler ohne Namen zeigen nichts) */
export function NamesButton() {
  const show = useUi((s) => s.showNames)
  const setShow = useUi((s) => s.setShowNames)
  const title = show ? 'Namen ausblenden' : 'Namen der Spieler einblenden'
  return (
    <button className={show ? 'selected' : ''} aria-pressed={show} title={title} aria-label={title} onClick={() => setShow(!show)}>
      <Icon name="name" />
    </button>
  )
}

/** Zonen auf dem Feldboden ein-/ausblenden (Art der Zonen in den Einstellungen) */
export function ZonesButton() {
  const show = useUi((s) => s.showZones)
  const setShow = useUi((s) => s.setShowZones)
  const style = useSettings((s) => s.settings.zoneStyle)
  const title = `Zonen ${STYLE_LABEL[style]} ${show ? 'ausblenden' : 'einblenden'}`
  return (
    <button className={show ? 'selected' : ''} aria-pressed={show} title={title} aria-label={title} onClick={() => setShow(!show)}>
      <Icon name="zones" />
    </button>
  )
}

/** Zeichnungen der Skizze auf dem Feldboden ein-/ausblenden (gilt für Draufsicht und 3D) */
export function SketchButton() {
  const show = useUi((s) => s.showSketch)
  const setShow = useUi((s) => s.setShowSketch)
  const title = show ? 'Skizze auf dem Feld ausblenden' : 'Skizze auf dem Feld einblenden'
  return (
    <button className={show ? 'selected' : ''} aria-pressed={show} title={title} aria-label={title} onClick={() => setShow(!show)}>
      <Icon name="pencil" />
    </button>
  )
}
