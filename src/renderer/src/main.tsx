import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/theme.css'
import { App } from './App'
import { applyDefaultColor } from './theme/defaultColor'

// Standardfarbe vor dem ersten Rendern in die CSS-Variablen schreiben
applyDefaultColor()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
