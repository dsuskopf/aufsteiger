import { useEffect } from 'react'
import type { NetPresetId, ThemePref, ZoneStyle } from '@shared/types'
import { NET_PRESETS, presetForHeight } from '@renderer/core/geometry/court'
import { SPEEDS } from '@renderer/core/timeline/timeline'
import { useSettings } from '@renderer/store/appSettings'
import { MeterSlider } from './TrajectoryCard'
import { NumberField } from './NumberField'
import { ConfirmButton } from './ConfirmButton'

const THEMES: [ThemePref, string][] = [
  ['system', 'System'],
  ['light', 'Hell'],
  ['dark', 'Dunkel']
]

export const speedLabel = (s: number) => `${Math.round(s * 100)} %`

/**
 * Einstellungen (dauerhaft in settings.json), das Häufigste oben: Darstellung (hell, dunkel, System), Eingabe,
 * Startwerte neuer Spielzüge, Wiedergabe, 3D und zuletzt die Höhen neuer Ballwege. Änderungen gelten sofort.
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
          <ConfirmButton label="Zurücksetzen" confirmLabel="Alle Einstellungen zurücksetzen?" onConfirm={reset} />
          <button className="prominent" onClick={onClose}>
            Fertig
          </button>
        </header>
        <div className="settings-body">
          <section>
            <h3 className="section-title">Darstellung</h3>
            <div className="setting-row static">
              <span className="grow">
                Erscheinungsbild
                <span className="caption block">{s.theme === 'system' ? 'Folgt der Einstellung von Windows.' : s.theme === 'light' ? 'Immer hell.' : 'Immer dunkel.'}</span>
              </span>
              <div className="segmented" role="radiogroup" aria-label="Erscheinungsbild">
                {THEMES.map(([id, label]) => (
                  <button key={id} role="radio" aria-checked={s.theme === id} className={s.theme === id ? 'selected' : ''} onClick={() => update({ theme: id })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="setting-row">
              <span className="grow">
                Zonen auf dem Feld
                <span className="caption block">Ein- und ausblenden mit dem Zonen-Button an der Ansicht.</span>
              </span>
              <select aria-label="Art der Zonen" value={s.zoneStyle} onChange={(e) => update({ zoneStyle: e.target.value as ZoneStyle })}>
                <option value="standard">Standard · 1–6</option>
                <option value="advanced">Erweitert · 1–9</option>
                <option value="letters">Erweitert · 1–9 mit A–D</option>
              </select>
            </label>
            <label className="setting-row">
              <span className="grow">
                Läufer am Steller zeigen
                <span className="caption block">Kleines Schild „L2“ am Steller, nach dem gezählt wird (Läufer = seine Position).</span>
              </span>
              <input type="checkbox" className="switch" checked={s.showLaeuferMark} onChange={(e) => update({ showLaeuferMark: e.target.checked })} />
            </label>
          </section>
          <section>
            <h3 className="section-title">Eingabe</h3>
            <label className="setting-row">
              <span className="grow">
                Finger zeichnet
                <span className="caption block">Aus: Stift und Maus zeichnen, der Finger verschiebt und zoomt. Gilt für Ballwege, Laufwege und die Skizze.</span>
              </span>
              <input type="checkbox" className="switch" checked={s.fingerDraws} onChange={(e) => update({ fingerDraws: e.target.checked })} />
            </label>
            <label className="setting-row">
              <span className="grow">
                Aufstellungsregeln
                <span className="caption block">
                  1 Steller + 1 Diagonal oder 2 Steller, dazu 2 Mittelblocker und 2 Außen. Der Libero spielt nur im Hinterfeld. Aus: freie Aufstellung.
                </span>
              </span>
              <input type="checkbox" className="switch" checked={s.lineupRules} onChange={(e) => update({ lineupRules: e.target.checked })} />
            </label>
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
              <span className="grow">In Schleife abspielen</span>
              <input type="checkbox" className="switch" checked={s.defaultLoop} onChange={(e) => update({ defaultLoop: e.target.checked })} />
            </label>
            <label className="setting-row">
              <span className="grow">Tempo beim Abspielen</span>
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
            <h3 className="section-title">Wiedergabe</h3>
            <label className="setting-row">
              <span className="grow">
                Geräusche
                <span className="caption block">Annahme, Zuspiel, Schlag, Block, Netz und Aufprall sind zu hören.</span>
              </span>
              <input type="checkbox" className="switch" checked={s.sound} onChange={(e) => update({ sound: e.target.checked })} />
            </label>
            {s.sound && (
              <label className="traj-slider">
                <span className="row">
                  <span className="grow">Lautstärke</span>
                  <NumberField label="Lautstärke" value={s.soundVolume} min={0} max={100} digits={0} unit="%" onCommit={(v) => update({ soundVolume: v })} />
                </span>
                <input type="range" min={0} max={100} step={5} value={s.soundVolume} onChange={(e) => update({ soundVolume: Number(e.target.value) })} />
              </label>
            )}
            <label className="setting-row">
              <span className="grow">
                Ball springt nach dem Schlag weiter
                <span className="caption block">Trifft der Schlag den Boden, läuft die Animation mit dem Abprall weiter.</span>
              </span>
              <input type="checkbox" className="switch" checked={s.bounce} onChange={(e) => update({ bounce: e.target.checked })} />
            </label>
            {s.bounce && (
              <label className="traj-slider">
                <span className="row">
                  <span className="grow">Dauer des Abpralls</span>
                  <NumberField label="Dauer des Abpralls" value={s.bounceDuration} min={0.5} max={5} digits={1} unit="s" onCommit={(v) => update({ bounceDuration: v })} />
                </span>
                <input type="range" min={0.5} max={5} step={0.1} value={s.bounceDuration} onChange={(e) => update({ bounceDuration: Number(e.target.value) })} />
              </label>
            )}
          </section>
          <section>
            <h3 className="section-title">3D-Ansicht</h3>
            <label className="traj-slider">
              <span className="row">
                <span className="grow">Deckkraft der Flugbahnen</span>
                <NumberField label="Deckkraft der Flugbahnen" value={s.trajectoryOpacity3d} min={10} max={100} digits={0} unit="%" onCommit={(v) => update({ trajectoryOpacity3d: v })} />
              </span>
              <input
                type="range"
                aria-label="Deckkraft der Flugbahnen in 3D"
                min={10}
                max={100}
                step={1}
                value={s.trajectoryOpacity3d}
                onChange={(e) => update({ trajectoryOpacity3d: Number(e.target.value) })}
              />
              <span className="caption">Je durchsichtiger, desto weniger verdecken die Bahnen Spieler und Ball.</span>
            </label>
            <label className="setting-row">
              <span className="grow">
                Kamera wackelt bei harten Kontakten
                <span className="caption block">Bei Schlag, Block und Aufprall, nur beim Abspielen.</span>
              </span>
              <input type="checkbox" className="switch" checked={s.cameraShake} onChange={(e) => update({ cameraShake: e.target.checked })} />
            </label>
          </section>
          <section>
            <h3 className="section-title">Höhen neuer Ballwege · Annahme</h3>
            <MeterSlider label="Start (Arme des Annehmers)" value={s.defaultStartHAnnahme} min={0} max={4} onChange={(v) => update({ defaultStartHAnnahme: v })} />
            <MeterSlider label="Ende (Hände des Stellers)" value={s.defaultEndHAnnahme} min={0} max={4.5} hint="Hier beginnt das Zuspiel." onChange={(v) => update({ defaultEndHAnnahme: v })} />
            <MeterSlider label="Höchster Punkt über dem Start" value={s.defaultApexOffsetAnnahme} min={0} max={8} onChange={(v) => update({ defaultApexOffsetAnnahme: v })} />
          </section>
          <section>
            <h3 className="section-title">Höhen neuer Ballwege · Zuspiel</h3>
            <MeterSlider label="Start (Hände des Stellers)" value={s.defaultStartHZuspiel} min={0} max={4} hint="Nur ohne Annahme. Mit Annahme beginnt das Zuspiel dort, wo sie endet." onChange={(v) => update({ defaultStartHZuspiel: v })} />
            <MeterSlider label="Ende (Schlagpunkt des Angreifers)" value={s.defaultHitH} min={0} max={4.5} onChange={(v) => update({ defaultHitH: v })} />
            <MeterSlider label="Höchster Punkt über dem Start" value={s.defaultApexOffsetZuspiel} min={0} max={8} onChange={(v) => update({ defaultApexOffsetZuspiel: v })} />
            <p className="caption">Diese Werte gelten für Ballwege, die du neu zeichnest. Der höchste Punkt liegt immer mindestens 0,3 m über dem Schlagpunkt.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
