# Aufsteiger

Volleyball-Playbook für Windows: Spielzüge planen, zeichnen und in 2D/3D abspielen – komplett offline.

## Installieren (ohne Vorkenntnisse)

1. Auf der Seite **Releases** (rechts auf der GitHub-Startseite des Projekts) die neueste Version öffnen.
2. Unter „Assets“ die Datei **`Aufsteiger-Setup-….exe`** herunterladen.
3. Die Datei doppelklicken und dem Installer folgen.
4. Falls Windows „Der Computer wurde durch Windows geschützt“ anzeigt: auf **Weitere Informationen** → **Trotzdem ausführen** klicken.
   (Die App ist nicht kostenpflichtig signiert, deshalb warnt Windows bei neuen Programmen.)

Danach startet Aufsteiger über die Desktop-Verknüpfung oder das Startmenü.

## Updates

Aufsteiger schaut beim Start selbst nach, ob es eine neue Version gibt, und bietet sie an.
Ein Klick auf **Jetzt aktualisieren** lädt sie herunter, installiert sie und startet die App neu –
Spielzüge, Teams und Einstellungen bleiben erhalten. Von Hand geht es unter Einstellungen → Version & Update.

## Neue Version veröffentlichen (für Entwickler)

```
git tag v0.1.1
git push origin v0.1.1
```

GitHub Actions baut dann den Installer und hängt ihn an ein neues Release an
(`.github/workflows/installer.yml`). **Vorher die Version in `package.json` erhöhen** – das Tag muss dazu
passen (`v0.1.1` ↔ `"version": "0.1.1"`), sonst bricht der Build ab. Installierte Apps finden die neue Version
über `latest.yml` im Release.

Selbst bauen: `npm install` und `npm run dist` – der Installer liegt danach in `dist/`. Eine so gebaute App
holt Updates weiterhin aus dem Projektordner (Update-Button bzw. `Update.cmd`), nicht aus GitHub.
