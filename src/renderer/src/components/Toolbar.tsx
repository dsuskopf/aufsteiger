import { useEffect, useState } from 'react'
import type { NetPresetId } from '@shared/types'
import { NET_HEIGHT_MAX, NET_HEIGHT_MIN, NET_PRESETS } from '@renderer/core/geometry/court'
import { useUi, type ViewMode } from '@renderer/store/settingsStore'

const VIEW_MODES: { id: ViewMode; label: string; title: string }[] = [
  { id: 'split', label: '2D', title: 'Draufsicht + Seitenansicht' },
  { id: 'top', label: 'Draufsicht', title: 'Nur Draufsicht' },
  { id: 'side', label: 'Seite', title: 'Nur Seitenansicht' },
  { id: '3d', label: '3D', title: '3D-Ansicht' }
]

export function Toolbar() {
  const { viewMode, setViewMode, netPreset, setNetPreset, netHeight, setNetHeight } = useUi()
  const { lineupOpen, setLineupOpen, setTeamsOpen } = useUi()

  return (
    <header className="toolbar">
      <div className="brand">
        Volleyball <span>Playbook</span>
      </div>

      <div className="seg" role="group" aria-label="Ansicht">
        {VIEW_MODES.map((m) => (
          <button
            key={m.id}
            className={viewMode === m.id ? 'active' : ''}
            title={m.title}
            onClick={() => setViewMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <button className={lineupOpen ? 'active' : ''} onClick={() => setLineupOpen(!lineupOpen)}>
        Aufstellung
      </button>
      <button onClick={() => setTeamsOpen(true)}>Teams</button>

      <div className="spacer" />

      <div className="group">
        <label htmlFor="net-preset">Netz</label>
        <select
          id="net-preset"
          value={netPreset}
          onChange={(e) => setNetPreset(e.target.value as NetPresetId)}
        >
          {Object.entries(NET_PRESETS).map(([id, p]) => (
            <option key={id} value={id}>
              {p.label} ({p.height.toFixed(2).replace('.', ',')} m)
            </option>
          ))}
          <option value="custom">Frei</option>
        </select>
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
        <label>m</label>
      </div>
    </header>
  )
}

/**
 * Freie Netzhöhe als Text: Entwurf wird lokal gehalten und erst bei Enter/Verlassen übernommen,
 * damit Leeren oder Tippen von „2,3“ nicht sofort auf das Minimum springt. Komma und Punkt erlaubt.
 */
function NetHeightInput({ value, onCommit }: { value: number; onCommit: (h: number) => void }) {
  const fmt = (v: number) => v.toFixed(2).replace('.', ',')
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
      className="num"
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
