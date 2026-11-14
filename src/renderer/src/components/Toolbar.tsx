import { useEffect, useRef, useState } from 'react'
import { useUi, type ViewMode } from '@renderer/store/settingsStore'
import { isPlayEmpty, usePlay } from '@renderer/store/playStore'
import { newPlay } from '@renderer/store/playDocs'
import { quickSave } from '@renderer/store/actions'
import { Icon, type IconName } from './Icon'

const VIEW_MODES: { id: ViewMode; label: string; title: string }[] = [
  { id: '2d', label: '2D', title: 'Draufsicht und Netzansicht – hier wird gezeichnet und verschoben' },
  { id: '3d', label: '3D', title: '3D-Ansicht – der Spielzug wie in der Halle' }
]

/**
 * Toolbar in einer Reihe: links Seitenleiste und Spielzug (Name mit Menü, Speichern), in der Mitte die Ansicht,
 * rechts Teams, Export und Einstellungen. Gezeichnet und eingestellt wird in der Seitenleiste.
 */
export function Toolbar() {
  const { viewMode, setViewMode, sidebarOpen, setSidebarOpen, setTeamsOpen, setSettingsOpen, setDialog } = useUi()

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button
          className={`icon-only ${sidebarOpen ? 'selected-soft' : ''}`}
          aria-pressed={sidebarOpen}
          title={sidebarOpen ? 'Seitenleiste ausblenden' : 'Seitenleiste einblenden (Ablauf, Aufstellung)'}
          aria-label="Seitenleiste"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Icon name="panel" />
        </button>
        <DocMenu />
        <SaveButton />
      </div>

      <div className="segmented view-switch" role="radiogroup" aria-label="Ansicht">
        {VIEW_MODES.map((m) => (
          <button key={m.id} role="radio" aria-checked={viewMode === m.id} className={viewMode === m.id ? 'selected' : ''} title={m.title} onClick={() => setViewMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="toolbar-group toolbar-end">
        <button aria-label="Teams" title="Teams und Spieler verwalten" onClick={() => setTeamsOpen(true)}>
          <Icon name="people" />
          <span className="btn-label">Teams</span>
        </button>
        <button title="Als PDF oder Video exportieren" aria-label="Exportieren" onClick={() => setDialog('export')}>
          <Icon name="share" />
          <span className="btn-label">Export</span>
        </button>
        <button className="icon-only" title="Einstellungen" aria-label="Einstellungen" onClick={() => setSettingsOpen(true)}>
          <Icon name="settings" />
        </button>
      </div>
    </header>
  )
}

/**
 * Speichern mit einem Tipp: Ein schon gespeicherter Spielzug wird direkt überschrieben (kein Dialog),
 * ein neuer fragt einmal nach Kürzel und Titel. Der Button zeigt, ob es etwas zu speichern gibt.
 */
function SaveButton() {
  const current = usePlay((s) => s.current)
  const dirty = usePlay((s) => s.dirty)
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')
  const saved = !!current && !dirty && state !== 'error'
  const save = () => {
    setState('busy')
    quickSave().then(
      () => setState('idle'),
      () => setState('error')
    )
  }
  return (
    <button
      className={`save-button ${saved ? 'saved' : dirty || !current ? 'prominent' : ''}`}
      disabled={saved || state === 'busy'}
      title={saved ? 'Alle Änderungen sind gespeichert' : current ? `„${current.code}“ speichern (Strg+S)` : 'Spielzug benennen und speichern (Strg+S)'}
      onClick={save}
    >
      <Icon name={saved ? 'check' : 'save'} />
      {state === 'error' ? 'Erneut versuchen' : saved ? 'Gespeichert' : 'Speichern'}
    </button>
  )
}

/** Name des Spielzugs mit Menü: neu, öffnen, umbenennen, als Kopie speichern */
function DocMenu() {
  const current = usePlay((s) => s.current)
  const dirty = usePlay((s) => s.dirty)
  const setDialog = useUi((s) => s.setDialog)
  const [open, setOpen] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setConfirmNew(false)
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }
  const item = (icon: IconName, label: string, onClick: () => void, hint?: string, disabled = false) => (
    <button role="menuitem" className="menu-item" disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={18} />
      <span className="grow">{label}</span>
      {hint && <span className="secondary">{hint}</span>}
    </button>
  )
  const startNew = () => {
    // Nur nachfragen, wenn wirklich etwas verloren ginge
    if (dirty && !isPlayEmpty() && !confirmNew) return setConfirmNew(true)
    setOpen(false)
    newPlay()
  }

  return (
    <div className="doc-menu" ref={ref}>
      <button className="doc-button" aria-haspopup="menu" aria-expanded={open} title="Spielzug: neu, öffnen, umbenennen, kopieren" onClick={() => setOpen(!open)}>
        <span className="doc-text">
          <span className="doc-name">{current ? current.code || 'Spielzug' : 'Neuer Spielzug'}</span>
          <span className="doc-sub">{current ? current.title || (dirty ? 'Geändert' : 'Gespeichert') : dirty ? 'Noch nicht gespeichert' : 'Leer'}</span>
        </span>
        {dirty && <span className="dirty-dot" aria-label="ungespeicherte Änderungen" />}
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="menu" role="menu" aria-label="Spielzug">
          <button role="menuitem" className={`menu-item ${confirmNew ? 'danger-text' : ''}`} onClick={startNew}>
            <Icon name="newfile" size={18} />
            <span className="grow">{confirmNew ? 'Änderungen verwerfen und neu beginnen?' : 'Neuer Spielzug'}</span>
          </button>
          {item('library', 'Bibliothek öffnen …', run(() => setDialog('library')))}
          <hr />
          {item('save', current ? 'Speichern' : 'Speichern …', run(() => void quickSave().catch(() => {})), 'Strg+S', !!current && !dirty)}
          {item('pencil', 'Umbenennen …', run(() => setDialog('save')), undefined, !current)}
          {item('copy', 'Als Kopie speichern …', run(() => setDialog('saveAs')), undefined, !current)}
        </div>
      )}
    </div>
  )
}
