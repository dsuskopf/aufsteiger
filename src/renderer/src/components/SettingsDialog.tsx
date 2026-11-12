import { useEffect } from 'react'
import type { NetPresetId } from '@shared/types'
import { NET_PRESETS, presetForHeight } from '@renderer/core/geometry/court'
import { SPEEDS } from '@renderer/core/timeline/timeline'
import { useSettings } from '@renderer/store/appSettings'
import { MeterSlider } from './TrajectoryCard'

export const speedLabel = (s: number) => `${Math.round(s * 100)} %`

/**
 * Einstellungen (dauerhaft in settings.json): Standardhöhen neuer Flugbahnen, Standard-Netzhöhe,
 * Standard für Schleife und Tempo, Finger-Zeichnen. Änderungen gelten sofort.
 */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings: s, update, reset } = useSettings()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="sheet-head">
          <h2 id="settings-title">Einstellungen</h2>
          <button className="plain" onClick={reset}>
            Standardwerte
          </button>
          <button className="prominent" onClick={onClose}>
            Fertig
          </button>
        </header>
        <div className="settings-body">
          <section>
            <h3 className="section-title">Annahme</h3>
            <MeterSlider label="Starthöhe" value={s.defaultStartHAnnahme} min={0} max={4} onChange={(v) => update({ defaultStartHAnnahme: v })} />
            <MeterSlider label="Endhöhe" value={s.defaultEndHAnnahme} min={0} max={4.5} hint="Schlagpunkt der Annahme = Start des Zuspiels" onChange={(v) => update({ defaultEndHAnnahme: v })} />
            <MeterSlider label="Scheitel über dem Start" value={s.defaultApexOffsetAnnahme} min={0} max={8} onChange={(v) => update({ defaultApexOffsetAnnahme: v })} />
          </section>
          <section>
            <h3 className="section-title">Zuspiel</h3>
            <MeterSlider label="Starthöhe (Hand des Stellers)" value={s.defaultStartHZuspiel} min={0} max={4} onChange={(v) => update({ defaultStartHZuspiel: v })} />
            <MeterSlider label="Schlagpunkt (Angriff)" value={s.defaultHitH} min={0} max={4.5} onChange={(v) => update({ defaultHitH: v })} />
            <MeterSlider label="Scheitel über dem Start" value={s.defaultApexOffsetZuspiel} min={0} max={8} onChange={(v) => update({ defaultApexOffsetZuspiel: v })} />
            <p className="caption">Gilt für neu gezeichnete Flugbahnen. Der Scheitel liegt immer mindestens 0,3 m über dem Schlagpunkt.</p>
          </section>
          <section>
            <h3 className="section-title">Neuer Spielzug</h3>
            <label className="setting-row">
              <span className="grow">Netzhöhe</span>
              <select
                value={s.netPreset}
                onChange={(e) => {
                  const p = e.target.value as NetPresetId
                  update({ netPreset: p, netHeight: p === 'custom' ? s.netHeight : NET_PRESETS[p].height })
                }}
              >
                {Object.entries(NET_PRESETS).map(([id, p]) => (
                  <option key={id} value={id}>
                    {p.label} · {p.height.toFixed(2).replace('.', ',')} m
                  </option>
                ))}
                {presetForHeight(s.netHeight) === 'custom' && <option value="custom">Frei · {s.netHeight.toFixed(2).replace('.', ',')} m</option>}
              </select>
            </label>
            <label className="setting-row">
              <span className="grow">Abspielen in Schleife</span>
              <input type="checkbox" className="switch" checked={s.defaultLoop} onChange={(e) => update({ defaultLoop: e.target.checked })} />
            </label>
            <label className="setting-row">
              <span className="grow">Abspielgeschwindigkeit</span>
              <select value={s.defaultSpeed} onChange={(e) => update({ defaultSpeed: Number(e.target.value) })}>
                {SPEEDS.map((v) => (
                  <option key={v} value={v}>
                    {speedLabel(v)}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section>
            <h3 className="section-title">Eingabe</h3>
            <label className="setting-row">
              <span className="grow">
                Finger zeichnet Flugbahnen
                <span className="caption block">Aus: Nur Stift und Maus zeichnen, der Finger verschiebt die Ansicht.</span>
              </span>
              <input type="checkbox" className="switch" checked={s.fingerDraws} onChange={(e) => update({ fingerDraws: e.target.checked })} />
            </label>
          </section>
        </div>
      </div>
    </div>
  )
}
