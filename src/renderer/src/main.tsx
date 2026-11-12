import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/theme.css'
import { App } from './App'
import { applyDefaultColor } from './theme/defaultColor'
import Konva from 'konva'
import { usePlay } from './store/playStore'
import { useUi } from './store/settingsStore'
import { useSettings } from './store/appSettings'

// Standardfarbe vor dem ersten Rendern in die CSS-Variablen schreiben
applyDefaultColor()

// Nur für automatische Tests (Start mit ?test): Zugriff auf Zustand und Konva-Bühnen
if (new URLSearchParams(location.search).has('test'))
  Object.assign(window, { __vbp: { Konva, play: usePlay, ui: useUi, settings: useSettings } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
