# Reticle

**Tabletop-Scanner fuer Wargames.** Scanne Marker auf deinen Miniaturen und tracke HP, Zustaende und Statuseffekte direkt auf dem Spielfeld — ohne Zettel, ohne Unterbrechung.

---

## Wie eine Liste importieren

1. Erstelle eine `.json`-Datei nach dem Schema unten (oder nutze `examples/army-sample.json` als Vorlage).
2. Oeffne Reticle auf deinem Geraet.
3. Tippe **JSON importieren** auf dem Setup-Screen.
4. Waehle deine Datei (Datei-Dialog oder Drag & Drop).
5. Pruefe die Vorschau — unklare Eintraege werden orange markiert.
6. Tippe **LISTE UEBERNEHMEN**.

Die Liste ist ab sofort in der App gespeichert und ueberlebt Browser-Neustart und Offline-Modus.

---

## JSON-Schema-Referenz (V1)

```json
{
  "schemaVersion": "1.0",
  "id": "army-1714234567890",
  "name": "My Army",
  "createdAt": "2026-04-27T15:00:00.000Z",
  "units": [
    {
      "id": "unit-001",
      "name": "Intercessors",
      "count": 6,
      "points": 120,
      "status": "active",
      "scannedAt": null
    }
  ]
}
```

### Pflichtfelder

| Feld | Typ | Beschreibung |
|---|---|---|
| `schemaVersion` | string | Immer `"1.0"` fuer V1 |
| `name` | string | Armeebezeichnung |
| `units` | array | Mind. 1 Einheit |
| `units[].name` | string | 1–100 Zeichen. Leer → Eintrag wird uebersprungen |
| `units[].count` | integer ≥ 1 | Anzahl Modelle |
| `units[].points` | integer ≥ 0 | Punktwert |

### Optionale Felder

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | string | Wird generiert wenn fehlt |
| `createdAt` | ISO-8601 | Wird gesetzt wenn fehlt |
| `units[].id` | string | Wird generiert wenn fehlt |
| `units[].status` | string | `active` / `reduced` / `fallen` / `unclear` |
| `units[].scannedAt` | ISO-8601 \| null | Gesetzt durch Paeckchen 3 |
| `totalPoints` | number | Wird vom Validator berechnet, Eingabe ignoriert |

### Validator-Verhalten

| Situation | Ergebnis |
|---|---|
| `units[]` fehlt oder leer | Import abgebrochen, Fehlermeldung |
| `units[].name` leer | Eintrag uebersprungen, Zaehler "+N uebersprungen" |
| `count` fehlt oder < 1 | Auf 1 gesetzt, Status `unclear`, orange markiert |
| `points` fehlt oder negativ | Auf 0 gesetzt, Status `unclear`, orange markiert |
| Unklare Eintraege | Import moeglich — nach Uebernahme korrigierbar |

---

## Designsystem

Reticle nutzt das Devcany-Designsystem: schwarz / Neongelb / Neon-Rot.

| Token | Wert | Verwendung |
|---|---|---|
| `--bg` | `#0a0a0a` | Seitenhintergrund |
| `--bg-elevated` | `#111` | Header, Cards |
| `--border` | `#1a1a1a` | Trennlinien |
| `--border-accent` | `#2a2a1a` | Akzent-Trennlinien |
| `--text-primary` | `#ffffff` | Haupttext |
| `--text-secondary` | `#888888` | Sekundaertext |
| `--text-tertiary` | `#555555` | Deaktiviert |
| `--text-muted` | `#666666` | Hints |
| `--accent` | `#d4ff00` | Neongelb — CTA, Titel |
| `--loss` | `#ff2e4d` | Neon-Rot — Verluste, Fehler |
| `--warn` | `#ff8c42` | Orange — Warnungen |

---

## Wie der Detektor funktioniert

### Kurz

`detector.js` nimmt ein `ImageData`-Objekt (RGBA, von canvas) und liefert eine strukturierte Antwort:

```
detectMarkers(imageData)
  → [{ id, corners, diagonal }, ...]   sortiert nach Größe ↓

markersToUnits(markers, army)
  → { status: 'found' | 'none', matches: [{ unitId, modelIndex, markerId, diagonal }] }
```

### Ablauf

1. `AR.Detector.detect(imageData)` (aus `vendor/aruco.js`) sucht quadratische Konturen im Bild.
2. Für jede gefundene Kontur: adaptiver Threshold → homografische Entzerrung → Hamming-Dekodierung → Marker-ID.
3. Ergebnisse werden nach Pixeldiagonale absteigend sortiert (größter = nächster zur Kamera = wahrscheinlichster Treffer).
4. `markersToUnits()` gleicht die IDs gegen `army.markerMapping.entries` ab. Nicht gematchte IDs werden gefiltert und geloggt.
5. Bei mehreren Treffern: alle zurückgeben — Auswahl-UX kommt in P3c.

### DevTools-Test

```
detectMarkers → 1 Marker erkannt: ID 0 (⌀ 84.0 px)
markersToUnits → status: found | Matches: [{ unitId: 'unit-001', markerId: 0, ... }]
```

### Interaktiver Browser-Test

Öffne `examples/test-photos/detector-test.html` über einen lokalen Webserver:

```bash
cd reticle && python3 -m http.server 8080
# → http://localhost:8080/examples/test-photos/detector-test.html
```

Seite lädt die 4 Test-PNGs und führt `detectMarkers` + `markersToUnits` aus. Ergebnisse erscheinen direkt und in der Browser-Konsole.

### Test-Bilder (`examples/test-photos/`)

| Datei | Inhalt | Erwartetes Ergebnis |
|---|---|---|
| `test-single.png` | Marker ID 0 auf weissem Grund | `found` — unit-001 |
| `test-multi.png` | Marker IDs 0, 1, 2 nebeneinander | `found` — 3 Matches, nach Groesse sortiert |
| `test-none.png` | Kein Marker, Gitternetz | `none` |
| `test-foreign.png` | Marker ID 99 (nicht im Mapping) | `none` (Detektor erkennt, Mapping filtert) |

### Technisches

- `vendor/cv.js` + `vendor/aruco.js` werden als Globals vor dem ES-Modul geladen (`<script src="...">`).
- `AR.Detector`-Instanz wird lazy erzeugt und wiederverwendet (teurer Konstruktor).
- `detectMarkers` laeuft nur bei Tap auf Auslöser — kein Live-Inferenz-Overhead.
- Ziel-Latenz: unter 500ms auch auf älteren Mittelklasse-Smartphones.

---

## Scan benutzen

### Voraussetzungen

- HTTPS-Kontext (GitHub Pages erfullt das automatisch; lokal: `localhost` reicht auch)
- Geraet mit Kamera (Android-Chrome oder iOS-Safari)
- Armeeliste muss geladen sein (optional, aber empfohlen)

### Ablauf

1. **Liste laden** (Import oder manuell) und zum Dashboard navigieren.
2. **"SCAN STARTEN"** tippen — der Browser fragt einmalig nach Kamera-Erlaubnis.
3. **Permission erteilen** → Live-Kamera-Feed füllt den Bildschirm, Eckmarker leuchten auf.
4. **Auslöser tippen** (runder Neongelb-Button unten mittig) → kurzer weißer Flash, Frame wird als Canvas gespeichert.
   - Das Bild ist in der Browser-Konsole sichtbar: `[Reticle] Frame captured`.
5. **Zurueck-Pfeil** (oben links) → Stream stoppt sofort (Akku-LED am Geraet erlischt), zurück zum Dashboard.

### Permission verweigert

Falls die Kamera-Erlaubnis abgelehnt wurde:

1. Den Hinweis-Screen mit "Erneut versuchen" antippen — der Browser fragt erneut.
2. Schlaegt das fehl: Kamera-Berechtigung in den Browser-Einstellungen manuell erteilen
   (Android: Einstellungen → Apps → Chrome → Berechtigungen; iOS: Einstellungen → Safari → Kamera).

### Hinweise fuer Entwickler

- `scan.js` exportiert `initScanScreen({ onCapture, onBack })` und `stopCamera()`.
- `onCapture(imageData, canvas)` liefert ein `ImageData`-Objekt der vollen Sensor-Aufloesung.
- P3b haengt die ArUco-Erkennung direkt in den `onCapture`-Callback.
- iOS-Safari benoetigt `playsinline` auf dem `<video>`-Element (bereits gesetzt).

---

## Marker drucken und kleben — Anleitung in 5 Schritten

1. **Liste laden** — oeffne Reticle und lade deine Armeeliste.
2. **"Marker drucken" tippen** — der Button erscheint auf dem Listen-Bildschirm.
3. **Modus und Groesse waehlen** — "Pro Einheit" (ein Marker pro Einheit) oder "Pro Modell" (ein Marker pro Miniatur). Groesse: Small 6 mm / Medium 8 mm / Large 12 mm.
4. **Drucken** — Browser-Druck-Dialog oeffnet sich (`Strg+P` / `Cmd+P`). Papier: A4, Rand 5 mm, Hintergrundgrafiken aktiviert.
5. **Ausschneiden und kleben** — Marker an den Hilfslinien ausschneiden, unter die Base kleben (Klebesticker oder doppelseitiges Klebeband).

**Marker-Format:** Original ArUco (js-aruco), 5x5 Datenbits, 7x7 Raster total. Kompatibel mit P3-Scan-Flow.

**Mapping-Persistenz:** Einmal generierte Marker-IDs werden gespeichert und bleiben stabil — auch wenn du die Liste erweiterst. Neue Einheiten bekommen die naechste freie ID.

---

## Paeckchen-Status

| # | Titel | Status |
|---|---|---|
| **0** | Setup & Skelett | ✅ Done |
| **1** | Listen-Datenmodell & Eingabe-Flow | ✅ Done |
| **2** | Marker-Generierung (Druckbogen) | ✅ Done |
| **3a** | Kamera & Live-Preview | ✅ Done |
| **3b** | ArUco-Erkennung & Mapping | ✅ Done |
| 3c | Vorschlag-Karte & Fallback-UX | ⬜ Open |
| 4 | Dashboard (KPIs, Live-Edit) | ⬜ Open |

---

## Techstack

- **Vanilla JS** — kein Framework, kein Bundler, kein npm
- **Vanilla CSS** — CSS-Variablen als Designtokens
- **IndexedDB** — persistente Datenhaltung, kein Backend
- **PWA** — installierbar, offline-faehig via Service Worker
- **Deploy** — GitHub Pages via GitHub Actions

---

## Lokal starten

```bash
git clone https://github.com/Devcany/reticle.git
cd reticle
python3 -m http.server 8080
# -> http://localhost:8080
```

> HTTPS-Kontext (localhost oder deployed) ist fuer Service Worker und IndexedDB Pflicht.
