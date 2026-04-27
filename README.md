# Reticle

**Tabletop-Scanner fuer Wargames.** Scanne Marker auf deinen Miniaturen und tracke HP, Zustande und Statuseffekte direkt auf dem Spielfeld — ohne Zettel, ohne Unterbrechung.

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

## Paeckchen-Status

| # | Titel | Status |
|---|---|---|
| **0** | Setup & Skelett | ✅ Done |
| 1 | Listen-Datenmodell & Eingabe-Flow | ⬜ Open |
| 2 | Marker-Generierung (PDF-Druckbogen) | ⬜ Open |
| 3 | Scan-Flow (Kamera + Erkennung) | ⬜ Open |
| 4 | Dashboard (KPIs, Live-Edit) | ⬜ Open |

---

## Techstack

- **Vanilla JS** — kein Framework, kein Bundler, kein npm
- **Vanilla CSS** — CSS-Variablen als Designtokens
- **PWA** — installierbar, offline-faehig via Service Worker
- **Deploy** — GitHub Pages via GitHub Actions

---

## Lokal starten

```bash
git clone https://github.com/Devcany/reticle.git
cd reticle
# Beliebigen statischen Server starten, z.B.:
python3 -m http.server 8080
# -> http://localhost:8080
```

> HTTPS-Kontext (localhost oder deployed) ist fuer Service Worker Pflicht.
