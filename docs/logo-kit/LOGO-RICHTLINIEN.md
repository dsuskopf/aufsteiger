# Volleyball Playbook – Logo-Richtlinien

**Idee:** Ein V, dessen rechter Arm im Ball endet: der Moment, in dem der Spielzug aufgeht.
Die Schenkel stehen exakt 60° zur Waagerechten, alles besteht aus einem Strich mit runden Enden und einem Kreis.

## Dateien

| Ordner | Inhalt |
|---|---|
| `master/` | Masterdateien (SVG): Symbol hell/dunkel/schwarz, Kleinversion, horizontales und gestapeltes Logo, Schriftzug |
| `symbol/` | Symbol einfarbig (schwarz, weiß, rot), quadratisch, App-Icon (SVG + PNG 64/256/1024), Favicon-Set (`favicon.ico`, `favicon.svg`, 16/32/48 px), Web-Icons (192/512, maskable, apple-touch, `site.webmanifest`, `head-snippet.html`) |
| `lockups/` | Horizontales und gestapeltes Logo einfarbig (SVG + PNG) |
| `praesentation.html`, `praesentation/` | Präsentationsbogen mit Mockups (HTML und PNG je Folie) |
| `quelle/build_logo.py` | Erzeugt alle Master neu (`python quelle/build_logo.py master`) |

## Farben

| Rolle | HEX | RGB | CMYK (Näherung) |
|---|---|---|---|
| Tinte (V, Schrift auf hell) | `#18181B` | 24 · 24 · 27 | 0 · 0 · 0 · 90 |
| Ball (Akzent, = App-Rot) | `#E5484D` | 229 · 72 · 77 | 0 · 75 · 60 · 0 |
| Hell (V, Schrift auf dunkel) | `#F4F4F5` | 244 · 244 · 245 | 0 · 0 · 0 · 4 |

Für den Druck den Pantone-Ton am Farbfächer abstimmen; die CMYK-Werte sind nur ein Ausgangspunkt.
Der Ball ist immer rot, außer in der einfarbigen Fassung. Dort wird alles in einer Farbe gesetzt (schwarz, weiß oder rot).

## Versionen

- **Symbol:** App-Icon, Favicon, Avatare und überall, wo wenig Platz ist.
- **Horizontal:** Standard für Kopfzeilen, Website, Dokumente.
- **Gestapelt:** quadratische oder hohe Flächen (Poster, Startbildschirm, Merchandise).
- **Kleinversion** (`vp-symbol-klein*.svg`): kräftigerer Strich, größerer Ball, breitere Lücke. Für alles **unter 48 px**; Favicons und App-Icons nutzen sie bereits.

## Schutzraum und Mindestgrößen

- **Schutzraum** rundum: ein Balldurchmesser (beim Symbol in 256er-Größe 60 Einheiten). Dort steht nichts anderes.
- **Symbol:** mindestens 16 px (unter 48 px die Kleinversion).
- **Horizontales Logo:** mindestens 120 px Breite; darunter nur das Symbol. Die Zeile VOLLEYBALL wird sonst unlesbar.
- **Gestapeltes Logo:** mindestens 96 px Breite.

## Hintergründe

- Hell (Weiß bis `#F4F4F5`): Tintenfassung `vp-symbol.svg` / `vp-horizontal.svg`.
- Dunkel (`#18181B` und dunkler, auch die App-Oberfläche): helle Fassung `*-dunkel.svg`.
- Fotos oder unruhige Flächen: einfarbig weiß oder schwarz, nur bei ruhigem Untergrund.
- Nicht auf Rot: Der Ball verschwindet. Dann einfarbig weiß.

## Nicht erlaubt

- V oder Ball verzerren, drehen, spiegeln oder den Abstand zwischen beiden ändern.
- Ball in einer anderen Farbe als Rot einfärben (außer einfarbig).
- Schatten, Verläufe, Konturen oder Glanzeffekte hinzufügen.
- Den Schriftzug in einer anderen Schrift neu setzen oder die Zeilen umstellen.
- Das horizontale Logo unter 120 px Breite einsetzen.

## Technische Hinweise

- Der Schriftzug ist eine eigene Linienschrift aus Pfaden (keine Schriftdatei, also keine Lizenzfrage). Die Buchstaben sind als **Striche** mit runden Enden gebaut. Für Druckereien, die reine Flächen verlangen, in Inkscape oder Illustrator „Kontur in Pfad umwandeln“.
- Geprüft: Darstellung bei 16, 24, 32 und 64 px, einfarbig, invertiert, auf der dunklen App-Kachel. Die Winkel sind 60° (V) und 45° (K).
- Eine Markenrecherche wurde **nicht** gemacht. Vor öffentlicher oder kommerzieller Nutzung in DPMA/EUIPO-Registern und per Bildersuche prüfen.
