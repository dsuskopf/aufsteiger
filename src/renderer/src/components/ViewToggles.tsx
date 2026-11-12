import { useSettings } from '@renderer/store/appSettings'
import { useUi } from '@renderer/store/settingsStore'
import { Icon } from './Icon'

const STYLE_LABEL = { standard: '1–6', advanced: '1–9', letters: '1–9 mit A–D' } as const

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
