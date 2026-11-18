import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ChipLabel, ChipSize, NetPresetId, Settings, StartView, ThemePref, ZoneStyle } from '@shared/types'
import { UI_SCALES } from '@shared/types'
import { NET_PRESETS, presetForHeight } from '@renderer/core/geometry/court'
import { SPEEDS } from '@renderer/core/timeline/timeline'
import { useSettings } from '@renderer/store/appSettings'
import { useUi } from '@renderer/store/settingsStore'
import { useUpdate } from '@renderer/store/updateStore'
import { shortCommit } from '@shared/update'
import { updateSummary } from './UpdateDialog'
import { ConfirmButton } from './ConfirmButton'
import { Icon, type IconName } from './Icon'
import { NumberField } from './NumberField'
import { MeterSlider } from './TrajectoryCard'

export const speedLabel = (s: number) => `${Math.round(s * 100)} %`
const meters = (v: number) => `${v.toFixed(2).replace('.', ',')} m`

type PageId = 'look' | 'input' | 'play' | 'playback' | 'heights' | 'data' | 'update'
const PAGES: { id: PageId; label: string; icon: IconName; sub: string }[] = [
  { id: 'look', label: 'Darstellung', icon: 'name', sub: 'Hell oder dunkel, Größe, Spieler-Kreise, Zonen' },
  { id: 'input', label: 'Stift & Eingabe', icon: 'pencil', sub: 'Stift, Finger, Skizze und Aufstellungsregeln' },
  { id: 'play', label: 'Neuer Spielzug', icon: 'newfile', sub: 'Womit die App und ein neuer Spielzug starten' },
  { id: 'playback', label: 'Wiedergabe & 3D', icon: 'play', sub: 'Ton, Abprall, Flugbahnen und Kamera' },
  { id: 'heights', label: 'Ballwege', icon: 'arc', sub: 'Höhen, mit denen neu gezeichnete Ballwege beginnen' },
  { id: 'data', label: 'Speichern & Daten', icon: 'save', sub: 'Automatisch speichern, Ordner, Zurücksetzen' },
  { id: 'update', label: 'Version & Update', icon: 'update', sub: 'Neue Version aus dem Projektordner holen und neu starten' }
]

/**
 * Einstellungen (dauerhaft in settings.json): links die Bereiche, rechts die Einstellungen des gewählten Bereichs.
 * Jede Zeile sagt, was sie bewirkt; Änderungen gelten sofort. Die zuletzt geöffnete Seite bleibt gemerkt.
 */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings: s, update, reset } = useSettings()
  const stored = useUi((u) => u.settingsPage)
  const setPage = useUi((u) => u.setSettingsPage)
  const page = PAGES.find((p) => p.id === stored) ?? PAGES[0]
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  // Neue Seite beginnt oben
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [page.id])

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="sheet-head">
          <h2 id="settings-title">Einstellungen</h2>
          <button className="prominent" onClick={onClose}>
            Fertig
          </button>
        </header>
        <div className="settings-split">
          <nav className="settings-nav" aria-label="Bereiche">
            {PAGES.map((p) => (
              <button key={p.id} className={`settings-tab ${p.id === page.id ? 'on' : ''}`} aria-current={p.id === page.id ? 'page' : undefined} onClick={() => setPage(p.id)}>
                <Icon name={p.icon} size={18} />
                <span>{p.label}</span>
              </button>
            ))}
          </nav>
          <div className="settings-body" ref={bodyRef} key={page.id}>
            <header className="settings-page-head">
              <h3>{page.label}</h3>
              <p>{page.sub}</p>
            </header>
            {page.id === 'look' && <LookPage s={s} update={update} />}
            {page.id === 'input' && <InputPage s={s} update={update} />}
            {page.id === 'play' && <PlayPage s={s} update={update} />}
            {page.id === 'playback' && <PlaybackPage s={s} update={update} />}
            {page.id === 'heights' && <HeightsPage s={s} update={update} />}
            {page.id === 'data' && <DataPage s={s} update={update} reset={reset} />}
            {page.id === 'update' && <UpdatePage s={s} update={update} />}
          </div>
        </div>
      </div>
    </div>
  )
}

interface PageProps {
  s: Settings
  update: (patch: Partial<Settings>) => void
}

/* ---------- Bausteine ---------- */

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h4 className="section-title">{title}</h4>}
      {children}
    </section>
  )
}

/** Eine Einstellung: links Name und ein Satz dazu, rechts das Bedienelement */
function Row({ label, hint, children, wrap = false }: { label: string; hint?: ReactNode; children: ReactNode; wrap?: boolean }) {
  return (
    <div className={`setting-row static ${wrap ? 'wrap' : ''}`}>
      <span className="grow">
        {label}
        {hint && <span className="caption block">{hint}</span>}
      </span>
      {children}
    </div>
  )
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: ReactNode; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting-row">
      <span className="grow">
        {label}
        {hint && <span className="caption block">{hint}</span>}
      </span>
      <input type="checkbox" className="switch" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

/** Wenige Möglichkeiten nebeneinander: alle auf einen Blick, ein Tipp genügt */
function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={String(id)} role="radio" aria-checked={value === id} className={value === id ? 'selected' : ''} onClick={() => onChange(id)}>
          {text}
        </button>
      ))}
    </div>
  )
}

function Slider({ label, hint, value, min, max, step, digits = 0, unit, onChange }: { label: string; hint?: string; value: number; min: number; max: number; step: number; digits?: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="traj-slider">
      <span className="row">
        <span className="grow">{label}</span>
        <NumberField label={label} value={value} min={min} max={max} digits={digits} unit={unit} onCommit={onChange} />
      </span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <span className="caption">{hint}</span>}
    </label>
  )
}

/* ---------- Seiten ---------- */

const THEMES: [ThemePref, string][] = [
  ['system', 'System'],
  ['light', 'Hell'],
  ['dark', 'Dunkel']
]
const CHIP_SIZE_OPTIONS: [ChipSize, string][] = [
  ['small', 'Klein'],
  ['normal', 'Normal'],
  ['large', 'Groß']
]
const CHIP_LABEL_OPTIONS: [ChipLabel, string][] = [
  ['both', 'Rolle + Nr.'],
  ['role', 'Rolle'],
  ['number', 'Nummer']
]

function LookPage({ s, update }: PageProps) {
  return (
    <>
      <Group>
        <Row label="Erscheinungsbild" hint={s.theme === 'system' ? 'Folgt der Einstellung von Windows.' : s.theme === 'light' ? 'Immer hell.' : 'Immer dunkel.'} wrap>
          <Choice label="Erscheinungsbild" value={s.theme} options={THEMES} onChange={(theme) => update({ theme })} />
        </Row>
        <Row label="Größe der Oberfläche" hint="Größer: Knöpfe und Schrift lassen sich mit dem Finger leichter treffen." wrap>
          <Choice label="Größe der Oberfläche" value={s.uiScale} options={UI_SCALES.map((v) => [v, speedLabel(v)] as const)} onChange={(uiScale) => update({ uiScale })} />
        </Row>
      </Group>
      <Group title="Spieler auf dem Feld">
        <Row label="Größe der Kreise" hint="In der Draufsicht und in der Skizze." wrap>
          <Choice label="Größe der Kreise" value={s.chipSize} options={CHIP_SIZE_OPTIONS} onChange={(chipSize) => update({ chipSize })} />
        </Row>
        <Row label="Im Kreis steht" wrap>
          <Choice label="Beschriftung der Kreise" value={s.chipLabel} options={CHIP_LABEL_OPTIONS} onChange={(chipLabel) => update({ chipLabel })} />
        </Row>
        <Toggle label="Namen zeigen" hint="Unter dem Kreis, in 3D über dem Kopf. Auch mit dem Namen-Button an der Ansicht." value={s.showNames} onChange={(showNames) => update({ showNames })} />
        <Toggle label="Läufer am Steller zeigen" hint="Kleines Schild „L2“ am Steller, nach dem gezählt wird (Läufer = seine Position)." value={s.showLaeuferMark} onChange={(showLaeuferMark) => update({ showLaeuferMark })} />
      </Group>
      <Group title="Zonen">
        <Toggle label="Zonen zeigen" hint="Auch mit dem Zonen-Button an der Ansicht." value={s.showZones} onChange={(showZones) => update({ showZones })} />
        <Row label="Einteilung">
          <select aria-label="Einteilung der Zonen" value={s.zoneStyle} onChange={(e) => update({ zoneStyle: e.target.value as ZoneStyle })}>
            <option value="standard">Standard · 1–6</option>
            <option value="advanced">Erweitert · 1–9</option>
            <option value="letters">Erweitert · 1–9 mit A–D</option>
          </select>
        </Row>
      </Group>
    </>
  )
}

function InputPage({ s, update }: PageProps) {
  return (
    <>
      <Group>
        <Toggle
          label="Finger zeichnet"
          hint="Aus: Stift und Maus zeichnen, der Finger verschiebt und zoomt. An: Auch der Finger zeichnet – Ballwege, Laufwege und die Skizze."
          value={s.fingerDraws}
          onChange={(fingerDraws) => update({ fingerDraws })}
        />
        <Toggle
          label="Bedienleiste links"
          hint="Zoom, Drehen, Namen und Zonen wandern an den linken Rand. Angenehm, wenn du den Stift links hältst."
          value={s.leftHanded}
          onChange={(leftHanded) => update({ leftHanded })}
        />
      </Group>
      <Group title="Skizze">
        <Toggle label="Striche glätten" hint="Zittrige Linien werden zu ruhigen Bögen. Aus: Der Strich bleibt genau so, wie er gezogen wurde." value={s.sketchSmooth} onChange={(sketchSmooth) => update({ sketchSmooth })} />
        <ul className="settings-facts">
          <li>
            <b>Stiftspitze</b> zeichnet, auf einem Spieler zieht sie ihn.
          </li>
          <li>
            <b>Radierer-Taste</b> (Surface Slim Pen: oben) löscht ganze Striche.
          </li>
          <li>
            <b>Seitliche Taste</b> gedrückt halten verschiebt die Ansicht.
          </li>
          <li>Farbe und Strichstärke merkt sich die App.</li>
        </ul>
      </Group>
      <Group title="Aufstellung">
        <Toggle
          label="Aufstellungsregeln"
          hint="1 Steller + 1 Diagonal oder 2 Steller, dazu 2 Mittelblocker und 2 Außen. Der Libero spielt nur im Hinterfeld. Aus: freie Aufstellung. In der Skizze gelten sie nie."
          value={s.lineupRules}
          onChange={(lineupRules) => update({ lineupRules })}
        />
      </Group>
    </>
  )
}

const START_OPTIONS: [StartView, string][] = [
  ['2d', '2D'],
  ['3d', '3D'],
  ['sketch', 'Skizze']
]

function PlayPage({ s, update }: PageProps) {
  return (
    <>
      <Group title="Beim Start">
        <Row label="Ansicht" hint="Damit öffnet sich die App." wrap>
          <Choice label="Ansicht beim Start" value={s.startView} options={START_OPTIONS} onChange={(startView) => update({ startView })} />
        </Row>
        <Toggle label="Letzten Spielzug wieder öffnen" hint="Die App macht dort weiter, wo du aufgehört hast. Aus: Sie startet mit einem leeren Spielzug." value={s.reopenLast} onChange={(reopenLast) => update({ reopenLast })} />
      </Group>
      <Group title="Jeder neue Spielzug">
        <Row label="Netzhöhe">
          <select
            aria-label="Netzhöhe"
            value={s.netPreset}
            onChange={(e) => {
              const p = e.target.value as NetPresetId
              update({ netPreset: p, netHeight: p === 'custom' ? s.netHeight : NET_PRESETS[p].height })
            }}
          >
            {Object.entries(NET_PRESETS).map(([id, p]) => (
              <option key={id} value={id}>
                {p.label} · {meters(p.height)}
              </option>
            ))}
            {presetForHeight(s.netHeight) === 'custom' && <option value="custom">Frei · {meters(s.netHeight)}</option>}
          </select>
        </Row>
        <Toggle label="In Schleife abspielen" value={s.defaultLoop} onChange={(defaultLoop) => update({ defaultLoop })} />
        <Row label="Tempo beim Abspielen">
          <select aria-label="Tempo beim Abspielen" value={s.defaultSpeed} onChange={(e) => update({ defaultSpeed: Number(e.target.value) })}>
            {SPEEDS.map((v) => (
              <option key={v} value={v}>
                {speedLabel(v)}
              </option>
            ))}
          </select>
        </Row>
        <p className="caption">Netzhöhe, Schleife und Tempo lassen sich in jedem Spielzug noch ändern.</p>
      </Group>
    </>
  )
}

function PlaybackPage({ s, update }: PageProps) {
  return (
    <>
      <Group title="Ton">
        <Toggle label="Geräusche" hint="Annahme, Zuspiel, Schlag, Block, Netz und Aufprall sind zu hören." value={s.sound} onChange={(sound) => update({ sound })} />
        {s.sound && <Slider label="Lautstärke" value={s.soundVolume} min={0} max={100} step={5} unit="%" onChange={(soundVolume) => update({ soundVolume })} />}
      </Group>
      <Group title="Ball">
        <Toggle label="Ball springt nach dem Schlag weiter" hint="Trifft der Schlag den Boden, läuft die Animation mit dem Abprall weiter." value={s.bounce} onChange={(bounce) => update({ bounce })} />
        {s.bounce && <Slider label="Dauer des Abpralls" value={s.bounceDuration} min={0.5} max={5} step={0.1} digits={1} unit="s" onChange={(bounceDuration) => update({ bounceDuration })} />}
      </Group>
      <Group title="3D-Ansicht">
        <Slider
          label="Deckkraft der Flugbahnen"
          hint="Je durchsichtiger, desto weniger verdecken die Bahnen Spieler und Ball."
          value={s.trajectoryOpacity3d}
          min={10}
          max={100}
          step={1}
          unit="%"
          onChange={(trajectoryOpacity3d) => update({ trajectoryOpacity3d })}
        />
        <Toggle label="Kamera wackelt bei harten Kontakten" hint="Bei Schlag, Block und Aufprall, nur beim Abspielen." value={s.cameraShake} onChange={(cameraShake) => update({ cameraShake })} />
      </Group>
    </>
  )
}

function HeightsPage({ s, update }: PageProps) {
  return (
    <>
      <Group title="Annahme">
        <MeterSlider label="Start (Arme des Annehmers)" value={s.defaultStartHAnnahme} min={0} max={4} onChange={(v) => update({ defaultStartHAnnahme: v })} />
        <MeterSlider label="Ende (Hände des Stellers)" value={s.defaultEndHAnnahme} min={0} max={4.5} hint="Hier beginnt das Zuspiel." onChange={(v) => update({ defaultEndHAnnahme: v })} />
        <MeterSlider label="Höchster Punkt über dem Start" value={s.defaultApexOffsetAnnahme} min={0} max={8} onChange={(v) => update({ defaultApexOffsetAnnahme: v })} />
      </Group>
      <Group title="Zuspiel">
        <MeterSlider label="Start (Hände des Stellers)" value={s.defaultStartHZuspiel} min={0} max={4} hint="Nur ohne Annahme. Mit Annahme beginnt das Zuspiel dort, wo sie endet." onChange={(v) => update({ defaultStartHZuspiel: v })} />
        <MeterSlider label="Ende (Schlagpunkt des Angreifers)" value={s.defaultHitH} min={0} max={4.5} onChange={(v) => update({ defaultHitH: v })} />
        <MeterSlider label="Höchster Punkt über dem Start" value={s.defaultApexOffsetZuspiel} min={0} max={8} onChange={(v) => update({ defaultApexOffsetZuspiel: v })} />
      </Group>
      <p className="caption">Schon gezeichnete Ballwege ändern sich dadurch nicht. Der höchste Punkt liegt immer mindestens 0,3 m über dem Schlagpunkt.</p>
    </>
  )
}

function DataPage({ s, update, reset }: PageProps & { reset: () => void }) {
  const [info, setInfo] = useState<{ version: string; dataDir: string; exportDir: string } | null>(null)
  useEffect(() => {
    void window.api.app
      ?.info()
      .then(setInfo)
      .catch(() => {})
  }, [])
  return (
    <>
      <Group>
        <Toggle
          label="Automatisch speichern"
          hint="Ein Spielzug, der schon einen Namen hat, wird kurz nach jeder Änderung gespeichert. Ein neuer fragt weiterhin einmal nach dem Kürzel."
          value={s.autosave}
          onChange={(autosave) => update({ autosave })}
        />
        <Toggle
          label="Beim Beenden nicht nachfragen"
          hint="Aus: Bei ungespeicherten Änderungen fragt die App vor dem Beenden nach. An: Sie schließt sofort, nicht gespeicherte Änderungen gehen verloren."
          value={s.skipCloseWarning}
          onChange={(skipCloseWarning) => update({ skipCloseWarning })}
        />
      </Group>
      <Group title="Ordner">
        <Row label="Exporte" hint={info?.exportDir ?? 'PDF und Videos'}>
          <button onClick={() => void window.api.app?.openFolder('exports')}>
            <Icon name="folder" />
            Öffnen
          </button>
        </Row>
        <Row label="Spielzüge, Teams und Einstellungen" hint={info?.dataDir ?? 'Daten der App'}>
          <button onClick={() => void window.api.app?.openFolder('data')}>
            <Icon name="folder" />
            Öffnen
          </button>
        </Row>
        <p className="caption">Für eine Sicherung oder den Umzug auf ein anderes Gerät kopierst du den Daten-Ordner.</p>
      </Group>
      <Group title="Zurücksetzen">
        <Row label="Alle Einstellungen zurücksetzen" hint="Spielzüge und Teams bleiben erhalten.">
          <ConfirmButton label="Zurücksetzen" confirmLabel="Wirklich zurücksetzen?" onConfirm={reset} />
        </Row>
      </Group>
    </>
  )
}

function UpdatePage({ s, update }: PageProps) {
  const status = useUpdate((u) => u.status)
  const phase = useUpdate((u) => u.phase)
  const show = useUpdate((u) => u.show)
  const check = useUpdate((u) => u.check)
  const [version, setVersion] = useState('')
  useEffect(() => {
    void window.api.app
      ?.info()
      .then((i) => setVersion(i.version))
      .catch(() => {})
    void check()
  }, [check])
  const built = status?.builtAt ? new Date(status.builtAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : ''
  const available = status?.state === 'available'
  return (
    <>
      <Group>
        <Row label={`Aufsteiger ${version}`} hint={status ? `Stand ${shortCommit(status.installedCommit)}${built ? `, gebaut am ${built}` : ''}` : undefined}>
          <span />
        </Row>
        <Row label={updateSummary(status, phase === 'checking')} hint={status?.projectDir ? `Projektordner: ${status.projectDir}` : undefined}>
          <button className={available ? 'prominent' : undefined} disabled={phase === 'building' || phase === 'restarting'} onClick={show}>
            <Icon name="update" />
            {available ? 'Jetzt aktualisieren' : 'Nach Updates suchen'}
          </button>
        </Row>
        <Toggle
          label="Beim Start auf neue Versionen hinweisen"
          hint="Aus: Kein Fenster nach dem Start. Eine neue Version zeigt dann nur der Update-Button oben in der Werkzeugleiste."
          value={!s.skipUpdatePrompt}
          onChange={(on) => update({ skipUpdatePrompt: !on })}
        />
        <p className="caption">
          Die App holt neue Versionen aus dem Projektordner, aus dem sie gebaut wurde: Sie baut die neue Version, beendet sich und startet neu. Windows fragt dabei
          nach Administratorrechten. Deine Spielzüge, Teams und Einstellungen bleiben erhalten.
        </p>
      </Group>
    </>
  )
}
