@echo off
rem Startet den Volleyball-Spielzugplaner im Entwicklungsmodus (Doppelklick genuegt).
rem Das Konsolenfenster offen lassen - schliessen beendet die App.
title Volleyball Playbook
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js/npm wurde nicht gefunden. Bitte Node.js installieren: https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Erster Start: Abhaengigkeiten werden installiert ...
  call npm install
  if errorlevel 1 (
    echo Installation fehlgeschlagen.
    pause
    exit /b 1
  )
)

call npm run dev
if errorlevel 1 pause
