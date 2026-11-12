# Projekt: Volleyball-Spielzugplaner (Windows-Desktop-App)

Du bist mein Entwickler für dieses Projekt. Lies die gesamte Spezifikation, erstelle zuerst einen Architektur- und Umsetzungsplan in Phasen, und beginne dann mit Phase 1. Stelle Rückfragen nur, wenn etwas wirklich unklar ist.

## Ziel & Plattform
- Desktop-App für Windows 11, Zielgerät: Surface Pro 9 (Touch + Surface Slim Pen 2 + Tastatur/Maus).
- Läuft komplett offline, startet wie ein normales Programm (Installer, Startmenü-Eintrag).
- Tech-Stack: Electron + Vite + React + TypeScript. 2D-Ansichten mit Konva.js (oder HTML-Canvas), 3D mit Three.js. Build/Installer mit electron-builder.
- Code sauber modular, Physik-Logik als eigenes, getestetes Modul (Unit-Tests mit Vitest).

## Design
- Dunkles Theme: Hintergrund anthrazit bis fast schwarz, UI-Elemente dunkel.
- Flugbahnen, Linien, Akzente und Fade-Effekte in einem düsteren, dunklen Violett ("gloomy dark violet").
- Feldlinien dezent grau, damit Spielzüge sich klar abheben.
- Gut bedienbar mit Stift und Finger (ausreichend große Touch-Ziele), optimiert für Querformat.

## Spielfeld
- Echte Hallenvolleyball-Maße: Feld 18 × 9 m, Netz mittig, Angriffslinien 3 m vom Netz.
- Netzhöhe wählbar mit Presets: Herren 2,43 m, Damen 2,24 m, Mixed 2,35 m. Zusätzlich frei einstellbar.

## Spieler & Teams
- Pro Seite maximal 6 Spieler, es können auch weniger angezeigt werden.
- In der Draufsicht: Spieler als Kreise mit Kürzel darin (S = Steller, MB = Mittelblocker, AA = Außenangreifer, DA = Diagonalangreifer, L = Libero) plus Rückennummer.
- Rollen sind rein optisch, sie haben keinen Einfluss auf Funktion oder Physik.
- Spieler sind in der Draufsicht frei positionierbar (ziehen).
- In 3D: Spieler zunächst als Zylinder oder Quader, Architektur so vorbereiten, dass später 3D-Modelle eingesetzt werden können.
- Teamverwaltung: beliebig viele Teams speichern. Jeder Spieler hat Name, Rückennummer und eine oder mehrere Positionen.
- Im Spielzug wählt man ein Team, Kürzel und Nummern erscheinen automatisch auf den Kreisen.

## Hauptansicht: zwei 2D-Ansichten gleichzeitig
- Links: Draufsicht (von oben) auf das Feld.
- Rechts: Seitenansicht der ausgewählten Flugbahn (vertikale Ebene entlang der Flugbahn, horizontale Achse = Distanz entlang der Linie, vertikale Achse = Höhe, Netz und Netzhöhe als Referenz eingezeichnet).
- Beide Ansichten sind immer synchron: Änderungen in einer werden sofort in der anderen angezeigt.
- Optional umschaltbar auf nur eine Ansicht, falls der Platz zu eng ist.

## Flugbahnen (Annahme und Zuspiel)
Es gibt zwei Flugbahn-Typen: **Annahme** und **Zuspiel**. Beide funktionieren nach exakt demselben Prinzip. Aufschlag wird vorerst NICHT umgesetzt.

### Eingabe in der Draufsicht
- Die Flugbahn ist in der Draufsicht immer eine Gerade (der Ball fliegt keine Links-Rechts-Kurven).
- Zwei Eingabe-Arten, beide gleichzeitig unterstützt:
  1. Klick = Startpunkt, zweiter Klick = Endpunkt.
  2. Ziehen von Start nach Ende in einem Zug.
- Klick und Ziehen sauber unterscheiden (Bewegungsschwelle), funktioniert mit Stift, Finger und Maus.
- Stift-Eingabe (Pointer Events, pointerType "pen") vom Finger unterscheiden, damit man nicht versehentlich verschiebt.

### Höhen in der Seitenansicht
- Startpunkt: Position kommt aus der Draufsicht, die Höhe wird in der Seitenansicht per Ziehen eingestellt (vom Boden bis weit oben möglich).
- Standardwerte in den Einstellungen (pro Typ getrennt einstellbar):
  - Standard-Starthöhe Zuspiel (Hand des Stellers)
  - Standard-Starthöhe Annahme
  - Standard-Schlagpunkthöhe (Angriff)
  - Standard-Scheitelhöhe relativ zum Startpunkt, Default: +1 m über dem Startpunkt (je für Zuspiel und Annahme)
- Dadurch hat jede neue Flugbahn sofort eine natürliche Kurvenform statt einer Geraden.

### Scheitelpunkt
- Wird in der Seitenansicht direkt per Stift/Finger/Maus hoch und runter gezogen, die Parabel wird live neu berechnet, beim Loslassen übernommen.
- Keine Eingabe als Zahl nötig.
- Der Scheitel darf nur nach oben, niemals unter die gerade Verbindungslinie (muss physikalisch möglich bleiben).

### Parabel & Schlagpunkt
- Die Parabel verläuft vom Startpunkt über den Scheitel und fällt dann bis zum Boden.
- Der Schlagpunkt ist NICHT frei platzierbar, sondern lässt sich nur entlang der Parabel verschieben.
- Alles hinter dem Schlagpunkt wird nicht gerendert.
- Verschieben des Schlagpunkts aktualisiert den Endpunkt in der Draufsicht (gleiche Richtung, neue Distanz).
- Checkbox "Flugbahn nach Schlagpunkt anzeigen" (Standard: aus): zeigt den weiteren Verlauf hinter dem Schlagpunkt gestrichelt bzw. verblasst bis zum Aufprall auf dem Boden. Hilft beim Einstellen des Schlagpunkts.

### Physik
- Realistische Wurfparabel mit g = 9,81 m/s², ohne Luftwiderstand.
- Aus Startpunkt, Scheitelhöhe und Schlagpunkt ergibt sich die Flugbahn eindeutig. Geschwindigkeit und Flugdauer werden automatisch berechnet, es gibt KEINE manuelle Geschwindigkeitseinstellung.

### Anzeige-Optionen
- Annahme und Zuspiel können gemeinsam in einem Spielzug angezeigt werden (Annahme, dann Zuspiel), oder jeweils nur eines von beiden (Toggles).

## 3D-Ansicht
- Feld, Netz, Spieler und Flugbahnen in 3D mit echten Maßen.
- Kamera (Orbit) beschränkt auf die obere Halbkugel: von parallel zum Feld (Augenhöhe) bis senkrecht von oben, mit allen Zwischenwinkeln. Niemals unter das Feld.
- Feld frei um 360° drehbar, Zoom und Verschieben (Touch, Stift, Maus).
- Ein Ball (Kugel) fliegt bei der Animation entlang der Flugbahn: Start, Scheitel, Schlagpunkt.

## Animation & Playbar
- Abspielen in der 3D-Ansicht (Ball bewegt sich auch in den 2D-Ansichten mit).
- Abspielen einmal durch oder in Endlosschleife (Toggle).
- Playbar/Timeline: im pausierten Zustand frei nach links und rechts ziehbar (Scrubbing).
- Abspielgeschwindigkeit in Stufen: 25 %, 50 %, 100 % (Echtzeit-Physik), 200 %, 400 %.
- Wenn pausiert und die Playbar fokussiert ist: Pfeiltaste links/rechts = Frame für Frame zurück/vor.

## Speichern & Bibliothek
- Keine Datei-Dialoge im normalen Gebrauch. Spielzüge werden intern im App-Datenverzeichnis gespeichert (z. B. Electron userData, JSON oder SQLite).
- Speichern-Button: Beim Speichern gibt man ein Kürzel (z. B. "AngrV1") und einen Titel ein.
- In der App gibt es eine Bibliothek mit allen gespeicherten Spielzügen: anzeigen, öffnen, umbenennen, duplizieren, löschen.
- Suchen und Filtern nach Kürzel und Titel.
- Gespeichert werden: Team, Spielerpositionen, alle Flugbahnen mit Start, Scheitel, Schlagpunkt, Einstellungen wie Netzhöhe und Anzeige-Optionen.

## Export & Teilen
- PDF-Export pro Spielzug: Titel, Kürzel, Draufsicht, Seitenansicht und mehrere 3D-Ansichten aus verschiedenen Winkeln.
- Optional Video-Export der 3D-Animation (MP4 bevorzugt, sonst WebM).

## Einstellungen
- Standardhöhen (siehe oben), Netzhöhe-Preset, Standard für Schleife und Abspielgeschwindigkeit.
- Einstellungen werden dauerhaft gespeichert.

## Bewusst NICHT im ersten Umfang
- Aufschlag als Flugbahn
- Verkettung mehrerer Spielzüge zu einer Serie
- Echte 3D-Spielermodelle (nur vorbereiten)

## Vorgehen
1. Architektur- und Phasenplan vorschlagen.
2. Phase 1: Projekt-Setup, Feld in 2D und 3D mit echten Maßen, Kamera-Begrenzung, dunkles Theme.
3. Danach: Spieler & Teams, Flugbahnen mit Physik (mit Tests), Seitenansicht, Animation & Playbar, Speichern/Bibliothek, Export, Installer.
4. Nach jeder Phase: kurz zusammenfassen, was fertig ist, und wie ich es auf dem Surface testen kann.
