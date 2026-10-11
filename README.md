# 🏚️ Onkel Ottos Testament · Otto Amca'nın Vasiyeti

Ein chaotisches Erbschafts-Partyspiel für **2 bis 15 Spieler**. Der Fernseher zeigt die Villa, jedes Handy ist eine geheime Kartenhand. Spielbar auf **Deutsch** und **Türkisch**.

**Drin:** 100 Testamentsklauseln · 24 Aktionskarten · 14 Minispiele · 6 geheime Rollen · Porträtfotos statt Emojis · geheimer Privat- und Familienchat · eigene Musik · über 40 Soundeffekte · natürliche Notar-Stimme auf Deutsch und Türkisch · türkische Bot-Verwandte

*2 ile 15 oyuncu için kaotik bir miras oyunu. Televizyon konağı gösterir, her telefon gizli bir kart elidir. **Almanca** ve **Türkçe** oynanabilir.*

## Starten · Başlatma

Voraussetzung: [Node.js](https://nodejs.org) ab Version 18. Keine weiteren Pakete nötig, das Spiel läuft auch offline im WLAN.

```bash
npm install
npm start
```

Dann:

1. Auf dem Computer **http://localhost:3000** öffnen und **„Spiel eröffnen“** wählen (am besten auf dem Fernseher).
2. Alle Handys im **selben WLAN** scannen den QR-Code oder öffnen die angezeigte Adresse.
3. Namen eingeben, beitreten, **„Spiel starten“**.

*Bilgisayarda **http://localhost:3000** adresini aç, **„Oyunu aç“** seç. Aynı Wi-Fi'deki telefonlar QR kodu tarar. İsim gir, katıl, **„Oyunu başlat“**.*

## Inhalt

| Datei | Inhalt |
|---|---|
| [`public/docs/REGELWERK.md`](public/docs/REGELWERK.md) | Komplettes Regelwerk (Deutsch) |
| [`public/docs/KURALLAR.md`](public/docs/KURALLAR.md) | Tam oyun kuralları (Türkçe) |
| [`public/docs/KLAUSELN.md`](public/docs/KLAUSELN.md) | Alle 100 Testamentsklauseln, zweisprachig |
| `http://localhost:3000/regeln` | Regelwerk und Klauseln im Browser |

## Probleme? · Sorunlar?

- **Handys kommen nicht rein:** Sind alle im selben WLAN? Die Firewall des Computers muss Node.js im privaten Netzwerk erlauben (Windows fragt beim ersten Start nach). Gast-WLANs blockieren oft Verbindungen zwischen Geräten.
- **Falsche Adresse im QR-Code:** Öffne den Fernseher-Bildschirm über die IP-Adresse, die im Terminal steht (z. B. `http://192.168.0.23:3000`), dann übernimmt der QR-Code genau diese Adresse.
- **Port belegt:** `PORT=3001 npm start` (Windows PowerShell: `$env:PORT=3001; npm start`).
- **Kein Ton / keine Stimme:** Einmal auf den Fernseher-Bildschirm klicken; Browser erlauben Ton erst nach einer Interaktion. Musik 🎵, Soundeffekte 🔊 und Notar-Stimme 🗣️ lassen sich oben rechts einzeln an- und ausschalten.
- **Kamera öffnet sich nicht live:** Browser erlauben die Live-Kamera nur über **https** (z. B. auf Render) oder `localhost`. Im Heim-WLAN über `http://192.168…` öffnet der Knopf „Foto machen“ stattdessen die normale Kamera-App des Handys. Das Ergebnis ist dasselbe.
- **Handy verloren / Seite neu geladen:** Einfach dieselbe Seite wieder öffnen, das Spiel verbindet automatisch neu.

## Für Entwickler

| Befehl | Zweck |
|---|---|
| `npm start` | Server starten (Port 3000) |
| `npm run dev` | Server mit automatischem Neustart bei Änderungen |
| `npm test` | Simuliert 140 komplette Partien mit 2–15 Bots und prüft alle Übersetzungen |
| `npm run docs` | Erzeugt `KLAUSELN.md` neu aus den Spieldaten |
| `npm run voice` | Erzeugt die Notar-Stimme neu (nur für neue Texte nötig, siehe unten) |

Aufbau:

```
server/index.js    HTTP-Server, Räume, Verbindungen
server/game.js     Spiel-Engine (Phasen, Räume, Karten, Duelle, Finale)
server/ws.js       WebSocket-Server ohne Abhängigkeiten
server/qr.js       QR-Code-Generator ohne Abhängigkeiten
shared/data.js     Räume, 24 Karten, 6 Rollen, Erbstücke, Quizfragen, 14 Minispiele, 100 Klauseln
shared/i18n.js     Alle Texte auf Deutsch und Türkisch
public/host.html   Fernseher-Ansicht   (js/host.js, css/host.css)
public/play.html   Handy-Controller    (js/play.js, css/play.css)
public/js/common.js Verbindung, Soundeffekte, Musik-Sequenzer, Notar-Stimme
public/voice/      Notar-Aufnahmen als MP3 (de/, tr/) + manifest.json
```

Neue Klausel hinzufügen: Eintrag in `shared/data.js` (`CLAUSES`) plus Text `clause.<id>` in beiden Sprachen in `shared/i18n.js`. `npm test` meldet fehlende Übersetzungen. Ohne neue Sprachaufnahme wird die Klausel einfach nur angezeigt, nicht vorgelesen.

### Notar-Stimme neu erzeugen

Die Stimme stammt von den freien neuronalen Piper-Stimmen „Thorsten“ (Deutsch) und „Fahrettin“ (Türkisch) und wird **vorab** in MP3-Dateien umgewandelt. Deshalb funktioniert sie in jedem Browser und ohne Internet. Für neue Texte:

1. [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx/releases) für dein System herunterladen (z. B. `sherpa-onnx-v1.12.40-win-x64-static.tar.bz2` oder `…-linux-x64-static…`) und entpacken.
2. Auf derselben Seite unter dem Tag **tts-models** die Stimmen `vits-piper-de_DE-thorsten-high.tar.bz2` und `vits-piper-tr_TR-fahrettin-medium.tar.bz2` laden und entpacken.
3. [ffmpeg](https://ffmpeg.org) installieren.
4. Ausführen (Pfade anpassen):
   ```bash
   SHERPA_BIN=/pfad/sherpa-onnx/bin/sherpa-onnx-offline-tts \
   VOICE_DE=/pfad/vits-piper-de_DE-thorsten-high \
   VOICE_TR=/pfad/vits-piper-tr_TR-fahrettin-medium npm run voice
   ```
   Es werden nur geänderte Texte neu aufgenommen.

Zum Testen schneller spielen: `OTTO_TIME_SCALE=0.3 npm start` (alle Wartezeiten × 0,3).
