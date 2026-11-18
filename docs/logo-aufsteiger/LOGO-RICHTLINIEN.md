# Aufsteiger – Logo-Richtlinien

**Idee:** Annahme, Zuspiel, Angriff. Drei Punkte liegen auf einer steigenden Flugbahn und wachsen mit jedem Kontakt.
Der dritte Punkt ist der rote Ball. So zeigt das Zeichen einen Spielzug und zugleich den Aufstieg nach oben rechts.
Alles besteht aus drei Kreisen auf einer echten Wurfparabel. Die Radien stehen etwa im Verhältnis 1 : 1,6 : 2,6, und die Lücken zwischen den Kreisrändern sind gleich groß.

Das alte V-Ball-Kit (`docs/logo-kit`) bleibt als Archiv erhalten.

## Dateien

| Ordner | Inhalt |
|---|---|
| `master/` | Masterdateien (SVG): Symbol hell, dunkel und schwarz, Kleinversion hell und dunkel, horizontales und gestapeltes Logo (hell und dunkel), Schriftzug (hell und dunkel), App-Icon |
| `symbol/` | Symbol einfarbig (schwarz, weiß, rot), quadratisch, App-Icon (SVG und PNG 64/256/1024), Favicon-Set (`favicon.ico`, `favicon.svg`, 16/32/48 px), Web-Icons (192/512, maskable, apple-touch, `site.webmanifest`, `head-snippet.html`) |
| `lockups/` | Horizontales und gestapeltes Logo einfarbig (SVG und PNG 1200) |
| `praesentation.html`, `praesentation/` | Präsentationsbogen mit Mockups (HTML und PNG je Folie) |
| `konzepte/`, `konzepte-uebersicht.png` | Die 10 Konzepte der ersten Runde (D = Flugbahn wurde gewählt) |
| `quelle/build_logo.py` | Erzeugt alle Master neu (`python quelle/build_logo.py master`) |

## Farben

| Rolle | HEX | RGB | CMYK (Näherung) |
|---|---|---|---|
| Tinte (Punkte und Schrift auf hell) | `#18181B` | 24 · 24 · 27 | 0 · 0 · 0 · 90 |
| Ball (Akzent, = App-Rot) | `#E5484D` | 229 · 72 · 77 | 0 · 75 · 60 · 0 |
| Hell (Punkte und Schrift auf dunkel) | `#F4F4F5` | 244 · 244 · 245 | 0 · 0 · 0 · 4 |

Für den Druck den Pantone-Ton am Farbfächer abstimmen. Die CMYK-Werte sind nur ein Ausgangspunkt.
Der große Punkt ist immer rot. Nur in der einfarbigen Fassung haben alle drei Punkte dieselbe Farbe (schwarz, weiß oder rot).

## Versionen

- **Symbol:** für App-Icon, Favicon, Avatare und überall, wo wenig Platz ist.
- **Horizontal:** der Standard für Kopfzeilen, Website und Dokumente.
- **Gestapelt:** für quadratische oder hohe Flächen wie Poster, Startbildschirm oder Merchandise.
- **Schriftzug allein:** nur dort, wo das Symbol schon in der Nähe steht (z. B. Fußzeile unter dem App-Icon).
- **Kleinversion** (`af-symbol-klein*.svg`): größere Punkte und weiter gespreizt, damit der kleinste Punkt nicht verschwindet. Für alles **unter 48 px**. Favicons, App-Icon und Web-Icons nutzen sie bereits.

## Schutzraum und Mindestgrößen

- **Schutzraum** rundum: ein Durchmesser des roten Balls (beim Symbol in 256er-Größe 84 Einheiten). In diesem Bereich steht nichts anderes.
- **Symbol:** mindestens 16 px. Unter 48 px die Kleinversion verwenden.
- **Horizontales Logo:** mindestens 140 px breit. Darunter nur das Symbol verwenden.
- **Gestapeltes Logo:** mindestens 100 px breit.

## Hintergründe

- Hell (Weiß bis `#F4F4F5`): Tintenfassung `af-symbol.svg` bzw. `af-horizontal.svg`.
- Dunkel (`#18181B` und dunkler, auch die App-Oberfläche): helle Fassung `*-dunkel.svg`.
- Fotos oder unruhige Flächen: einfarbig weiß oder schwarz verwenden, und nur auf einer ruhigen Stelle.
- Nicht auf Rot setzen, weil der Ball dort verschwindet. In diesem Fall einfarbig weiß verwenden.

## Nicht erlaubt

- Die Punkte verschieben, neu anordnen, in der Größe angleichen oder einen Punkt weglassen.
- Das Zeichen drehen oder spiegeln. Die Bahn steigt immer nach rechts oben.
- Den Ball anders als rot einfärben (außer in der einfarbigen Fassung) oder die kleinen Punkte rot färben.
- Eine Linie für die Flugbahn ergänzen, ebenso Schatten, Verläufe, Konturen oder Glanzeffekte.
- Den Schriftzug in einer anderen Schrift neu setzen.
- Das horizontale Logo unter 140 px Breite einsetzen.

## Technische Hinweise

- Der Schriftzug ist eine eigene Linienschrift aus Pfaden. Es gibt keine Schriftdatei und damit keine Lizenzfrage. Die Buchstaben sind als **Striche** mit runden Enden gebaut. Für Druckereien, die reine Flächen verlangen, in Inkscape oder Illustrator „Kontur in Pfad umwandeln“ ausführen.
- Geprüft wurde die Darstellung bei 16, 24, 32, 48 und 64 px, einfarbig, auf der dunklen App-Kachel und in den Mockups (App-Icon, Browser-Tab, Website, Profilbild, T-Shirt, Sticker).
- Das App-Icon der Anwendung (`build/icon.png`, 512 px) ist `master/af-app-icon.svg` mit 8 Einheiten transparentem Rand (wie zuvor).
- Eine Markenrecherche wurde **nicht** gemacht. Vor öffentlicher oder kommerzieller Nutzung in den Registern von DPMA und EUIPO sowie per Bildersuche prüfen.
