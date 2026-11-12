import { useEffect, useState } from 'react'
import type { NetPresetId } from '@shared/types'
import { NET_HEIGHT_MAX, NET_HEIGHT_MIN, NET_PRESETS } from '@renderer/core/geometry/court'
import { useUi, type Tool, type ViewMode } from '@renderer/store/settingsStore'
import { usePlay } from '@renderer/store/playStore'
import { Icon, type IconName } from './Icon'

const TOOLS: { id: Tool; label: string; icon: IconName; title: string }[] = [
  { id: 'select', label: 'Auswählen', icon: 'pointer', title: 'Auswählen und ziehen (Spieler, Griffe)' },
  { id: 'annahme', label: 'Annahme', icon: 'arc', title: 'Annahme zeichnen: Klick Start, Klick Ende – oder ziehen' },
  { id: 'zuspiel', label: 'Zuspiel', icon: 'arc', title: 'Zuspiel zeichnen: startet am Schlagpunkt der Annahme' }
]

const VIEW_MODES: { id: ViewMode; label: string; title: string }[] = [
  { id: '2d', label: '2D', title: 'Draufsicht und Netzansicht (eine groß, eine als Pop-up)' },
  { id: '3d', label: '3D', title: '3D-Ansicht' }
]

const fmt = (v: number) => v.toFixed(2).replace('.', ',')

/**
 * Toolbar: vorne Spielzug (Bibliothek, Speichern), Ansicht und Werkzeug;
 * hinten Netz, Panels (Aufstellung, Teams), Export und Einstellungen.
 */
export function Toolbar() {
  const { viewMode, setViewMode, netPreset, setNetPreset, netHeight, setNetHeight } = useUi()
  const { lineupOpen, setLineupOpen, setTeamsOpen, tool, setTool, setSettingsOpen, setDialog } = useUi()
  const current = usePlay((s) => s.current)
  const dirty = usePlay((s) => s.dirty)

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button className="doc-button" title="Bibliothek: gespeicherte Spielzüge" onClick={() => setDialog('library')}>
          <Icon name="library" />
          <span className="doc-name">
            {current ? (current.code || current.title || 'Spielzug') : 'Neuer Spielzug'}
            {dirty && <span className="dirty" aria-label="ungespeicherte Änderungen"> •</span>}
          </span>
        </button>
        <button className="icon-only" title="Speichern (Strg+S)" aria-label="Speichern" onClick={() => setDialog('save')}>
          <Icon name="save" />
        </button>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Ansicht">
        {VIEW_MODES.map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={viewMode === m.id}
            className={viewMode === m.id ? 'selected' : ''}
            title={m.title}
            onClick={() => setViewMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="segmented tools" role="radiogroup" aria-label="Werkzeug">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={tool === t.id}
            className={tool === t.id ? 'selected' : ''}
            title={t.title}
            onClick={() => setTool(t.id)}
          >
            <Icon name={t.icon} />
            <span className="tool-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="spacer" />

      <div className="toolbar-group">
        <label className="toolbar-label" htmlFor="net-preset">
          Netzhöhe
        </label>
        <select id="net-preset" value={netPreset} onChange={(e) => setNetPreset(e.target.value as NetPresetId)}>
          {Object.entries(NET_PRESETS).map(([id, p]) => (
            <option key={id} value={id}>
              {p.label} · {fmt(p.height)} m
            </option>
          ))}
          <option value="custom">Frei{netPreset === 'custom' ? ` · ${fmt(netHeight)} m` : ''}</option>
        </select>
        {/* Feineinstellung nur, wenn „Frei“ gewählt ist */}
        {netPreset === 'custom' && (
          <>
            <input
              type="range"
              aria-label="Netzhöhe"
              min={NET_HEIGHT_MIN}
              max={NET_HEIGHT_MAX}
              step={0.01}
              value={netHeight}
              onChange={(e) => setNetHeight(Number(e.target.value))}
            />
            <NetHeightInput value={netHeight} onCommit={setNetHeight} />
            <span className="toolbar-label">m</span>
          </>
        )}
      </div>

      <div className="toolbar-group">
        <button
          className={lineupOpen ? 'selected' : ''}
          aria-pressed={lineupOpen}
          onClick={() => setLineupOpen(!lineupOpen)}
        >
          <Icon name="sidebar" />
          Aufstellung
        </button>
        <button onClick={() => setTeamsOpen(true)}>
          <Icon name="people" />
          Teams
        </button>
        <button className="icon-only" title="Exportieren (PDF, Video)" aria-label="Exportieren" onClick={() => setDialog('export')}>
          <Icon name="share" />
        </button>
        <button className="icon-only" title="Einstellungen" aria-label="Einstellungen" onClick={() => setSettingsOpen(true)}>
          <Icon name="settings" />
        </button>
      </div>
    </header>
  )
}

/**
 * Freie Netzhöhe als Text: Entwurf wird lokal gehalten und erst bei Enter/Verlassen übernommen,
 * damit Leeren oder Tippen von „2,3“ nicht sofort auf das Minimum springt. Komma und Punkt erlaubt.
 */
function NetHeightInput({ value, onCommit }: { value: number; onCommit: (h: number) => void }) {
  const [draft, setDraft] = useState(fmt(value))
  useEffect(() => setDraft(fmt(value)), [value])

  const commit = () => {
    const n = Number(draft.trim().replace(',', '.'))
    if (draft.trim() !== '' && Number.isFinite(n)) onCommit(n)
    else setDraft(fmt(value))
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      className="field num"
      aria-label={`Netzhöhe in Metern (${NET_HEIGHT_MIN}–${NET_HEIGHT_MAX})`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setDraft(fmt(value))
      }}
    />
  )
}
