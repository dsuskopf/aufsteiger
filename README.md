# Aufsteiger

Volleyball-Playbook für Windows: Spielzüge planen, zeichnen und in 2D/3D abspielen – komplett offline.

## Installieren (ohne Vorkenntnisse)

1. Auf der Seite **Releases** (rechts auf der GitHub-Startseite des Projekts) die neueste Version öffnen.
2. Unter „Assets“ die Datei **`Aufsteiger-Setup-….exe`** herunterladen.
3. Die Datei doppelklicken und dem Installer folgen.
4. Falls Windows „Der Computer wurde durch Windows geschützt“ anzeigt: auf **Weitere Informationen** → **Trotzdem ausführen** klicken.
   (Die App ist nicht kostenpflichtig signiert, deshalb warnt Windows bei neuen Programmen.)

Danach startet Aufsteiger über die Desktop-Verknüpfung oder das Startmenü.

## Neue Version veröffentlichen (für Entwickler)

```
git tag v0.1.1
git push origin v0.1.1
```

GitHub Actions baut dann den Installer und hängt ihn an ein neues Release an
(`.github/workflows/installer.yml`). Vorher die Version in `package.json` anpassen.

Selbst bauen: `npm install` und `npm run dist` – der Installer liegt danach in `dist/`.
