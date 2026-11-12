# Umsetzungsplan: Volleyball-Spielzugplaner

## Context
Das Repo enthält bisher nur `SPEZIFIKATION.md`. Gebaut wird eine Offline-Desktop-App für Windows 11 (Surface Pro 9: Stift, Touch, Maus). Damit plant man Volleyball-Spielzüge, hier Annahme und Zuspiel, mit physikalisch korrekten Parabeln. Es gibt eine Draufsicht und eine Netzansicht in 2D, eine 3D-Ansicht, eine Animation, eine Bibliothek und einen Export.

Die Toolchain ist vorhanden: Node 26.13, npm 11.20, git 2.56.

Deine Antworten aus der Rückfrage:
- **Annahme und Zuspiel sind gekoppelt.** Der Zuspiel-Start ist immer der Schlagpunkt der Annahme.
- **Die Annahme bekommt eine eigene Einstellung „Standard-Endhöhe Annahme“.** Der Default ist gleich der Standard-Starthöhe Zuspiel.

---

## 1. Architektur

### Tech & Struktur
- **Scaffold:** `electron-vite` mit dem Template react-ts (`npm create @quick-start/electron`). Darin sind Main, Preload und Renderer getrennt, Vite ist schon verdrahtet und electron-builder vorkonfiguriert.
- **Bibliotheken:**
  - Konva und react-konva für die 2D-Ansichten.
  - Three.js mit `OrbitControls` für 3D, direkt eingebunden ohne R3F, damit die Kamera voll kontrollierbar bleibt.
  - Zustand für den State.
  - Vitest für die Tests.
  - jsPDF für den PDF-Export.
- **Versionen:** Ich pinne keine Versionen aus dem Gedächtnis, sondern installiere die aktuellen stabilen.

```
src/
  main/            Electron-Main: Fenster, IPC-Handler, Dateispeicher (userData)
  preload/         contextBridge → window.api (plays, teams, settings, export)
  shared/          Typen + Schema (PlayDoc, Team, Settings), schemaVersion
  renderer/src/
    core/
      physics/     reine TS-Logik, KEINE React/Konva/Three-Imports  ← Vitest
      geometry/    Feldmaße, Koordinaten-Adapter (Welt ↔ 2D ↔ Three)
      timeline/    globale Animationsuhr, Segment-Mapping
    store/         Zustand: play-, ui-, settings-, library-Slices
    views/
      top/         Draufsicht (Konva)
      net/         Netzansicht (Konva): frontaler Blick aufs Netz
      three/       3D-Szene, Kamera-Rig, PlayerMesh-Factory
    components/    Playbar, Toolbar, Dialoge, Bibliothek, Einstellungen
    theme/         CSS-Variablen (Farben, Touch-Größen)
```

### Ein Weltkoordinatensystem (Meter)
- **Ursprung:** Feldmitte unter dem Netz.
- **Achsen:**
  - `x` läuft entlang der Feldlänge von −9 bis +9. Das Netz liegt bei x = 0.
  - `y` läuft entlang der Breite von −4,5 bis +4,5.
  - `z` ist die Höhe.
- **Angriffslinien:** x = ±3.
- **Adapter:** Alle Umrechnungen stehen nur in `core/geometry`:
  - `worldToTop(px/m-Skalierung)`
  - `worldToThree(x, y, z) → (x, z, −y)`, weil Three „y-up“ verwendet.
- **Gemeinsame Datenquelle:** Alle drei Ansichten lesen denselben Store. Daraus ergibt sich die Synchronität automatisch.

### Design
- **Farben** liegen als CSS-Variablen vor und werden für Konva und Three als Konstanten exportiert:
  - Hintergrund `#121214` / `#0b0b0d`
  - Panels `#1c1c20`
  - Feldlinien grau `#6b6b70`
  - Akzent und Flugbahn in der Standardfarbe (aktuell Sand `#d8c8a8`, festgelegt nur in `theme/defaultColor.ts`), Fade per Alpha
- **Bedienung:** Touch-Ziele sind mindestens 44 px groß, Drag-Handles haben einen Trefferradius von etwa 24 px. Das Layout ist für Querformat optimiert.

---

## 2. Flugbahn-Modell (Kern, `core/physics`)

### Gespeicherte Form (kanonisch)
Pro Flugbahn:
```ts
{ type: 'annahme'|'zuspiel',
  start: {x, y, h},        // h = Starthöhe
  dir: {dx, dy},           // Einheitsvektor in der Draufsicht
  apexH: number,           // absolute Scheitelhöhe
  hitDist: number, hitH: number }  // Schlagpunkt (Distanz entlang dir, Höhe)
```

**Abgeleitet und nie gespeichert** werden:
- die Parabelkonstante `k`
- die Scheiteldistanz `sA`
- die Geschwindigkeiten `vH` und `vZ0`
- die Flugdauer
- der Bodenaufprall
- der Endpunkt in der Draufsicht: `start + dir·hitDist`

Beim Zuspiel werden `start` (mit Höhe) nicht gespeichert, sondern immer aus dem Schlagpunkt der Annahme abgeleitet, falls eine Annahme existiert.

### Mathematik
Profil entlang der Flugbahn mit `s` als Distanz und `z` als Höhe: `z(s) = apexH − k·(s − sA)²`.
- **Parabel aus den Eingaben:** Start (0, h0), Schlagpunkt (D, h1) auf dem fallenden Ast und Scheitel apexH ≥ max(h0, h1) ergeben:
  - `k = ((√(apexH−h0) + √(apexH−h1)) / D)²`
  - `sA = √((apexH−h0)/k)`
- **Physik** mit g = 9,81:
  - `vZ0 = √(2g(apexH−h0))`
  - `vH = √(g/(2k))`
  - `t(s) = s / vH`
  - Bodenaufprall bei `sGround = sA + √(apexH/k)`
- **Funktionen:** `solveTrajectory()`, `heightAt(s)`, `positionAt(t)`, `duration()`, `groundImpact()`, `projectToParabola(point) → s`. Die letzte dient zum Verschieben des Schlagpunkts.

### Klemmregeln
- `apexH ≥ max(h0, h1) + ε` mit ε = 0,05 m. Damit liegt der Scheitel automatisch über der Verbindungslinie Start→Schlagpunkt, und es gibt keine entartete Gerade mit unendlicher Geschwindigkeit.
- Der Schlagpunkt liegt nur auf dem fallenden Ast: `sA ≤ hitDist ≤ sGround`.
- D < 0,2 m wird abgelehnt, die Eingabe gilt dann als Klick und nicht als Bahn.
- Die Starthöhe liegt zwischen 0 und etwa 6 m. Der Scheitel ist oben nur durch die Anzeige begrenzt, maximal etwa 15 m.

### Neue Flugbahn
- `h0` kommt aus dem Standard für den jeweiligen Typ.
- `h1` ist bei der Annahme die „Standard-Endhöhe Annahme“ und beim Zuspiel die „Standard-Schlagpunkthöhe“.
- `apexH = max(h0 + ΔScheitel, h1 + 0,3)`. Die Klemmung ist nötig, weil z. B. eine Annahme von 0,8 m mit +1 m auf 1,8 m käme und damit unter einem Ende bei 2,5 m läge.

### Handle-Tabelle (was bewegt sich, was bleibt fix)
| Drag | Ändert | Fix | Danach |
|---|---|---|---|
| Startpunkt (Draufsicht) | start.xy | Endpunkt-xy, h0, apexH, h1 | dir und D neu, Parabel neu lösen |
| Endpunkt (Draufsicht) | dir, hitDist | start, h0, apexH, h1 | neu lösen |
| Starthöhe (Seite) | h0 | D, h1, apexH (geklemmt) | neu lösen |
| Scheitel (Seite, nur vertikal) | apexH | Start, Schlagpunkt | neu lösen, live, Commit beim Loslassen |
| Schlagpunkt (Seite) | hitDist, hitH = z(hitDist) | Parabel (k, sA, apexH) | Endpunkt in der Draufsicht wandert entlang dir |
| Annahme-Schlagpunkt | wie oben | – | Der Zuspiel-Start folgt. Das Zuspiel behält sein eigenes Ziel-xy, h1 und apexH und wird neu gelöst. |

### Tests (Vitest)
- Die Kurve geht exakt durch Start und Schlagpunkt.
- Der Scheitel ist das Maximum, und an der Stelle sA ist z′ = 0.
- `positionAt(duration)` ergibt den Schlagpunkt.
- `vZ0` und `vH` sind konsistent mit g.
- Die Klemmregeln greifen, z. B. bei apexH unterhalb von max(h0, h1).
- Bei Grenzfällen (h0 = apexH, h1 = 0, sehr kurzes oder langes D) entsteht kein NaN.
- `projectToParabola` ist monoton und bleibt im Bereich.
- Die Koppelung Annahme→Zuspiel funktioniert.

---

## 3. Eingabe-Policy (Pointer Events)
- **Grundeinstellung:** Auf allen Canvas-Flächen gilt `touch-action: none`. Es werden ausschließlich Pointer Events mit Pointer Capture verwendet.
- **Klick oder Ziehen:**
  - Die Bewegungsschwelle liegt bei 6 px für Maus und Stift und bei 12 px für den Finger.
  - Bleibt man unter der Schwelle, zählt es als Klick. Der erste Klick setzt den Start mit Vorschau-Linie zum Cursor, der zweite das Ende.
  - Über der Schwelle wird die Bahn in einem Zug von Start bis Ende gezogen.
- **Stift** (`pointerType === 'pen'`): Er zeichnet Bahnen und zieht Handles. Für Spieler gilt dasselbe.
- **Finger:**
  - Er zieht Handles und Spieler nur, wenn er direkt auf einem Handle startet.
  - Auf leerem Feld zeichnet der Finger keine Bahn, damit man nichts versehentlich verschiebt.
  - Der Modus „Finger zeichnet“ lässt sich als Option in den Einstellungen einschalten.
  - Zwei Finger haben in den 2D-Ansichten keine Funktion. Erst in Phase 3 kommt eventuell Zoom dazu.
- **Maus:** Sie verhält sich wie der Stift.
- **Tastatur:** Esc bricht eine laufende Eingabe ab, Entf löscht die ausgewählte Bahn.

## 4. Animation & Zeit
- **Eine globale Uhr** in `core/timeline`:
  - Die Gesamtdauer ist die Summe der sichtbaren Segmente, nämlich Annahme und danach Zuspiel, abhängig von den Toggles.
  - `t → (Segment, lokales t) → Ballposition`.
  - Die Uhr treibt die 3D-Ansicht und beide 2D-Ansichten, gesteuert über `requestAnimationFrame`.
- **Geschwindigkeit:** 0,25×, 0,5×, 1×, 2× oder 4× als Multiplikator auf die Echtzeit.
- **Wiedergabe:** Schleife oder einmaliger Durchlauf.
- **Scrubbing:** Die Playbar lässt sich im pausierten Zustand ziehen.
- **Frame-Schritt:** Ein Frame ist fest 1/60 s Physikzeit, unabhängig vom Tempo. Mit ←/→ schaltet man vor und zurück, wenn die Playbar pausiert und fokussiert ist.

## 5. Persistenz
Der Main-Prozess schreibt JSON nach `app.getPath('userData')`:
- `settings.json`
- `teams.json`
- `plays/<uuid>.json`
- `plays/index.json` mit Kürzel, Titel und Datum für die schnelle Bibliothek

Details:
- **Atomares Schreiben:** Zuerst in eine temporäre Datei, dann umbenennen.
- **Versionierung:** Jedes Dokument hat ein Feld `schemaVersion` plus einen Migrations-Hook.
- **Zugriff:** Der Renderer greift nur über `window.api` per IPC zu und hat keinen Node-Zugriff (`contextIsolation`).
- **Bewusst kein SQLite,** weil das ein natives Modul bräuchte, was beim Installer Ärger macht, und weil der Umfang klein ist.

## 6. Export
- **PDF** wird mit jsPDF im Renderer erzeugt:
  - Die 2D-Ansichten kommen über `stage.toDataURL({pixelRatio: 2})`.
  - Für 3D wird in ein Offscreen-`WebGLRenderer` mit festen Kamera-Presets gerendert (Seite, Hinter dem Angreifer, 45°, Oben) und daraus `toDataURL` gezogen.
  - Gespeichert wird über IPC nach `Dokumente\Volleyball-Spielzüge\<Kürzel>.pdf`, danach kommt „Im Ordner anzeigen“. So braucht es keinen Dateidialog.
- **Video:**
  - Die Aufnahme läuft über `canvas.captureStream()` und `MediaRecorder` und spielt die Timeline in Echtzeit ab.
  - Das Format wird zur Laufzeit geprüft: Zuerst `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')`, sonst WebM (VP9/VP8).
  - MP4 wird nicht garantiert.

---

## 7. Phasen

### Phase 1: Setup, Feld 2D und 3D, Kamera, Theme (wird nach Freigabe umgesetzt)
1. **Projekt anlegen:**
   - `git init` ist schon erledigt, dazu kommt eine `.gitignore`.
   - Scaffold mit electron-vite react-ts, Abhängigkeiten installieren: konva, react-konva, three, @types/three, zustand, vitest.
   - npm-Scripts `dev`, `build`, `test`, `dist`.
2. **Grundlagen:**
   - `shared/`-Typen als Gerüst
   - `core/geometry/court.ts` mit den Maßen und Netzhöhen-Presets (2,43 / 2,24 / 2,35 m plus frei)
   - Koordinaten-Adapter
   - erste Vitest-Tests für die Adapter
3. **Theme:** CSS-Variablen und eine dunkle App-Shell mit Toolbar und Split-Layout. Links ist die Draufsicht, rechts ist Platz für die Seitenansicht bzw. die 3D-Ansicht. Ein Umschalter wechselt zwischen 2D-Split, nur einer Ansicht und 3D.
4. **Draufsicht (Konva):**
   - Feld 18 × 9 mit Netz, Mittellinie und Angriffslinien in dezentem Grau, dazu etwas Freizone.
   - Es skaliert responsiv und bleibt maßstabstreu.
5. **Seitenansicht als Platzhalter:** Höhe und Distanz als Achsen, Netz mit gewählter Netzhöhe als Referenz. Die echten Flugbahnen kommen in Phase 3.
6. **3D (Three.js):**
   - Boden, Feldlinien, Netz mit Pfosten und Antennen, alles in echten Maßen.
   - `OrbitControls` mit `minPolarAngle = 0` (senkrecht von oben) und `maxPolarAngle = π/2 − 0,02` (Augenhöhe).
   - Das Kamera-Target wird auf z ≥ 0 geklemmt, damit die Kamera nie unter das Feld kommt.
   - Drehen um 360°, Zoom mit Min/Max-Distanz, Verschieben; Touch und Stift funktionieren über Pointer Events.
7. **Netzhöhe:** Ein Preset-Auswahlfeld plus Slider ändert die Höhe live in 2D-Seitenansicht und 3D.
8. **Abschluss:** Zusammenfassung und Testanleitung für das Surface (`npm run dev`, Touch-Orbit, Stift-Orbit).

### Phase 2: Spieler & Teams
- **Teamverwaltung:** Dialog und Store mit beliebig vielen Teams. Jeder Spieler hat Name, Nummer und mehrere Positionen. Das Speichern über IPC (`teams.json`) wird hier schon gebaut.
- **Spielzug:**
  - Pro Seite wählt man ein Team (Seite B optional) und welche bis zu 6 Spieler sichtbar sind.
  - Jeder Spieler hat eine Rolle für das Kürzel, die rein optisch ist.
- **Draufsicht:** Kreise mit Kürzel und Rückennummer, frei ziehbar, Start in Standard-Aufstellung.
- **3D:** Zylinder über eine `PlayerMeshFactory`-Schnittstelle, damit später echte Modelle eingesetzt werden können.

### Phase 3: Flugbahnen, Physik und Netzansicht
> Entschieden: Höhen-Griffe in der Netzansicht (Start/Scheitel senkrecht, Schlagpunkt entlang der Parabel) plus Flugbahn-Karte mit Schiebereglern (auch in 3D). Gespeichert wird je Bahn start{x,y,h}, end{x,y} (= Schlagpunkt), apexH, hitH.
- Das Modul `core/physics` mit allen Tests aus Abschnitt 2 wird zuerst geschrieben.
- Eingabe in der Draufsicht nach der Policy aus Abschnitt 3, für Annahme und Zuspiel jeweils ein Werkzeug.
- **Höhen-Bearbeitung (Netzansicht + Flugbahn-Karte):**
  - Handles für Starthöhe, Scheitel und Schlagpunkt, live gelöst.
  - Die Checkbox „Flugbahn nach Schlagpunkt anzeigen“ zeigt den Rest gestrichelt bzw. verblasst.
- Toggles für Annahme und Zuspiel.
- Flugbahnen in der Netzansicht (projiziert auf die Netzebene) und in 3D als Tube oder Linie, jeweils in der Standardfarbe.
- Einstellungsdialog mit allen Standardhöhen, dauerhaft gespeichert.

### Phase 4: Animation & Playbar
- Timeline-Uhr, Ball als Kugel in 3D und als Punkt in beiden 2D-Ansichten.
- Abspielen und Pause, Schleife, Tempostufen, Scrubbing und Frame-Schritt mit den Pfeiltasten.
- Standards für Schleife und Tempo kommen aus den Einstellungen.

### Phase 5: Speichern & Bibliothek
- Speichern-Dialog mit Kürzel und Titel.
- Bibliotheksansicht mit Suche und Filter nach Kürzel und Titel; man kann öffnen, umbenennen, duplizieren und löschen (mit Bestätigung).
- Gespeichert werden Team-Referenz plus Snapshot, Spielerpositionen, alle Bahnen, Netzhöhe und Anzeige-Optionen.

### Phase 6: Export
- PDF wie in Abschnitt 6 beschrieben.
- Video-Export mit Fortschrittsanzeige.

### Phase 7: Installer & Feinschliff
- electron-builder mit NSIS-Target, Startmenü- und Desktop-Verknüpfung, App-Icon.
- Pass über alle Touch-Größen, Test auf dem Surface und Performance-Check.

---

## Verifikation (je Phase)
- **Automatisch:**
  - `npm test` lässt Vitest laufen, die Physik ist ab Phase 3 der Schwerpunkt.
  - `npm run build` prüft den Typecheck und den Build.
- **Manuell:**
  - Mit `npm run dev` startet die App, sie wird mit der Maus geprüft und nach jeder Phase auf dem Surface.
  - Jede Phase endet mit einer kurzen Checkliste für Stift, Finger und Maus.
  - Phase 1 heißt konkret: Feld maßstabstreu, Netzhöhe live, Kamera in 3D nie unter dem Feld, 360° drehbar, Zoom und Pan per Touch und Stift.
- **Ab Phase 7:** `npm run dist` erzeugt den Installer unter `dist/`. Danach wird er auf dem Surface installiert und über das Startmenü gestartet.
