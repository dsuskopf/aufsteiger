import { useEffect, useState } from 'react'
import type { NetPresetId } from '@shared/types'
import { NET_HEIGHT_MAX, NET_HEIGHT_MIN, NET_PRESETS } from '@renderer/core/geometry/court'
import { useUi, type ViewMode } from '@renderer/store/settingsStore'
import { Icon } from './Icon'

const VIEW_MODES: { id: ViewMode; label: string; title: string }[] = [
  { id: 'split', label: 'Beide', title: 'Draufsicht und Seitenansicht' },
  { id: 'top', label: 'Draufsicht', title: 'Nur Draufsicht' },
  { id: 'side', label: 'Seite', title: 'Nur Seitenansicht' },
  { id: '3d', label: '3D', title: '3D-Ansicht' }
]

const fmt = (v: number) => v.toFixed(2).replace('.', ',')

/**
 * Toolbar mit drei Gruppen (HIG toolbars.md: „aim for a maximum of three“):
 * vorne die Ansicht, hinten Netz und die Panels (Aufstellung, Teams).
 */
export function Toolbar() {
  const { viewMode, setViewMode, netPreset, setNetPreset, netHeight, setNetHeight } = useUi()
  const { lineupOpen, setLineupOpen, setTeamsOpen } = useUi()

  return (
    <header className="toolbar">
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
