@echo off
rem Bringt die installierte App auf den Stand dieses Ordners (Doppelklick genuegt).
rem Es wird nur der App-Code ausgetauscht, kein neuer Installer gebaut.
title Aufsteiger aktualisieren
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

call npm run update-installiert
if errorlevel 1 (
  echo.
  echo Update fehlgeschlagen - siehe Meldung oben.
  pause
  exit /b 1
)
timeout /t 4 >nul
