; Eigene Deinstallation für Aufsteiger (wird von electron-builder automatisch eingebunden).
;
; Die Deinstallation entfernt alles, was die App gespeichert hat. Davor kommt eine Seite mit zwei
; Checkboxen, auf der man Teams/Spielzüge/Einstellungen und/oder die Exporte behalten kann.
;
; Bei einem Update (electron-builder ruft den alten Deinstaller mit --updated auf) wird NICHTS gelöscht.
; Eine stille Deinstallation (/S) zeigt keine Seite und löscht alles.
;
; Gespeichert wird von der App:
;   %APPDATA%\Aufsteiger                 Teams, Spielzüge, Einstellungen + Browser-Caches von Electron
;   Dokumente\Aufsteiger-Spielzüge       Exporte (PDF, PNG, Video)
;   %LOCALAPPDATA%\aufsteiger-updater    Kopie des Installers
;   Reste vom alten Namen: %APPDATA%\Volleyball Playbook, Dokumente\Volleyball-Spielzüge,
;                          %LOCALAPPDATA%\volleyball-playbook-updater

!ifdef BUILD_UNINSTALLER

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var keepPlaysBox
Var keepExportsBox
Var keepPlays
Var keepExports

; ---------------------------------------------------------------- Seite „Daten behalten“
; Wird von electron-builder an Stelle der Willkommensseite eingefügt – nach MUI2, daher stehen die
; Funktionen hier im Makro (MUI_HEADER_TEXT gibt es erst ab dort).
!macro customUnWelcomePage
UninstPage custom un.dataPageShow un.dataPageLeave

Function un.dataPageShow
  !insertmacro MUI_HEADER_TEXT "Aufsteiger entfernen" "Gespeicherte Daten werden mit gelöscht."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 36u "Aufsteiger wird vollständig entfernt – auch alles, was die App gespeichert hat. Wenn du etwas behalten willst, setze hier einen Haken:"
  Pop $0

  ${NSD_CreateCheckbox} 0 44u 100% 12u "Teams, Spielzüge und Einstellungen behalten"
  Pop $keepPlaysBox
  ${NSD_CreateLabel} 12u 57u 95% 10u "$APPDATA\Aufsteiger"
  Pop $0

  ${NSD_CreateCheckbox} 0 76u 100% 12u "Exportierte Dateien behalten (PDF, Bilder, Videos)"
  Pop $keepExportsBox
  ${NSD_CreateLabel} 12u 89u 95% 10u "$DOCUMENTS\Aufsteiger-Spielzüge"
  Pop $0

  ${NSD_CreateLabel} 0 112u 100% 24u "Ohne Haken werden die Daten endgültig gelöscht."
  Pop $0

  ; Auswahl merken, falls man mit „Zurück“ wiederkommt
  ${If} $keepPlays == "1"
    ${NSD_Check} $keepPlaysBox
  ${EndIf}
  ${If} $keepExports == "1"
    ${NSD_Check} $keepExportsBox
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function un.dataPageLeave
  ${NSD_GetState} $keepPlaysBox $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $keepPlays "1"
  ${Else}
    StrCpy $keepPlays "0"
  ${EndIf}
  ${NSD_GetState} $keepExportsBox $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $keepExports "1"
  ${Else}
    StrCpy $keepExports "0"
  ${EndIf}
FunctionEnd

; ---------------------------------------------------------------- Löschen
; Löscht alles in $R9 außer den Nutzerdaten (plays, teams.json, settings.json); ist danach nichts
; außer Nutzerdaten übrig, bleibt der Ordner bestehen.
Function un.removeAllButUserData
  FindFirst $0 $1 "$R9\*.*"
  loop:
    StrCmp $1 "" done
    StrCmp $1 "." next
    StrCmp $1 ".." next
    StrCmp $1 "plays" next
    StrCmp $1 "teams.json" next
    StrCmp $1 "settings.json" next
    IfFileExists "$R9\$1\*.*" isDir isFile
    isDir:
      RMDir /r "$R9\$1"
      Goto next
    isFile:
      Delete "$R9\$1"
    next:
      FindNext $0 $1
      Goto loop
  done:
  FindClose $0
FunctionEnd

; $R9 = Datenordner
Function un.removeDataDir
  ${If} $keepPlays == "1"
    Call un.removeAllButUserData
  ${Else}
    RMDir /r "$R9"
  ${EndIf}
FunctionEnd
!macroend

!macro customUnInstall
  ${IfNot} ${isUpdated}
    ; Electron speichert immer pro Benutzer, auch bei Installation „für alle“
    SetShellVarContext current

    StrCpy $R9 "$APPDATA\Aufsteiger"
    Call un.removeDataDir
    StrCpy $R9 "$APPDATA\Volleyball Playbook"
    Call un.removeDataDir

    ${If} $keepExports != "1"
      RMDir /r "$DOCUMENTS\Aufsteiger-Spielzüge"
      RMDir /r "$DOCUMENTS\Volleyball-Spielzüge"
    ${EndIf}

    RMDir /r "$LOCALAPPDATA\aufsteiger-updater"
    RMDir /r "$LOCALAPPDATA\volleyball-playbook-updater"

    ${If} $installMode == "all"
      SetShellVarContext all
    ${EndIf}
  ${EndIf}
!macroend

!endif
